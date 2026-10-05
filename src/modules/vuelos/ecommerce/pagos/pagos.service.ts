import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { DomainEventBus } from '../../common/domain-event-bus';
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

/** D08. Authorises, captures and voids card payments through the gateway and fraud ports. */
@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

  constructor(
    @InjectRepository(Pago) private readonly pagos: Repository<Pago>,
    @Inject(PASARELA_PAGO) private readonly pasarela: PasarelaPago,
    @Inject(ANTIFRAUDE) private readonly antifraude: Antifraude,
    private readonly events: DomainEventBus,
  ) {}

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

  /** Compensation (RN-19): releases the authorisation when the ticket could not be issued. Repeatable. */
  async anular(pago: Pago): Promise<Pago> {
    if (pago.autorizacionRef) await this.pasarela.anular(pago.autorizacionRef);
    await this.pagos.update(pago.pagoId, { estado: 'ANULADO' });
    pago.estado = 'ANULADO';
    await this.events.publish('PagoAnulado', pago.pagoId, { pagoId: pago.pagoId, ofertaId: pago.ofertaId }, { market: pago.mercado });
    return pago;
  }
}
