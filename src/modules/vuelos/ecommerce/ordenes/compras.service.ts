import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AuthClaims } from '../../auth/token.service';
import { DomainEventBus } from '../../common/domain-event-bus';
import { ProblemDetailsBody, ProblemDetailsException } from '../../common/problem-details.exception';
import type { BookingRequestDto } from '../../dto/booking.dto';
import { BookingsService } from '../../services/bookings.service';
import { IdempotencyService, SagaOutcome } from '../../services/idempotency.service';
import { OffersService } from '../../services/offers.service';
import { formatAmount } from '../common/moneda.util';
import { Mercado } from '../mercados/entities/mercado.entity';
import { MercadosService } from '../mercados/mercados.service';
import { Oferta } from '../ofertas/entities/oferta.entity';
import { OfertasService } from '../ofertas/ofertas.service';
import { Pago } from '../pagos/entities/pago.entity';
import { PagosService, ResultadoAutorizacion } from '../pagos/pagos.service';
import { CompraDto } from './dto/ordenes.dto';
import { Orden } from './entities/orden.entity';
import { OrdenesService } from './ordenes.service';

const ROUTE_COMPRA = 'POST /ofertas/{id}/compra';

const problem = (status: HttpStatus, code: ProblemDetailsBody['code'], title: string, detail: string): ProblemDetailsBody => ({
  type: `https://api.booking-hub.com/errors/${code.toLowerCase().replace(/_/g, '-')}`,
  title,
  status,
  code,
  detail,
});

/**
 * The purchase saga (SRS §8.4): revalidate -> authorise payment -> create the order and issue the
 * booking -> capture, or compensate (void the authorisation) if issuance fails (RN-19).
 *
 * It is a saga rather than one transaction because it crosses an external system (the payment
 * gateway): the database work that must be atomic (order + booking + tickets + hold) is one
 * transaction, while the gateway calls around it are individually compensable.
 *
 * It is resumable by state: whatever a crashed attempt left behind (an offer lock, an authorised
 * payment, an issued order) is recognised on retry and completed, never repeated, so a retry cannot
 * charge twice or issue twice.
 */
@Injectable()
export class ComprasService {
  private readonly logger = new Logger(ComprasService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ofertas: OfertasService,
    private readonly pagos: PagosService,
    private readonly ordenes: OrdenesService,
    private readonly mercados: MercadosService,
    private readonly bookings: BookingsService,
    private readonly gdsOffers: OffersService,
    private readonly idempotency: IdempotencyService,
    private readonly events: DomainEventBus,
  ) {}

  /**
   * One purchase attempt. A business outcome (success, declined card, rejected by fraud, issuance
   * failed and compensated) is stored under the Idempotency-Key and replayed verbatim (RF-PAY-008);
   * a precondition failure (incomplete offer, price changed, expired) is not, so the client can fix
   * it and retry with the same key.
   */
  async comprar(auth: AuthClaims, ofertaId: string, dto: CompraDto, key: string): Promise<SagaOutcome & { replayed: boolean }> {
    const { outcome, replayed } = await this.idempotency.executeSaga(
      { key, route: ROUTE_COMPRA, ownerId: auth.ownerId, body: { ofertaId, ...dto } },
      () => this.saga(auth, ofertaId, dto, key),
    );
    return { ...outcome, replayed };
  }

  private async saga(auth: AuthClaims, ofertaId: string, dto: CompraDto, key: string): Promise<SagaOutcome> {
    // Resume: an offer that already became an issued order answers with that order (a retry after a lost response).
    const existente = await this.ordenes.deOferta(ofertaId);
    if (existente) {
      if (existente.ownerId !== auth.ownerId) {
        throw new ProblemDetailsException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Offer belongs to another user', 'You do not have access to this offer.');
      }
      if (existente.estado !== 'EMITIDA') {
        throw new ProblemDetailsException(HttpStatus.CONFLICT, 'INVALID_STATE_TRANSITION', 'The offer already has an order', `Its order is ${existente.estado}.`);
      }
      await this.asegurarCaptura(ofertaId);
      return { status: HttpStatus.CREATED, body: this.ordenes.vista(existente) };
    }

    // --- preconditions (thrown, never stored under the key) ---
    const oferta = await this.ofertas.cargarVigente(auth, ofertaId);
    const mercado = await this.mercados.requerirActivo(oferta.mercado);
    this.validarMedio(mercado, dto);

    // Take the offer first, so everything after (price re-check included) runs while no other
    // attempt can touch it. The loser of a race finds the winner's order instead of failing.
    let bloqueada: Oferta;
    try {
      bloqueada = await this.ofertas.bloquearParaPago(auth, ofertaId);
    } catch (error) {
      const resuelta = await this.ordenes.deOferta(ofertaId);
      if (resuelta?.estado === 'EMITIDA' && resuelta.ownerId === auth.ownerId) {
        return { status: HttpStatus.CREATED, body: this.ordenes.vista(resuelta) };
      }
      throw error;
    }

    try {
      // RF-CRT-003 / RN-12: price and availability are re-checked right before charging.
      await this.ofertas.revalidarBloqueada(bloqueada);
      return await this.cobrarYEmitir(bloqueada, mercado, dto, key);
    } catch (error) {
      // An unexpected failure outside the compensated paths: free the offer so a retry can proceed.
      // Any authorised payment stays recorded and the retry resumes with it instead of charging again.
      await this.ofertas.liberarPago(ofertaId, 'ABIERTA').catch((releaseError: unknown) =>
        this.logger.error(`Could not release offer ${ofertaId}: ${releaseError instanceof Error ? releaseError.message : String(releaseError)}`),
      );
      throw error;
    }
  }

  private async cobrarYEmitir(oferta: Oferta, mercado: Mercado, dto: CompraDto, key: string): Promise<SagaOutcome> {
    // Resume: a previous attempt may have got as far as an authorised payment.
    let pago = await this.pagos.autorizadoDeOferta(oferta.ofertaId);

    if (!pago) {
      const resultado = await this.pagos.autorizar({
        ofertaId: oferta.ofertaId,
        ownerId: oferta.ownerId,
        mercado,
        montoMinor: oferta.totalMinor,
        medio: { token: dto.medio.token, marca: dto.medio.marca },
        cuotas: dto.cuotas ?? 1,
        claveIdempotencia: key,
      });

      if (!resultado.ok) {
        // Narrowing on a boolean discriminant needs strictNullChecks, which this template turns off.
        const rechazo = resultado as Extract<ResultadoAutorizacion, { ok: false }>;
        // RF-PAY-009: the offer stays valid for another payment method for the time left.
        await this.ofertas.liberarPago(oferta.ofertaId, 'ABIERTA');
        return {
          status: HttpStatus.PAYMENT_REQUIRED,
          body: problem(HttpStatus.PAYMENT_REQUIRED, rechazo.codigo, rechazo.codigo === 'PAYMENT_DECLINED' ? 'Payment declined' : 'Payment rejected', rechazo.detalle),
        };
      }
      pago = resultado.pago;
    }

    // Order + booking + tickets + hold + offer state change as ONE transaction: all or nothing.
    let emision: { orden: Orden; outcome: Awaited<ReturnType<BookingsService['createBookingWithin']>> };
    try {
      emision = await this.dataSource.transaction(async (manager) => {
        const orden = await this.ordenes.crearPagada(manager, oferta, pago!);
        const outcome = await this.bookings.createBookingWithin(manager, oferta.ownerId, this.aSolicitudGds(oferta, pago!));
        await this.ordenes.marcarEmitida(manager, orden, outcome.response);
        await this.pagos.asociarOrden(manager, pago!.pagoId, orden.ordenId);
        await this.ofertas.marcarPagada(manager, oferta.ofertaId);
        return { orden, outcome };
      });
    } catch (error) {
      return this.compensar(oferta, pago, error);
    }

    pago.ordenId = emision.orden.ordenId;
    await this.bookings.announceConfirmed(oferta.ownerId, emision.outcome);
    await this.pagos.capturar(pago);
    await this.events.publish(
      'OrdenEmitida',
      emision.orden.ordenId,
      {
        ordenId: emision.orden.ordenId,
        numeroOrden: emision.orden.numeroOrden,
        pnr: emision.orden.pnr,
        clienteId: emision.orden.clienteId,
        correo: emision.orden.contacto.correo,
        idioma: mercado.idiomaPorDefecto,
        total: `${formatAmount(emision.orden.totalMinor, emision.orden.moneda)} ${emision.orden.moneda}`,
        itinerarios: emision.orden.trayectos.map((t) => ({ numeroVuelo: t.numeroVuelo, origen: t.origen, destino: t.destino, salida: t.salida, llegada: t.llegada, familia: t.familia })),
        pasajeros: emision.orden.pasajeros.map((p) => ({ nombres: p.nombres, apellidos: p.apellidos, tipo: p.tipo, eTicket: p.eTicket })),
      },
      { market: mercado.codigo },
    );

    return { status: HttpStatus.CREATED, body: this.ordenes.vista(emision.orden) };
  }

  /**
   * RN-19: the charge was authorised but the ticket could not be issued, so the authorisation is
   * voided, the failed attempt is recorded, and the customer is told what happened.
   */
  private async compensar(oferta: Oferta, pago: Pago, error: unknown): Promise<SagaOutcome> {
    const known = error instanceof ProblemDetailsException ? error : null;
    const motivo = known ? (known.getResponse() as ProblemDetailsBody).code : 'unexpected_error';
    if (!known) {
      this.logger.error(`Issuance failed for offer ${oferta.ofertaId}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    }

    await this.pagos.anular(pago);
    const fallida = await this.ordenes.registrarFallida(oferta, pago, motivo);

    // If the inventory hold survived the failure the customer can simply try again.
    const hold = await this.gdsOffers.getHoldStatus(oferta.ownerId, oferta.holdId).catch(() => null);
    await this.ofertas.liberarPago(oferta.ofertaId, hold?.status === 'HELD' ? 'ABIERTA' : 'VENCIDA');

    await this.events.publish(
      'OrdenFallidaCompensada',
      fallida.ordenId,
      { ordenId: fallida.ordenId, numeroOrden: fallida.numeroOrden, correo: fallida.contacto.correo, idioma: (await this.mercados.obtener(oferta.mercado)).idiomaPorDefecto, motivo },
      { market: oferta.mercado },
    );

    const status = known ? known.getStatus() : HttpStatus.BAD_GATEWAY;
    return {
      status,
      body: problem(
        status,
        'ISSUANCE_FAILED_COMPENSATED',
        'Ticket issuance failed; payment released',
        `Order ${fallida.numeroOrden} could not be issued (${motivo}). The payment authorisation was released and you were not charged.`,
      ),
    };
  }

  /** An issued order whose payment was never captured (a crash after issuing): finish the capture. */
  private async asegurarCaptura(ofertaId: string): Promise<void> {
    const pago = await this.pagos.autorizadoDeOferta(ofertaId);
    if (pago && (pago.estado === 'AUTORIZADO' || pago.estado === 'CAPTURA_PENDIENTE')) {
      await this.pagos.capturar(pago);
    }
  }

  /** RF-PAY-001/002/010: the brand and the instalment plan must be ones the market offers for tickets. */
  private validarMedio(mercado: Mercado, dto: CompraDto): void {
    const medio = mercado.mediosPago.find((m) => m.tipo === dto.medio.tipo && m.productos.includes('PASAJE'));
    if (!medio || !medio.marcas.includes(dto.medio.marca)) {
      throw new ProblemDetailsException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PAYMENT_METHOD_NOT_ALLOWED',
        'Payment method not available in this market',
        `The market "${mercado.codigo}" accepts: ${medio ? medio.marcas.join(', ') : 'no card brands for tickets'}.`,
        [{ name: 'medio.marca', reason: 'not accepted in this market' }],
      );
    }
    if (!medio.cuotasPermitidas.includes(dto.cuotas ?? 1)) {
      throw new ProblemDetailsException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PAYMENT_METHOD_NOT_ALLOWED',
        'Instalment plan not available',
        `Instalments allowed: ${medio.cuotasPermitidas.join(', ')}.`,
        [{ name: 'cuotas', reason: 'not offered in this market' }],
      );
    }
  }

  private aSolicitudGds(oferta: Oferta, pago: Pago): BookingRequestDto {
    const datos = oferta.datosPasajeros!;
    return {
      holdId: oferta.holdId,
      passengers: datos.pasajeros.map((p) => ({
        passengerId: p.id,
        passengerType: p.tipo,
        associatedAdultId: p.asociadoA,
        firstName: p.nombres,
        lastName: p.apellidos,
        documentType: p.documento.tipo,
        documentNumber: p.documento.numero,
        nationality: p.nacionalidad,
        documentExpiryDate: p.documento.vencimiento,
        birthDate: p.fechaNacimiento,
        gender: p.genero,
        contact: { email: datos.contacto.correo, phone: datos.contacto.telefono },
      })),
      // The gateway's authorisation reference is the flight core's paymentReference.
      payment: { paymentReference: pago.autorizacionRef! },
    };
  }
}
