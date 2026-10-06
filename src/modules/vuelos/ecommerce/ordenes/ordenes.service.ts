import { randomInt } from 'node:crypto';
import { HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Not, Repository } from 'typeorm';
import type { AuthClaims } from '../../auth/token.service';
import { decodeCursor, encodeCursor } from '../../common/cursor.util';
import { DomainEvent, DomainEventBus } from '../../common/domain-event-bus';
import { toIso } from '../../common/date.util';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { buildTicketCode, verifyTicketCode } from '../../common/ticket-qr';
import { VUELOS_CONFIG, VuelosConfig } from '../../common/vuelos-config';
import type { BookingDetailResponseDto } from '../../dto/booking.dto';
import { Booking } from '../../entities/booking.entity';
import { Ticket } from '../../entities/ticket.entity';
import { Vuelo } from '../../entities/vuelo.entity';
import { money } from '../common/moneda.util';
import { SlidingWindowLimiter, assertWithinLimit } from '../common/rate-limiter';
import { normalizarNombrePasajero } from '../common/texto.util';
import type { Oferta } from '../ofertas/entities/oferta.entity';
import type { Pago } from '../pagos/entities/pago.entity';
import { HistorialOrdenesQueryDto, OrdenViewDto, OrdenesPaginaViewDto, RecuperarOrdenQueryDto, VerificacionBilleteViewDto } from './dto/ordenes.dto';
import { EstadoOrden, Orden, TRANSICIONES } from './entities/orden.entity';

const ORDER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const orderNotFound = () => new ProblemDetailsException(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found', 'No order matches the data provided.');

/** D09. The commercial record of a purchase: number, state machine, snapshot, history. */
@Injectable()
export class OrdenesService implements OnModuleInit {
  // RF-ORD-010 recovery is public (order number + surname), so it is rate-limited against guessing.
  private readonly recoveryLimiter = new SlidingWindowLimiter(10, 60_000);

  // The ticket check is public too (anyone holding a QR can open it), so it is limited per address as well.
  private readonly verificationLimiter = new SlidingWindowLimiter(30, 60_000);

  constructor(
    @InjectRepository(Orden) private readonly ordenes: Repository<Orden>,
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(Vuelo) private readonly vuelos: Repository<Vuelo>,
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

  /** The reservation was cancelled: the order enters the refund state (EMITIDA -> DEVOLUCION_EN_CURSO). */
  async alCancelarReserva(event: DomainEvent): Promise<void> {
    const { bookingId } = event.payload as { bookingId?: string };
    const orden = bookingId ? await this.ordenes.findOne({ where: { bookingId } }) : null;
    if (!orden || orden.estado !== 'EMITIDA') return;
    this.transicionar(orden, 'DEVOLUCION_EN_CURSO', 'Reserva cancelada');
    await this.ordenes.save(orden);
  }

  /** The money went back to the card: the order is REEMBOLSADA (passing through the refund state if it had not yet). */
  async alReembolsar(event: DomainEvent): Promise<void> {
    const { bookingId, ordenId } = event.payload as { bookingId?: string; ordenId?: string };
    const orden = bookingId ? await this.ordenes.findOne({ where: { bookingId } }) : ordenId ? await this.ordenes.findOne({ where: { ordenId } }) : null;
    if (!orden) return;
    if (orden.estado === 'EMITIDA') this.transicionar(orden, 'DEVOLUCION_EN_CURSO', 'Reserva cancelada');
    if (orden.estado !== 'DEVOLUCION_EN_CURSO') return;
    this.transicionar(orden, 'REEMBOLSADA', 'Reembolso ejecutado');
    await this.ordenes.save(orden);
  }

  /** A leg moved to another flight (by the traveller or because the airline rescheduled): the order's leg follows. */
  async alCambiarReserva(event: DomainEvent): Promise<void> {
    const { bookingId, fromVueloId, toVueloId } = event.payload as { bookingId?: string; fromVueloId?: string; toVueloId?: string };
    if (!bookingId || !fromVueloId || !toVueloId) return;
    const orden = await this.ordenes.findOne({ where: { bookingId } });
    const vuelo = await this.vuelos.findOne({ where: { id: toVueloId } });
    const trayecto = orden?.trayectos.find((t) => t.itinerarioId === fromVueloId);
    if (!orden || !vuelo || !trayecto || orden.estado !== 'EMITIDA') return;

    this.transicionar(orden, 'MODIFICADA', 'Cambio de vuelo');
    orden.trayectos = orden.trayectos.map((t) =>
      t === trayecto
        ? {
            ...t,
            itinerarioId: vuelo.id,
            numeroVuelo: vuelo.codigoVuelo,
            operadorCodigo: vuelo.codigoAerolinea,
            operadorNombre: vuelo.aerolinea,
            origen: vuelo.origenIATA,
            destino: vuelo.destinoIATA,
            salida: toIso(vuelo.fechaSalida),
            llegada: toIso(vuelo.fechaLlegada),
            duracionMinutos: vuelo.durationMinutes,
          }
        : t,
    );
    // The seats picked for the old flight do not travel to the new one.
    orden.pasajeros = orden.pasajeros.map((p) => ({ ...p, asientos: p.asientos?.filter((a) => a.trayectoId !== fromVueloId) }));
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

    return {
      valido: ticket.status === 'ISSUED',
      estado: ticket.status,
      pnr: orden.pnr ?? undefined,
      itinerarios: orden.trayectos.map((t) => ({ numeroVuelo: t.numeroVuelo, origen: t.origen, destino: t.destino, salida: t.salida })),
    };
  }

  /** The live order of an offer (a failed, compensated attempt does not count). */
  async deOferta(ofertaId: string): Promise<Orden | null> {
    return this.ordenes.findOne({ where: { ofertaId, estado: Not('FALLIDA_COMPENSADA') } });
  }

  /** Authorised payment => the order exists in state PAGADA (PENDIENTE_PAGO -> PAGADA, SRS §8.5). */
  async crearPagada(manager: EntityManager, oferta: Oferta, pago: Pago): Promise<Orden> {
    const ahora = new Date().toISOString();
    const orden = manager.create(Orden, {
      numeroOrden: await this.nuevoNumero(manager),
      ofertaId: oferta.ofertaId,
      ownerId: oferta.ownerId,
      clienteId: oferta.ownerId.startsWith('guest:') ? null : oferta.ownerId,
      mercado: oferta.mercado,
      moneda: oferta.moneda,
      totalMinor: oferta.totalMinor,
      estado: 'PAGADA',
      canal: 'WEB',
      pago: { pagoId: pago.pagoId, marca: pago.medio.marca, ultimos4: pago.medio.ultimos4, cuotas: pago.cuotas },
      pnr: null,
      bookingId: null,
      trayectos: oferta.trayectos,
      pasajeros: oferta.datosPasajeros!.pasajeros.map((p) => ({ ...p, eTicket: null, ticketId: null })),
      contacto: oferta.datosPasajeros!.contacto,
      facturacion: oferta.facturacion!,
      condicionesAceptadas: oferta.condicionesAceptadas!,
      historial: [
        { estado: 'PENDIENTE_PAGO', en: ahora },
        { estado: 'PAGADA', en: ahora, motivo: 'Pago autorizado' },
      ],
    });
    return manager.save(orden);
  }

  /** RF-ORD-002/003: the PNR and one e-ticket per passenger land on the order. */
  async marcarEmitida(manager: EntityManager, orden: Orden, booking: BookingDetailResponseDto): Promise<Orden> {
    const tickets = booking.tickets ?? [];
    if (tickets.length !== orden.pasajeros.length) {
      throw new Error(`Booking ${booking.bookingId} issued ${tickets.length} ticket(s) for ${orden.pasajeros.length} passenger(s)`);
    }

    this.transicionar(orden, 'EMITIDA', 'Reserva creada y billetes emitidos');
    orden.pnr = booking.pnr;
    orden.bookingId = booking.bookingId;
    // The flight core issues tickets in passenger order, which is the order the booking was built in.
    orden.pasajeros = orden.pasajeros.map((p, index) => ({ ...p, eTicket: tickets[index].eTicketNumber, ticketId: tickets[index].ticketId }));
    return manager.save(orden);
  }

  /**
   * RN-19: the ticket could not be issued after the charge was authorised. The authorisation is
   * voided by the saga; this keeps the failed attempt on record (SRS: OrdenFallidaCompensada).
   */
  async registrarFallida(oferta: Oferta, pago: Pago, motivo: string): Promise<Orden> {
    const ahora = new Date().toISOString();
    return this.ordenes.manager.transaction(async (manager) => {
      const orden = manager.create(Orden, {
        numeroOrden: await this.nuevoNumero(manager),
        ofertaId: oferta.ofertaId,
        ownerId: oferta.ownerId,
        clienteId: oferta.ownerId.startsWith('guest:') ? null : oferta.ownerId,
        mercado: oferta.mercado,
        moneda: oferta.moneda,
        totalMinor: oferta.totalMinor,
        estado: 'FALLIDA_COMPENSADA',
        canal: 'WEB',
        pago: { pagoId: pago.pagoId, marca: pago.medio.marca, ultimos4: pago.medio.ultimos4, cuotas: pago.cuotas },
        pnr: null,
        bookingId: null,
        trayectos: oferta.trayectos,
        pasajeros: oferta.datosPasajeros!.pasajeros.map((p) => ({ ...p, eTicket: null, ticketId: null })),
        contacto: oferta.datosPasajeros!.contacto,
        facturacion: oferta.facturacion!,
        condicionesAceptadas: oferta.condicionesAceptadas!,
        historial: [
          { estado: 'PENDIENTE_PAGO', en: ahora },
          { estado: 'PAGADA', en: ahora, motivo: 'Pago autorizado' },
          { estado: 'FALLIDA_COMPENSADA', en: ahora, motivo },
        ],
      });
      return manager.save(orden);
    });
  }

  /** Applies a state change, refusing anything the SRS state machine does not allow. The caller persists. */
  transicionar(orden: Orden, destino: EstadoOrden, motivo?: string): void {
    if (!TRANSICIONES[orden.estado].includes(destino)) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'INVALID_STATE_TRANSITION', 'Invalid order state change', `An order cannot go from ${orden.estado} to ${destino}.`);
    }
    orden.estado = destino;
    orden.historial = [...orden.historial, { estado: destino, en: new Date().toISOString(), ...(motivo ? { motivo } : {}) }];
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
      throw new ProblemDetailsException(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMIT_EXCEEDED', 'Too many lookups', `Try again in ${limit.retryAfterSeconds} seconds.`);
    }

    const orden = await this.buscarPorCodigoYApellido(query);
    return this.vista(orden, { publica: true });
  }

  /** The order named by number or PNR whose passengers include that surname, else the same 404 for every miss. */
  private async buscarPorCodigoYApellido(query: RecuperarOrdenQueryDto): Promise<Orden> {
    const orden = await this.ordenes.findOne({ where: query.numero ? { numeroOrden: query.numero } : { pnr: query.pnr } });
    const apellido = normalizarNombrePasajero(query.apellido);
    // People give one surname or both: accept the full surname or any whole word of it, never a fragment.
    const coincide = orden?.pasajeros.some((p) => {
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
      items: page.map((orden) => this.vista(orden)),
      ...(rows.length > limit ? { nextCursor: encodeCursor(page[page.length - 1].creadaEn, page[page.length - 1].ordenId) } : {}),
    };
  }

  vista(orden: Orden, opciones: { publica?: boolean } = {}): OrdenViewDto {
    return {
      ordenId: orden.ordenId,
      numeroOrden: orden.numeroOrden,
      pnr: orden.pnr,
      estado: orden.estado,
      mercado: orden.mercado,
      total: money(orden.totalMinor, orden.moneda),
      itinerarios: orden.trayectos.map((t) => ({
        numeroVuelo: t.numeroVuelo,
        operador: { codigo: t.operadorCodigo, nombre: t.operadorNombre },
        origen: t.origen,
        destino: t.destino,
        salida: t.salida,
        llegada: t.llegada,
        familia: t.familia,
      })),
      pasajeros: orden.pasajeros.map((p) => ({
        id: p.id,
        tipo: p.tipo,
        nombres: p.nombres,
        apellidos: p.apellidos,
        eTicket: p.eTicket,
        ...(p.eTicket && orden.pnr ? { qr: buildTicketCode(this.config.jwtSecret, p.eTicket, orden.pnr) } : {}),
        ...(p.asientos?.length
          ? { asientos: p.asientos.map((a) => ({ numeroVuelo: orden.trayectos.find((t) => t.itinerarioId === a.trayectoId)?.numeroVuelo ?? '', asiento: a.asiento })) }
          : {}),
      })),
      // The public recovery answers to a surname and a locator, so it never returns contact data.
      ...(opciones.publica ? {} : { contacto: orden.contacto, ...(orden.bookingId ? { bookingId: orden.bookingId } : {}) }),
      pago: { marca: orden.pago.marca, ultimos4: orden.pago.ultimos4, cuotas: orden.pago.cuotas },
      creadaEn: toIso(orden.creadaEn),
      historial: orden.historial,
      _links: { self: `/api/v1/ordenes/${orden.numeroOrden}`, ...(!opciones.publica && orden.bookingId ? { reserva: `/api/v1/bookings/${orden.bookingId}` } : {}) },
    };
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
