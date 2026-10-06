import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, LessThan, Not, Repository } from 'typeorm';
import { DomainEvent, DomainEventBus } from '../../common/domain-event-bus';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { minorDigits } from '../common/moneda.util';
import { Mercado } from '../mercados/entities/mercado.entity';
import { Pago } from './entities/pago.entity';
import { ANTIFRAUDE, Antifraude, PASARELA_PAGO, PasarelaPago } from './ports/pagos.ports';

export interface SolicitudPago {
  ofertaId: string;
  ownerId: string;
  mercado: Mercado;
  montoMinor: number;
  medio: { token: string; marca: string };
  cuotas: number;
  claveIdempotencia: string;
}

export type ResultadoAutorizacion =
  | { ok: true; pago: Pago }
  | { ok: false; pago: Pago; codigo: 'PAYMENT_DECLINED' | 'PAYMENT_REJECTED_BY_FRAUD'; detalle: string };

const CAPTURE_ATTEMPTS = 3;
const VOID_ATTEMPTS = 3;
const REFUND_ATTEMPTS = 3;

/** D08. Authorises, captures and voids card payments through the gateway and fraud ports. */
@Injectable()
export class PagosService implements OnModuleInit {
  private readonly logger = new Logger(PagosService.name);

  constructor(
    @InjectRepository(Pago) private readonly pagos: Repository<Pago>,
    @Inject(PASARELA_PAGO) private readonly pasarela: PasarelaPago,
    @Inject(ANTIFRAUDE) private readonly antifraude: Antifraude,
    private readonly events: DomainEventBus,
  ) {}

  onModuleInit(): void {
    // A cancelled booking is paid back through the gateway. The flight core only announces the cancellation (it
    // knows a payment reference, not a gateway); this consumer finds the payment behind that reference.
    this.events.subscribe('booking.cancelled', (event) => this.reembolsarPorCancelacion(event));
  }

  /** RF-PAY-012: refunds go back to the original method. A booking made outside the e-commerce has no payment here. */
  async reembolsarPorCancelacion(event: DomainEvent): Promise<void> {
    const payload = event.payload as { paymentReference?: string; refundMinor?: number; bookingId?: string };
    if (!payload.paymentReference) return;
    const pago = await this.pagos.findOne({ where: { autorizacionRef: payload.paymentReference } });
    if (!pago) return;
    await this.reembolsar(pago, payload.refundMinor ?? 0, payload.bookingId);
  }

  /**
   * Returns `montoMinor` of a payment to the card. A captured payment is refunded; one that was only authorised
   * (the capture is still pending) has charged nothing, so its authorisation is released instead. Repeatable and it
   * never throws: if the gateway keeps failing the refund is parked as REEMBOLSO_PENDIENTE for the reconciler.
   */
  async reembolsar(pago: Pago, montoMinor: number, bookingId?: string): Promise<boolean> {
    if (pago.estado === 'REEMBOLSADO' || pago.estado === 'ANULADO') return true;
    const captured = pago.estado === 'CAPTURADO' || pago.estado === 'REEMBOLSO_PENDIENTE';
    for (let attempt = 1; attempt <= REFUND_ATTEMPTS; attempt++) {
      try {
        if (montoMinor > 0 && captured) await this.pasarela.reembolsar(pago.autorizacionRef!, montoMinor);
        else if (!captured && pago.autorizacionRef) await this.pasarela.anular(pago.autorizacionRef);
        const estado = captured ? 'REEMBOLSADO' : 'ANULADO';
        await this.pagos.update(pago.pagoId, { estado, reembolsoMinor: captured ? montoMinor : 0 });
        pago.estado = estado;
        await this.events.publish('PagoReembolsado', pago.pagoId, { pagoId: pago.pagoId, ordenId: pago.ordenId, ofertaId: pago.ofertaId, bookingId, montoMinor: captured ? montoMinor : 0 }, { market: pago.mercado });
        return true;
      } catch (error) {
        this.logger.warn(`Refund attempt ${attempt}/${REFUND_ATTEMPTS} failed for payment ${pago.pagoId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await this.pagos.update(pago.pagoId, { estado: 'REEMBOLSO_PENDIENTE', reembolsoMinor: montoMinor });
    pago.estado = 'REEMBOLSO_PENDIENTE';
    this.logger.error(`Payment ${pago.pagoId} could not be refunded: left as REEMBOLSO_PENDIENTE for reconciliation`);
    return false;
  }

  /** RF-PAY-006/007/009: fraud check first, then the authorisation; a refusal leaves the offer payable. */
  async autorizar(solicitud: SolicitudPago): Promise<ResultadoAutorizacion> {
    const { mercado } = solicitud;
    const previos = await this.pagos.count({ where: { ofertaId: solicitud.ofertaId, estado: In(['RECHAZADO', 'RECHAZADO_ANTIFRAUDE']) } });

    let pago = await this.pagos.save(
      this.pagos.create({
        ofertaId: solicitud.ofertaId,
        ownerId: solicitud.ownerId,
        mercado: mercado.codigo,
        moneda: mercado.moneda,
        montoMinor: solicitud.montoMinor,
        medio: { tipo: 'TARJETA', marca: solicitud.medio.marca, ultimos4: null },
        cuotas: solicitud.cuotas,
        estado: 'PENDIENTE',
        claveIdempotencia: solicitud.claveIdempotencia,
      }),
    );

    const montoUsdCents = Math.round((solicitud.montoMinor / 10 ** minorDigits(mercado.moneda) / mercado.tipoCambioDesdeUsd) * 100);
    const fraude = await this.antifraude.evaluar({
      monto: solicitud.montoMinor,
      moneda: mercado.moneda,
      montoUsdCents,
      token: solicitud.medio.token,
      mercado: mercado.codigo,
      ownerId: solicitud.ownerId,
      intentosFallidosPrevios: previos,
    });
    pago.antifraude = fraude;

    if (fraude.veredicto !== 'APROBAR') {
      // RF-PAY-007: only "approve" proceeds. Manual review is not available in this phase, so a
      // "review" verdict is declined with the reason recorded rather than charged blindly.
      pago.estado = 'RECHAZADO_ANTIFRAUDE';
      pago = await this.pagos.save(pago);
      await this.events.publish('PagoRechazado', pago.pagoId, { pagoId: pago.pagoId, ofertaId: pago.ofertaId, motivo: 'FRAUD' }, { market: mercado.codigo });
      return { ok: false, pago, codigo: 'PAYMENT_REJECTED_BY_FRAUD', detalle: 'The payment could not be approved. Try another payment method.' };
    }

    let respuesta;
    try {
      respuesta = await this.pasarela.autorizar({
        monto: solicitud.montoMinor,
        moneda: mercado.moneda,
        token: solicitud.medio.token,
        marca: solicitud.medio.marca,
        cuotas: solicitud.cuotas,
        referencia: solicitud.claveIdempotencia,
      });
    } catch (error) {
      pago.estado = 'RECHAZADO';
      pago.codigoRechazo = 'gateway_error';
      await this.pagos.save(pago);
      this.logger.error(`Gateway error authorising payment ${pago.pagoId}: ${error instanceof Error ? error.message : String(error)}`);
      throw new ProblemDetailsException(HttpStatus.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE', 'Payment provider unavailable', 'The payment provider did not answer. No charge was made; try again.');
    }

    if (!respuesta.aprobado) {
      pago.estado = 'RECHAZADO';
      pago.codigoRechazo = respuesta.codigoRechazo;
      pago = await this.pagos.save(pago);
      await this.events.publish('PagoRechazado', pago.pagoId, { pagoId: pago.pagoId, ofertaId: pago.ofertaId, motivo: respuesta.codigoRechazo }, { market: mercado.codigo });
      return { ok: false, pago, codigo: 'PAYMENT_DECLINED', detalle: 'The card was declined. Try another payment method.' };
    }

    pago.estado = 'AUTORIZADO';
    pago.autorizacionRef = respuesta.autorizacionRef;
    pago.medio = { tipo: 'TARJETA', marca: solicitud.medio.marca, ultimos4: respuesta.ultimos4 };
    pago = await this.pagos.save(pago);
    await this.events.publish('PagoAutorizado', pago.pagoId, { pagoId: pago.pagoId, ofertaId: pago.ofertaId }, { market: mercado.codigo });
    return { ok: true, pago };
  }

  /** The authorised, not-yet-captured payment of an offer, if a previous attempt got that far (resume after a crash). */
  async autorizadoDeOferta(ofertaId: string): Promise<Pago | null> {
    return this.pagos.findOne({ where: { ofertaId, estado: In(['AUTORIZADO', 'CAPTURADO', 'CAPTURA_PENDIENTE']) }, order: { creadoEn: 'DESC' } });
  }

  async asociarOrden(manager: EntityManager, pagoId: string, ordenId: string): Promise<void> {
    await manager.update(Pago, { pagoId }, { ordenId });
  }

  /** RF-ORD-002 step "capturar": retried, and parked as CAPTURA_PENDIENTE for reconciliation if it keeps failing. */
  async capturar(pago: Pago): Promise<Pago> {
    for (let attempt = 1; attempt <= CAPTURE_ATTEMPTS; attempt++) {
      try {
        await this.pasarela.capturar(pago.autorizacionRef!, pago.montoMinor);
        // Only the state column: the caller's copy may predate other writes (e.g. ordenId), and a
        // full save would silently overwrite them with stale values.
        await this.pagos.update(pago.pagoId, { estado: 'CAPTURADO' });
        pago.estado = 'CAPTURADO';
        return pago;
      } catch (error) {
        this.logger.warn(`Capture attempt ${attempt}/${CAPTURE_ATTEMPTS} failed for payment ${pago.pagoId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await this.pagos.update(pago.pagoId, { estado: 'CAPTURA_PENDIENTE' });
    pago.estado = 'CAPTURA_PENDIENTE';
    this.logger.error(`Payment ${pago.pagoId} was issued but could not be captured: left as CAPTURA_PENDIENTE for reconciliation`);
    return pago;
  }

  /**
   * Compensation (RN-19): releases the authorisation when the ticket could not be issued. Repeatable,
   * and it never throws: if the gateway keeps failing the payment is parked as ANULACION_PENDIENTE
   * for the reconciler, so the caller can still record the failed order. Returns whether it was voided.
   */
  async anular(pago: Pago): Promise<boolean> {
    for (let attempt = 1; attempt <= VOID_ATTEMPTS; attempt++) {
      try {
        if (pago.autorizacionRef) await this.pasarela.anular(pago.autorizacionRef);
        await this.pagos.update(pago.pagoId, { estado: 'ANULADO' });
        pago.estado = 'ANULADO';
        await this.events.publish('PagoAnulado', pago.pagoId, { pagoId: pago.pagoId, ofertaId: pago.ofertaId }, { market: pago.mercado });
        return true;
      } catch (error) {
        this.logger.warn(`Void attempt ${attempt}/${VOID_ATTEMPTS} failed for payment ${pago.pagoId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await this.pagos.update(pago.pagoId, { estado: 'ANULACION_PENDIENTE' });
    pago.estado = 'ANULACION_PENDIENTE';
    this.logger.error(`Payment ${pago.pagoId} could not be voided: left as ANULACION_PENDIENTE for reconciliation`);
    return false;
  }

  /**
   * Finishes what a crash or a gateway outage left half-done: captures payments of issued orders
   * (CAPTURA_PENDIENTE, or AUTORIZADO with an order older than the grace period) and voids the
   * authorisations of failed issuances (ANULACION_PENDIENTE). Returns how many were settled.
   */
  async reconciliarPendientes(graceMs = 60_000): Promise<number> {
    const before = new Date(Date.now() - graceMs);
    const pendientes = await this.pagos.find({
      where: [
        { estado: 'CAPTURA_PENDIENTE' },
        { estado: 'AUTORIZADO', ordenId: Not(IsNull()), actualizadoEn: LessThan(before) },
        { estado: 'ANULACION_PENDIENTE' },
        { estado: 'REEMBOLSO_PENDIENTE' },
      ],
      order: { actualizadoEn: 'ASC' },
      take: 50,
    });

    let settled = 0;
    for (const pago of pendientes) {
      const resuelto =
        pago.estado === 'ANULACION_PENDIENTE'
          ? await this.anular(pago)
          : pago.estado === 'REEMBOLSO_PENDIENTE'
            ? await this.reembolsar(pago, pago.reembolsoMinor ?? 0)
            : (await this.capturar(pago)).estado === 'CAPTURADO';
      if (resuelto) settled++;
    }
    return settled;
  }
}
