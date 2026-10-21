import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { decodeCursor, encodeCursor } from '../../common/cursor.util';
import { toIso, utcDayRange } from '../../common/date.util';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { uniqueViolationColumns } from '../../common/db-errors';
import { DomainEventBus } from '../../common/domain-event-bus';
import { buildSeatGrid } from '../../common/seat-grid';
import { BookingContextService } from '../../services/booking-context.service';
import { CancellationService } from '../../services/cancellation.service';
import { Booking } from '../../entities/booking.entity';
import { FlightHold } from '../../entities/flight-hold.entity';
import { SeatAssignment } from '../../entities/seat-assignment.entity';
import { Vuelo } from '../../entities/vuelo.entity';
import { Orden } from '../ordenes/entities/orden.entity';
import { OrdenesService } from '../ordenes/ordenes.service';
import { AdminAccionVueloViewDto, AdminAsientosVueloDto, AdminOrdenViewDto, AdminOrdenesPaginaDto, AdminOrdenesQueryDto, AdminReprogramarVueloDto, AdminVuelosPaginaDto, AdminVuelosQueryDto } from './admin.dto';

/**
 * Back-office read access. The customer-facing APIs are strictly owner-only; this is the single
 * place that reads across owners, and it sits behind the ADMIN role (see the controller).
 */
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Orden) private readonly ordenes: Repository<Orden>,
    @InjectRepository(Vuelo) private readonly vuelos: Repository<Vuelo>,
    @InjectRepository(SeatAssignment) private readonly asientos: Repository<SeatAssignment>,
    @InjectRepository(Booking) private readonly reservas: Repository<Booking>,
    private readonly ordenesService: OrdenesService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly contexto: BookingContextService,
    private readonly cancelaciones: CancellationService,
    private readonly events: DomainEventBus,
  ) {}

  async listarOrdenes(query: AdminOrdenesQueryDto): Promise<AdminOrdenesPaginaDto> {
    const limit = query.limit ?? 25;
    const qb = this.ordenes.createQueryBuilder('o');
    if (query.estado) qb.andWhere('o."estado" = :estado', { estado: query.estado });
    if (query.numero) qb.andWhere('o."numeroOrden" = :numero', { numero: query.numero });
    if (query.pnr) qb.andWhere('o."pnr" = :pnr', { pnr: query.pnr });
    if (query.desde) qb.andWhere('o."creadaEn" >= :desde', { desde: utcDayRange(query.desde).start });
    if (query.hasta) qb.andWhere('o."creadaEn" < :hasta', { hasta: utcDayRange(query.hasta).end });
    if (query.cursor) {
      const { createdAt, id } = decodeCursor(query.cursor);
      qb.andWhere('(o."creadaEn", o."ordenId") < (:cursorAt, :cursorId)', { cursorAt: createdAt, cursorId: id });
    }

    const rows = await qb.orderBy('o."creadaEn"', 'DESC').addOrderBy('o."ordenId"', 'DESC').take(limit + 1).getMany();
    const page = rows.slice(0, limit);
    return {
      items: page.map((orden) => this.vistaAdmin(orden)),
      ...(rows.length > limit ? { nextCursor: encodeCursor(page[page.length - 1].creadaEn, page[page.length - 1].ordenId) } : {}),
    };
  }

  async obtenerOrden(numeroOrden: string): Promise<AdminOrdenViewDto> {
    const orden = await this.ordenes.findOne({ where: { numeroOrden } });
    if (!orden) throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found', `No order ${numeroOrden}.`);
    return this.vistaAdmin(orden);
  }

  async listarVuelos(query: AdminVuelosQueryDto): Promise<AdminVuelosPaginaDto> {
    const limit = query.limit ?? 25;
    const qb = this.vuelos.createQueryBuilder('v');
    if (query.origen) qb.andWhere('v."origenIATA" = :origen', { origen: query.origen });
    if (query.destino) qb.andWhere('v."destinoIATA" = :destino', { destino: query.destino });
    if (query.vuelo) qb.andWhere('v."codigoVuelo" = :vuelo', { vuelo: query.vuelo });
    if (query.fecha) {
      const { start, end } = utcDayRange(query.fecha);
      qb.andWhere('v."fechaSalida" >= :start AND v."fechaSalida" < :end', { start, end });
    } else {
      qb.andWhere('v."fechaSalida" >= :now', { now: new Date() });
    }
    if (query.cursor) {
      const { createdAt, id } = decodeCursor(query.cursor);
      qb.andWhere('(v."fechaSalida", v."id") > (:cursorAt, :cursorId)', { cursorAt: createdAt, cursorId: id });
    }

    const rows = await qb.orderBy('v."fechaSalida"', 'ASC').addOrderBy('v."id"', 'ASC').take(limit + 1).getMany();
    const page = rows.slice(0, limit);
    const reservados = await this.contarAsientosReservados(page.map((v) => v.id));
    return {
      items: page.map((v) => ({
        vueloId: v.id,
        codigoVuelo: v.codigoVuelo,
        aerolinea: v.aerolinea,
        origen: v.origenIATA,
        destino: v.destinoIATA,
        salida: toIso(v.fechaSalida),
        llegada: toIso(v.fechaLlegada),
        duracionMinutos: v.durationMinutes,
        precioBaseUsd: v.precioBase,
        asientosDisponibles: v.asientosDisponibles,
        capacidadTotal: v.capacidadTotal,
        asientosReservados: reservados.get(v.id) ?? 0,
        estado: v.estado,
      })),
      ...(rows.length > limit ? { nextCursor: encodeCursor(page[page.length - 1].fechaSalida, page[page.length - 1].id) } : {}),
    };
  }

  /** How many numbered seats are taken on each of these flights (one grouped query for the whole page). */
  private async contarAsientosReservados(vueloIds: string[]): Promise<Map<string, number>> {
    if (vueloIds.length === 0) return new Map();
    const rows = await this.asientos
      .createQueryBuilder('s')
      .select('s."vueloId"', 'vueloId')
      .addSelect('COUNT(*)::int', 'n')
      .where('s."vueloId" IN (:...ids)', { ids: vueloIds })
      .groupBy('s."vueloId"')
      .getRawMany<{ vueloId: string; n: number }>();
    return new Map(rows.map((r) => [r.vueloId, Number(r.n)]));
  }

  /**
   * The cabin of one flight with every seat already reserved and the booking that holds it. It shows the
   * locator and the order number only: passenger names are encrypted personal data and are not needed here.
   */
  async asientosDeVuelo(vueloId: string): Promise<AdminAsientosVueloDto> {
    const vuelo = await this.vuelos.findOne({ where: { id: vueloId } });
    if (!vuelo) throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Flight not found', `No flight ${vueloId}.`);

    const asignados = await this.asientos.find({ where: { vueloId } });
    const bookingIds = [...new Set(asignados.map((s) => s.bookingId))];
    const reservas = bookingIds.length ? await this.reservas.find({ where: { bookingId: In(bookingIds) }, select: { bookingId: true, pnr: true } }) : [];
    const ordenes = bookingIds.length ? await this.ordenes.find({ where: { bookingId: In(bookingIds) }, select: { bookingId: true, numeroOrden: true } }) : [];
    const pnrDe = new Map(reservas.map((b) => [b.bookingId, b.pnr]));
    const ordenDe = new Map(ordenes.map((o) => [o.bookingId as string, o.numeroOrden]));

    const ocupados = new Set(asignados.map((s) => s.seatNumber));
    const orden = (seat: string) => [Number.parseInt(seat, 10), seat.slice(-1)] as const;
    return {
      vueloId: vuelo.id,
      codigoVuelo: vuelo.codigoVuelo,
      origen: vuelo.origenIATA,
      destino: vuelo.destinoIATA,
      salida: toIso(vuelo.fechaSalida),
      capacidadTotal: vuelo.capacidadTotal,
      reservados: asignados
        .map((s) => ({ asiento: s.seatNumber, pnr: pnrDe.get(s.bookingId) ?? '', numeroOrden: ordenDe.get(s.bookingId) ?? null }))
        .sort((x, y) => {
          const [rx, cx] = orden(x.asiento);
          const [ry, cy] = orden(y.asiento);
          return rx - ry || cx.localeCompare(cy);
        }),
      filas: buildSeatGrid(vuelo.capacidadTotal).map((fila) => ({
        rowNumber: fila.rowNumber,
        seats: fila.seats.map((seat) => ({ seatNumber: seat.seatNumber, isAvailable: !ocupados.has(seat.seatNumber), characteristics: seat.characteristics })),
      })),
    };
  }

  /**
   * The airline cancels a flight. It closes to sales, every confirmed booking that had it is cancelled with a FULL
   * refund (no penalty, whatever the fare), and the subscribers hear `flight.cancelled` and one `booking.cancelled`
   * per booking. The refunds reach the gateway and the e-commerce orders through those events.
   */
  async cancelarVuelo(vueloId: string, motivo?: string): Promise<AdminAccionVueloViewDto> {
    const razon = motivo ? `Vuelo cancelado por la aerolínea: ${motivo}` : 'Vuelo cancelado por la aerolínea';
    const result = await this.dataSource.transaction(async (manager) => {
      const vuelo = await this.vueloAccionable(manager.getRepository(Vuelo), vueloId, true);
      vuelo.estado = 'CANCELLED';
      await manager.save(vuelo);

      const cancelled: { event: Record<string, unknown>; ownerId: string }[] = [];
      for (const booking of await this.reservasDeVuelo(manager, vueloId)) {
        const context = await this.contexto.complete(manager, booking);
        const amounts = await this.cancelaciones.amountsFor(manager, context, 0, true);
        const outcome = await this.cancelaciones.applyCancellation(manager, context, amounts, razon);
        cancelled.push({ event: outcome.event, ownerId: booking.ownerId });
      }
      return { vuelo, cancelled };
    });

    for (const { event } of result.cancelled) {
      await this.events.publish('booking.cancelled', event.bookingId as string, event);
    }
    await this.events.publish('flight.cancelled', vueloId, {
      vueloId,
      codigoVuelo: result.vuelo.codigoVuelo,
      ownerIds: [...new Set(result.cancelled.map((c) => c.ownerId))],
      status: 'CANCELLED',
    });
    return { vueloId, codigoVuelo: result.vuelo.codigoVuelo, estado: 'CANCELLED', salida: toIso(result.vuelo.fechaSalida), reservasAfectadas: result.cancelled.length, eventos: ['flight.cancelled', ...(result.cancelled.length ? ['booking.cancelled'] : [])] };
  }

  /**
   * The airline moves a flight to another departure time (the duration is kept). Every confirmed booking that has it
   * is updated and told (`booking.changed`), and the subscribers hear `flight.schedule_changed`.
   */
  async reprogramarVuelo(vueloId: string, request: AdminReprogramarVueloDto): Promise<AdminAccionVueloViewDto> {
    const nuevaSalida = new Date(request.nuevaSalida);
    if (nuevaSalida.getTime() <= Date.now()) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid departure', 'The new departure must be in the future.', [{ name: 'nuevaSalida', reason: 'must be in the future' }]);
    }
    let result;
    try {
      result = await this.dataSource.transaction(async (manager) => {
        const vuelo = await this.vueloAccionable(manager.getRepository(Vuelo), vueloId, true);
        const anterior = new Date(vuelo.fechaSalida);
        vuelo.fechaSalida = nuevaSalida;
        vuelo.fechaLlegada = new Date(nuevaSalida.getTime() + vuelo.durationMinutes * 60_000);
        await manager.save(vuelo);

        const events: Record<string, unknown>[] = [];
        for (const booking of await this.reservasDeVuelo(manager, vueloId)) {
          const context = await this.contexto.complete(manager, booking);
          const leg = context.legs.find((l) => l.vueloId === vueloId)!;
          leg.vuelo = vuelo;
          const first = context.legs.reduce((x, y) => (new Date(x.vuelo.fechaSalida).getTime() <= new Date(y.vuelo.fechaSalida).getTime() ? x : y));
          booking.origin = first.vuelo.origenIATA;
          booking.destination = first.vuelo.destinoIATA;
          booking.departureAt = first.vuelo.fechaSalida;
          this.contexto.addChange(booking, `Vuelo ${vuelo.codigoVuelo} reprogramado por la aerolínea: salida ${anterior.toISOString()} -> ${nuevaSalida.toISOString()}${request.motivo ? ` (${request.motivo})` : ''}.`);
          await manager.save(booking);
          events.push({
            bookingId: booking.bookingId,
            pnr: booking.pnr,
            ownerId: booking.ownerId,
            status: booking.status,
            itineraryId: leg.itineraryId,
            fromVueloId: vueloId,
            toVueloId: vueloId,
            newDepartureAt: nuevaSalida.toISOString(),
          });
        }
        return { vuelo, events };
      });
    } catch (error) {
      if (uniqueViolationColumns(error) !== null) {
        throw new ProblemDetailsException(HttpStatus.CONFLICT, 'CONFLICT', 'Flight already scheduled', 'Another flight with the same number already departs at that time.');
      }
      throw error;
    }

    for (const event of result.events) {
      await this.events.publish('booking.changed', event.bookingId as string, event);
    }
    await this.events.publish('flight.schedule_changed', vueloId, {
      vueloId,
      codigoVuelo: result.vuelo.codigoVuelo,
      ownerIds: [...new Set(result.events.map((e) => e.ownerId as string))],
      status: 'RESCHEDULED',
      newDepartureAt: nuevaSalida.toISOString(),
    });
    return { vueloId, codigoVuelo: result.vuelo.codigoVuelo, estado: result.vuelo.estado, salida: toIso(result.vuelo.fechaSalida), reservasAfectadas: result.events.length, eventos: ['flight.schedule_changed', ...(result.events.length ? ['booking.changed'] : [])] };
  }

  /** The flight, locked, only if it can still be cancelled or moved (it exists, has not left, is not already cancelled). */
  private async vueloAccionable(repo: Repository<Vuelo>, vueloId: string, lock: boolean): Promise<Vuelo> {
    const vuelo = await repo.findOne({ where: { id: vueloId }, ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
    if (!vuelo) throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Flight not found', `No flight ${vueloId}.`);
    if (vuelo.estado === 'CANCELLED') throw new ProblemDetailsException(HttpStatus.CONFLICT, 'ALREADY_CANCELLED', 'Flight already cancelled', `Flight ${vuelo.codigoVuelo} is already cancelled.`);
    if (new Date(vuelo.fechaSalida).getTime() <= Date.now()) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'FLIGHT_ALREADY_DEPARTED', 'Flight already departed', `Flight ${vuelo.codigoVuelo} has already departed.`);
    }
    return vuelo;
  }

  /** Confirmed bookings whose hold has this flight, locked for the change. */
  private async reservasDeVuelo(manager: import('typeorm').EntityManager, vueloId: string): Promise<Booking[]> {
    // A query builder, not raw SQL: it resolves the table names (and schema) from the entities.
    const rows: { bookingId: string }[] = await manager
      .createQueryBuilder(Booking, 'b')
      .innerJoin(FlightHold, 'h', 'h."holdId" = b."holdId"')
      .select('b."bookingId"', 'bookingId')
      .where("b.\"status\" = 'CONFIRMED'")
      .andWhere('h."inventory" @> :inventory::jsonb', { inventory: JSON.stringify([{ vueloId }]) })
      .orderBy('b."bookingId"')
      .getRawMany();
    const bookings: Booking[] = [];
    for (const row of rows) {
      const booking = await manager.findOne(Booking, { where: { bookingId: row.bookingId }, lock: { mode: 'pessimistic_write' } });
      if (booking && booking.status === 'CONFIRMED') bookings.push(booking);
    }
    return bookings;
  }

  private vistaAdmin(orden: Orden): AdminOrdenViewDto {
    return {
      ...this.ordenesService.vista(orden),
      clienteId: orden.clienteId,
      comprador: orden.clienteId ? 'cliente' : 'invitado',
      canal: orden.canal,
    };
  }
}
