import { randomInt } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Not, Repository } from 'typeorm';
import type { AuthClaims } from '../../auth/token.service';
import { decodeCursor, encodeCursor } from '../../common/cursor.util';
import { toIso } from '../../common/date.util';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import type { BookingDetailResponseDto } from '../../dto/booking.dto';
import { Booking } from '../../entities/booking.entity';
import { money } from '../common/moneda.util';
import { SlidingWindowLimiter, assertWithinLimit } from '../common/rate-limiter';
import { normalizarNombrePasajero } from '../common/texto.util';
import type { Oferta } from '../ofertas/entities/oferta.entity';
import type { Pago } from '../pagos/entities/pago.entity';
import { HistorialOrdenesQueryDto, OrdenViewDto, OrdenesPaginaViewDto, RecuperarOrdenQueryDto } from './dto/ordenes.dto';
import { EstadoOrden, Orden, TRANSICIONES } from './entities/orden.entity';

const ORDER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const orderNotFound = () => new ProblemDetailsException(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found', 'No order matches the data provided.');

/** D09. The commercial record of a purchase: number, state machine, snapshot, history. */
@Injectable()
export class OrdenesService {
  // RF-ORD-010 recovery is public (order number + surname), so it is rate-limited against guessing.
  private readonly recoveryLimiter = new SlidingWindowLimiter(10, 60_000);

  constructor(@InjectRepository(Orden) private readonly ordenes: Repository<Orden>) {}

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
      pasajeros: orden.pasajeros.map((p) => ({ id: p.id, tipo: p.tipo, nombres: p.nombres, apellidos: p.apellidos, eTicket: p.eTicket })),
      // The public recovery answers to a surname and a locator, so it never returns contact data.
      ...(opciones.publica ? {} : { contacto: orden.contacto }),
      pago: { marca: orden.pago.marca, ultimos4: orden.pago.ultimos4, cuotas: orden.pago.cuotas },
      creadaEn: toIso(orden.creadaEn),
      historial: orden.historial,
      _links: { self: `/api/v1/ordenes/${orden.numeroOrden}` },
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
