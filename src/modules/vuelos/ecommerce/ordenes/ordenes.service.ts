import { randomInt } from 'node:crypto';
import { HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, In, Not, Repository } from 'typeorm';
import type { AuthClaims } from '../../auth/token.service';
import { decodeCursor, encodeCursor } from '../../common/cursor.util';
import { DomainEvent, DomainEventBus } from '../../common/domain-event-bus';
import { toIso } from '../../common/date.util';
import type { PassengerType } from '../../common/pricing.util';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { buildTicketCode, verifyTicketCode } from '../../common/ticket-qr';
import { VUELOS_CONFIG, VuelosConfig } from '../../common/vuelos-config';
import type { BookingDetailResponseDto } from '../../dto/booking.dto';
import { Booking } from '../../entities/booking.entity';
import { FlightHoldItem } from '../../entities/flight-hold-item.entity';
import { Passenger } from '../../entities/passenger.entity';
import { Ticket } from '../../entities/ticket.entity';
import { Vuelo } from '../../entities/vuelo.entity';
import { money } from '../common/moneda.util';
import { SlidingWindowLimiter, assertWithinLimit } from '../common/rate-limiter';
import { normalizarNombrePasajero } from '../common/texto.util';
import { Oferta } from '../ofertas/entities/oferta.entity';
import { OfertaPasajero } from '../ofertas/entities/oferta-pasajero.entity';
import { OfertaTrayecto } from '../ofertas/entities/oferta-trayecto.entity';
import { Pago } from '../pagos/entities/pago.entity';
import { HistorialOrdenesQueryDto, OrdenViewDto, OrdenesPaginaViewDto, RecuperarOrdenQueryDto, VerificacionBilleteViewDto } from './dto/ordenes.dto';
import { EstadoOrden, Orden, TRANSICIONES } from './entities/orden.entity';
import { OrdenHistorial } from './entities/orden-historial.entity';

const ORDER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const orderNotFound = () => new ProblemDetailsException(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found', 'No order matches the data provided.');

/** One leg of an order as it stands now: the flight (with its current times) and the fare family sold. */
interface Tramo {
  vueloId: string;
  numeroVuelo: string;
  operadorCodigo: string;
  operadorNombre: string;
  origen: string;
  destino: string;
  salida: string;
  llegada: string;
  familia: string;
}

interface PasajeroOrden {
  id: string;
  tipo: PassengerType;
  nombres: string;
  apellidos: string;
  eTicket: string | null;
  asientos: { vueloId: string; asiento: string }[];
}

/** Everything the order does not store itself, gathered from the tables that own it (see OrdenesService.contexto). */
interface ContextoOrden {
  tramos: Tramo[];
  pasajeros: PasajeroOrden[];
  pago: Pago | null;
  historial: OrdenHistorial[];
}

/**
 * D09. The commercial record of a purchase: number, state machine, history. The order stores no copy of the trip: the
 * legs come from the booking's hold (or the offer, for an attempt that never became a booking), the travellers from
 * the offer, the tickets from the flight core, the payment from `ecom_pagos`.
 */
@Injectable()
export class OrdenesService implements OnModuleInit {
  // RF-ORD-010 recovery is public (order number + surname), so it is rate-limited against guessing.
  private readonly recoveryLimiter = new SlidingWindowLimiter(10, 60_000);

  // The ticket check is public too (anyone holding a QR can open it), so it is limited per address as well.
  private readonly verificationLimiter = new SlidingWindowLimiter(30, 60_000);

  constructor(
    @InjectRepository(Orden) private readonly ordenes: Repository<Orden>,
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
    private readonly events: DomainEventBus,
  ) {}

  onModuleInit(): void {
    // After-sale operations happen in the flight core, which only announces them; the order follows. Every handler is
    // idempotent and safe to receive in any order (a refund can be announced before the cancellation is handled).
    this.events.subscribe('booking.cancelled', (event) => this.alCancelarReserva(event));
    this.events.subscribe('PagoReembolsado', (event) => this.alReembolsar(event));
    this.events.subscribe('booking.changed', (event) => this.alCambiarReserva(event));
  }

  /** An order ready to change state: its history is loaded, so saving it appends the new rows and drops none. */
  private cargar(where: FindOptionsWhere<Orden>): Promise<Orden | null> {
    return this.ordenes.findOne({ where, relations: { historial: true } });
  }

  /** The reservation was cancelled: the order enters the refund state (EMITIDA -> DEVOLUCION_EN_CURSO). */
  async alCancelarReserva(event: DomainEvent): Promise<void> {
    const { bookingId } = event.payload as { bookingId?: string };
    const orden = bookingId ? await this.cargar({ bookingId }) : null;
    if (!orden || orden.estado !== 'EMITIDA') return;
    this.transicionar(orden, 'DEVOLUCION_EN_CURSO', 'Reserva cancelada');
    await this.ordenes.save(orden);
  }

  /** The money went back to the card: the order is REEMBOLSADA (passing through the refund state if it had not yet). */
  async alReembolsar(event: DomainEvent): Promise<void> {
    const { bookingId, ordenId } = event.payload as { bookingId?: string; ordenId?: string };
    const orden = bookingId ? await this.cargar({ bookingId }) : ordenId ? await this.cargar({ ordenId }) : null;
    if (!orden) return;
    if (orden.estado === 'EMITIDA') this.transicionar(orden, 'DEVOLUCION_EN_CURSO', 'Reserva cancelada');
    if (orden.estado !== 'DEVOLUCION_EN_CURSO') return;
    this.transicionar(orden, 'REEMBOLSADA', 'Reembolso ejecutado');
    await this.ordenes.save(orden);
  }

  /**
   * A leg moved to another flight (by the traveller or because the airline rescheduled). The booking's hold already
   * points at the new flight, which is where the order's legs are read from, so only the state passes through
   * MODIFICADA and back.
   */
  async alCambiarReserva(event: DomainEvent): Promise<void> {
    const { bookingId } = event.payload as { bookingId?: string };
    const orden = bookingId ? await this.cargar({ bookingId }) : null;
    if (!orden || orden.estado !== 'EMITIDA') return;
    this.transicionar(orden, 'MODIFICADA', 'Cambio de vuelo');
    this.transicionar(orden, 'EMITIDA', 'Cambio aplicado');
    await this.ordenes.save(orden);
  }

  /**
   * Public check of a QR code: authentic and issued? Returns the flight(s) and the ticket state only, never
   * names or contact data. Anything that is not an authentic, issued ticket answers `valido: false`.
   */
  async verificarBillete(codigo: string, ip: string): Promise<VerificacionBilleteViewDto> {
    assertWithinLimit(this.verificationLimiter, `verify:${ip}`, 'Too many checks');

    const firmado = verifyTicketCode(this.config.jwtSecret, codigo);
    if (!firmado) return { valido: false };

    const ticket = await this.tickets.findOne({ where: { eTicketNumber: firmado.eTicketNumber } });
    if (!ticket) return { valido: false };
    const orden = await this.ordenes.findOne({ where: { pnr: firmado.pnr } });
    if (!orden || orden.bookingId !== ticket.bookingId) return { valido: false };

    const { tramos } = (await this.contexto([orden])).get(orden.ordenId);
    return {
      valido: ticket.status === 'ISSUED',
      estado: ticket.status,
      pnr: orden.pnr ?? undefined,
      itinerarios: tramos.map((t) => ({ numeroVuelo: t.numeroVuelo, origen: t.origen, destino: t.destino, salida: t.salida })),
    };
  }

  /** The live order of an offer (a failed, compensated attempt does not count). */
  async deOferta(ofertaId: string): Promise<Orden | null> {
    return this.ordenes.findOne({ where: { ofertaId, estado: Not('FALLIDA_COMPENSADA') } });
  }

  /** Authorised payment => the order exists in state PAGADA (PENDIENTE_PAGO -> PAGADA, SRS §8.5). */
  async crearPagada(manager: EntityManager, oferta: Oferta): Promise<Orden> {
    const ahora = new Date();
    const orden = manager.create(Orden, {
      ...(await this.datosBase(manager, oferta)),
      estado: 'PAGADA',
      historial: [this.fila(manager, 1, 'PENDIENTE_PAGO', ahora), this.fila(manager, 2, 'PAGADA', ahora, 'Pago autorizado')],
    });
    return manager.save(orden);
  }

  /** RF-ORD-002/003: the PNR and the booking land on the order (the e-tickets are the booking's own). */
  async marcarEmitida(manager: EntityManager, orden: Orden, booking: BookingDetailResponseDto): Promise<Orden> {
    this.transicionar(orden, 'EMITIDA', 'Reserva creada y billetes emitidos');
    orden.pnr = booking.pnr;
    orden.bookingId = booking.bookingId;
    return manager.save(orden);
  }

  /**
   * RN-19: the ticket could not be issued after the charge was authorised. The authorisation is
   * voided by the saga; this keeps the failed attempt on record (SRS: OrdenFallidaCompensada).
   */
  async registrarFallida(oferta: Oferta, pago: Pago, motivo: string): Promise<Orden> {
    const ahora = new Date();
    return this.ordenes.manager.transaction(async (manager) => {
      const orden = await manager.save(
        manager.create(Orden, {
          ...(await this.datosBase(manager, oferta)),
          estado: 'FALLIDA_COMPENSADA',
          historial: [
            this.fila(manager, 1, 'PENDIENTE_PAGO', ahora),
            this.fila(manager, 2, 'PAGADA', ahora, 'Pago autorizado'),
            this.fila(manager, 3, 'FALLIDA_COMPENSADA', ahora, motivo),
          ],
        }),
      );
      // The voided authorisation belongs to this failed order, so the order can still show how it was paid.
      await manager.update(Pago, { pagoId: pago.pagoId }, { ordenId: orden.ordenId });
      return orden;
    });
  }

  private async datosBase(manager: EntityManager, oferta: Oferta) {
    return {
      numeroOrden: await this.nuevoNumero(manager),
      ofertaId: oferta.ofertaId,
      ownerId: oferta.ownerId,
      clienteId: oferta.ownerId.startsWith('guest:') ? null : oferta.ownerId,
      mercado: oferta.mercado,
      moneda: oferta.moneda,
      totalMinor: oferta.totalMinor,
      canal: 'WEB',
      pnr: null,
      bookingId: null,
      datosFacturacionId: oferta.datosFacturacionId,
      contactoCorreo: oferta.contactoCorreo,
      contactoTelefono: oferta.contactoTelefono,
    };
  }

  private fila(manager: EntityManager, secuencia: number, estado: EstadoOrden, en: Date, motivo?: string): OrdenHistorial {
    return manager.create(OrdenHistorial, { secuencia, estado, en, motivo: motivo ?? null });
  }

  /**
   * Applies a state change, refusing anything the SRS state machine does not allow, and appends the history row.
   * The caller persists (the order must have been loaded with its history).
   */
  transicionar(orden: Orden, destino: EstadoOrden, motivo?: string): void {
    if (!TRANSICIONES[orden.estado].includes(destino)) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'INVALID_STATE_TRANSITION', 'Invalid order state change', `An order cannot go from ${orden.estado} to ${destino}.`);
    }
    if (!orden.historial) throw new Error(`Order ${orden.ordenId}: history not loaded`);
    const secuencia = orden.historial.reduce((max, h) => Math.max(max, h.secuencia), 0) + 1;
    orden.estado = destino;
    orden.historial = [...orden.historial, Object.assign(new OrdenHistorial(), { secuencia, estado: destino, en: new Date(), motivo: motivo ?? null })];
  }

  async obtenerPropia(auth: AuthClaims, numeroOrden: string): Promise<OrdenViewDto> {
    const orden = await this.ordenes.findOne({ where: { numeroOrden } });
    // Someone else's order answers exactly like a missing one: no existence oracle.
    if (!orden || orden.ownerId !== auth.ownerId) throw orderNotFound();
    return this.vista(orden);
  }

  /** RF-ORD-010 / RF-PSV-001: recover a trip with the order number or the PNR plus a passenger's surname. */
  async recuperar(query: RecuperarOrdenQueryDto, ip: string): Promise<OrdenViewDto> {
    if (Boolean(query.numero) === Boolean(query.pnr)) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Order number or PNR required', 'Provide exactly one of numero or pnr, plus apellido.', [
        { name: 'numero', reason: 'send either numero or pnr' },
      ]);
    }
    const limit = this.recoveryLimiter.consume(`recover:${ip}`);
    if (!limit.allowed) {
      throw new ProblemDetailsException(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMIT_EXCEEDED', 'Too many lookups', `Try again in ${limit.retryAfterSeconds} seconds.`, undefined, limit.retryAfterSeconds);
    }

    const orden = await this.buscarPorCodigoYApellido(query);
    return this.vista(orden, { publica: true });
  }

  /** The order named by number or PNR whose passengers include that surname, else the same 404 for every miss. */
  private async buscarPorCodigoYApellido(query: RecuperarOrdenQueryDto): Promise<Orden> {
    const orden = await this.ordenes.findOne({ where: query.numero ? { numeroOrden: query.numero } : { pnr: query.pnr } });
    const apellido = normalizarNombrePasajero(query.apellido);
    // The surnames are encrypted, so they are compared here and not in SQL.
    const pasajeros = orden ? await this.ordenes.manager.find(OfertaPasajero, { where: { ofertaId: orden.ofertaId } }) : [];
    // People give one surname or both: accept the full surname or any whole word of it, never a fragment.
    const coincide = pasajeros.some((p) => {
      const registrado = normalizarNombrePasajero(p.apellidos);
      return registrado === apellido || (apellido.length >= 2 && registrado.split(' ').includes(apellido));
    });
    if (!orden || !apellido || !coincide) throw orderNotFound();
    return orden;
  }

  /**
   * Moves a trip bought as a guest into the signed-in customer's account (same proof as the public
   * recovery: number or PNR plus a passenger's surname). Only an order nobody owns yet can be claimed,
   * so this can never take a trip away from another account. Idempotent for the account that owns it.
   */
  async vincular(auth: AuthClaims, id: string, query: RecuperarOrdenQueryDto, ip: string): Promise<OrdenViewDto> {
    if (auth.kind !== 'customer') {
      throw new ProblemDetailsException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Account required', 'Sign in with an account to add a trip to it.');
    }
    if (id !== 'me' && id !== auth.ownerId) {
      throw new ProblemDetailsException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Not your account', 'You can only add trips to your own account.');
    }
    if (Boolean(query.numero) === Boolean(query.pnr)) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Order number or PNR required', 'Provide exactly one of numero or pnr, plus apellido.', [
        { name: 'numero', reason: 'send either numero or pnr' },
      ]);
    }
    assertWithinLimit(this.recoveryLimiter, `recover:${ip}`, 'Too many lookups');

    const orden = await this.buscarPorCodigoYApellido(query);
    if (orden.ownerId === auth.ownerId) return this.vista(orden);
    if (orden.clienteId || !orden.ownerId.startsWith('guest:')) throw orderNotFound();

    await this.ordenes.manager.transaction(async (manager) => {
      await manager.update(Orden, { ordenId: orden.ordenId, ownerId: orden.ownerId }, { ownerId: auth.ownerId, clienteId: auth.ownerId });
      if (orden.bookingId) await manager.update(Booking, { bookingId: orden.bookingId }, { ownerId: auth.ownerId });
    });
    orden.ownerId = auth.ownerId;
    orden.clienteId = auth.ownerId;
    return this.vista(orden);
  }

  /** RF-ORD-011: the customer's own history, newest first, keyset-paginated. */
  async historial(auth: AuthClaims, id: string, query: HistorialOrdenesQueryDto): Promise<OrdenesPaginaViewDto> {
    if (auth.kind !== 'customer') {
      throw new ProblemDetailsException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Account required', 'Guests have no order history; recover a trip with the order number and surname.');
    }
    const clienteId = id === 'me' ? auth.ownerId : id;
    if (clienteId !== auth.ownerId) {
      throw new ProblemDetailsException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Not your account', 'You can only list your own orders.');
    }

    const limit = query.limit ?? 20;
    const qb = this.ordenes.createQueryBuilder('o').where('o."clienteId" = :clienteId', { clienteId });
    if (query.cursor) {
      const { createdAt, id: cursorId } = decodeCursor(query.cursor);
      qb.andWhere('(o."creadaEn", o."ordenId") < (:cursorCreatedAt, :cursorId)', { cursorCreatedAt: createdAt, cursorId });
    }
    const rows = await qb.orderBy('o."creadaEn"', 'DESC').addOrderBy('o."ordenId"', 'DESC').take(limit + 1).getMany();
    const page = rows.slice(0, limit);

    return {
      items: await this.vistas(page),
      ...(rows.length > limit ? { nextCursor: encodeCursor(page[page.length - 1].creadaEn, page[page.length - 1].ordenId) } : {}),
    };
  }

  async vista(orden: Orden, opciones: { publica?: boolean } = {}): Promise<OrdenViewDto> {
    return (await this.vistas([orden], opciones))[0];
  }

  /** The views of several orders, built with one query per table (not per order). */
  async vistas(ordenes: Orden[], opciones: { publica?: boolean } = {}): Promise<OrdenViewDto[]> {
    const contexto = await this.contexto(ordenes);
    return ordenes.map((orden) => {
      const { tramos, pasajeros, pago, historial } = contexto.get(orden.ordenId);
      return {
        ordenId: orden.ordenId,
        numeroOrden: orden.numeroOrden,
        pnr: orden.pnr,
        estado: orden.estado,
        mercado: orden.mercado,
        total: money(orden.totalMinor, orden.moneda),
        itinerarios: tramos.map((t) => ({
          numeroVuelo: t.numeroVuelo,
          operador: { codigo: t.operadorCodigo, nombre: t.operadorNombre },
          origen: t.origen,
          destino: t.destino,
          salida: t.salida,
          llegada: t.llegada,
          familia: t.familia,
        })),
        pasajeros: pasajeros.map((p) => ({
          id: p.id,
          tipo: p.tipo,
          nombres: p.nombres,
          apellidos: p.apellidos,
          eTicket: p.eTicket,
          ...(p.eTicket && orden.pnr ? { qr: buildTicketCode(this.config.jwtSecret, p.eTicket, orden.pnr) } : {}),
          // A seat picked for a flight the trip no longer uses (after a change) is not shown.
          ...(p.asientos.length
            ? { asientos: p.asientos.map((a) => ({ numeroVuelo: tramos.find((t) => t.vueloId === a.vueloId)?.numeroVuelo ?? '', asiento: a.asiento })).filter((a) => a.numeroVuelo) }
            : {}),
        })),
        // The public recovery answers to a surname and a locator, so it never returns contact data.
        ...(opciones.publica ? {} : { contacto: orden.contacto, ...(orden.bookingId ? { bookingId: orden.bookingId } : {}) }),
        pago: { marca: pago?.marca ?? '', ultimos4: pago?.ultimos4 ?? null, cuotas: pago?.cuotas ?? 1 },
        creadaEn: toIso(orden.creadaEn),
        historial: historial.map((h) => ({ estado: h.estado, en: toIso(h.en), ...(h.motivo ? { motivo: h.motivo } : {}) })),
        _links: { self: `/api/v1/ordenes/${orden.numeroOrden}`, ...(!opciones.publica && orden.bookingId ? { reserva: `/api/v1/bookings/${orden.bookingId}` } : {}) },
      };
    });
  }

  /**
   * Gathers what an order shows but does not store: the legs (the booking's hold once there is a booking, else the
   * offer's quote), the travellers (the offer's) with their e-tickets (the booking's), the payment and the history.
   * One query per table for the whole batch.
   */
  private async contexto(ordenes: Orden[]): Promise<Map<string, ContextoOrden>> {
    const result = new Map<string, ContextoOrden>();
    if (ordenes.length === 0) return result;
    const manager = this.ordenes.manager;

    const ordenIds = ordenes.map((o) => o.ordenId);
    const ofertaIds = [...new Set(ordenes.map((o) => o.ofertaId))];
    const bookingIds = ordenes.filter((o) => o.bookingId).map((o) => o.bookingId as string);

    const [historiales, pagos, trayectos, pasajerosOferta, bookings, reserva, tickets] = await Promise.all([
      manager.find(OrdenHistorial, { where: { ordenId: In(ordenIds) }, order: { secuencia: 'ASC' } }),
      manager.find(Pago, { where: { ordenId: In(ordenIds) } }),
      manager.find(OfertaTrayecto, { where: { ofertaId: In(ofertaIds) }, relations: { vuelo: true }, order: { orden: 'ASC' } }),
      manager.find(OfertaPasajero, { where: { ofertaId: In(ofertaIds) }, relations: { asientos: true }, order: { orden: 'ASC' } }),
      bookingIds.length ? manager.find(Booking, { where: { bookingId: In(bookingIds) } }) : Promise.resolve([] as Booking[]),
      bookingIds.length ? manager.find(Passenger, { where: { bookingId: In(bookingIds) } }) : Promise.resolve([] as Passenger[]),
      bookingIds.length ? manager.find(Ticket, { where: { bookingId: In(bookingIds) } }) : Promise.resolve([] as Ticket[]),
    ]);
    const items = bookings.length
      ? await manager.find(FlightHoldItem, { where: { holdId: In(bookings.map((b) => b.holdId)) }, relations: { vuelo: true }, order: { orden: 'ASC' } })
      : [];

    const tramo = (vuelo: Vuelo, familia: string): Tramo => ({
      vueloId: vuelo.id,
      numeroVuelo: vuelo.codigoVuelo,
      operadorCodigo: vuelo.codigoAerolinea,
      operadorNombre: vuelo.aerolinea,
      origen: vuelo.origenIATA,
      destino: vuelo.destinoIATA,
      salida: toIso(vuelo.fechaSalida),
      llegada: toIso(vuelo.fechaLlegada),
      familia,
    });
    const ticketDe = new Map(tickets.map((t) => [t.passengerId, t.eTicketNumber]));

    for (const orden of ordenes) {
      const booking = orden.bookingId ? bookings.find((b) => b.bookingId === orden.bookingId) : undefined;
      const tramos = booking
        ? items.filter((i) => i.holdId === booking.holdId).map((i) => tramo(i.vuelo, i.fareBrand))
        : trayectos.filter((t) => t.ofertaId === orden.ofertaId).map((t) => tramo(t.vuelo, t.familia));
      // The flight core issues one ticket per passenger; it knows the passenger by the id the buyer chose.
      const reservaDe = new Map(reserva.filter((p) => p.bookingId === orden.bookingId).map((p) => [p.clientPassengerId, p.passengerId]));
      const pasajeros = pasajerosOferta
        .filter((p) => p.ofertaId === orden.ofertaId)
        .map((p) => ({
          id: p.idCliente,
          tipo: p.tipo,
          nombres: p.nombres,
          apellidos: p.apellidos,
          eTicket: ticketDe.get(reservaDe.get(p.idCliente)) ?? null,
          asientos: (p.asientos ?? []).map((a) => ({ vueloId: a.vueloId, asiento: a.asiento })),
        }));
      result.set(orden.ordenId, {
        tramos,
        pasajeros,
        pago: pagos.find((p) => p.ordenId === orden.ordenId) ?? null,
        historial: historiales.filter((h) => h.ordenId === orden.ordenId),
      });
    }
    return result;
  }

  private async nuevoNumero(manager: EntityManager): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      let suffix = '';
      for (let i = 0; i < 10; i++) suffix += ORDER_ALPHABET[randomInt(ORDER_ALPHABET.length)];
      const numeroOrden = `ORD-${suffix}`;
      if (!(await manager.exists(Orden, { where: { numeroOrden } }))) return numeroOrden;
    }
    throw new ProblemDetailsException(HttpStatus.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE', 'Could not allocate an order number', 'Please try again.');
  }
}
