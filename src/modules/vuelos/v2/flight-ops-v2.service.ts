import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager } from 'typeorm';
import { DomainEventBus } from '../common/domain-event-bus';
import { toIso, utcDayRange } from '../common/date.util';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { checkInWindow } from '../common/postsale-rules';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { AdminService } from '../ecommerce/admin/admin.service';
import { Booking } from '../entities/booking.entity';
import { CheckIn } from '../entities/check-in.entity';
import { FlightHold } from '../entities/flight-hold.entity';
import { FlightHoldItem } from '../entities/flight-hold-item.entity';
import { Vuelo } from '../entities/vuelo.entity';
import { FlightStatusService } from '../services/flight-status.service';
import { FlightOperationalStatus, FlightStatusUpdateRequestDto, OperationsQueryDto } from './dto-v2';

/** Which operational statuses a flight may move to from each one (staying in the same one only updates the details). */
const TRANSITIONS: Record<FlightOperationalStatus, FlightOperationalStatus[]> = {
  SCHEDULED: ['SCHEDULED', 'DELAYED', 'BOARDING', 'DEPARTED', 'CANCELLED', 'DIVERTED'],
  DELAYED: ['DELAYED', 'SCHEDULED', 'BOARDING', 'DEPARTED', 'CANCELLED', 'DIVERTED'],
  BOARDING: ['BOARDING', 'DELAYED', 'DEPARTED', 'CANCELLED'],
  DEPARTED: ['DEPARTED', 'ARRIVED', 'DIVERTED'],
  DIVERTED: ['DIVERTED', 'ARRIVED'],
  ARRIVED: [],
  CANCELLED: [],
};

const LOW_AVAILABILITY_RATIO = 0.1;
const OVERBOOKING_RISK_RATIO = 0.98;

@Injectable()
export class FlightOpsV2Service {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly flightStatus: FlightStatusService,
    private readonly admin: AdminService,
    private readonly events: DomainEventBus,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  /** PATCH /flights/{flightNumber}/status: validates the transition, stores the detail, announces `flight.status_changed`. */
  async updateStatus(flightNumber: string, request: FlightStatusUpdateRequestDto) {
    const { start, end } = utcDayRange(request.date);
    const vuelo = await this.dataSource.manager
      .createQueryBuilder(Vuelo, 'v')
      .where('v."codigoVuelo" = :flightNumber AND v."fechaSalida" >= :start AND v."fechaSalida" < :end', { flightNumber, start, end })
      .getOne();
    if (!vuelo) {
      throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'FLIGHT_STATUS_NOT_AVAILABLE', 'Vuelo no encontrado', `No opera el vuelo ${flightNumber} el ${request.date}.`);
    }

    const current = (await this.flightStatus.getStatus(flightNumber, request.date)).status as FlightOperationalStatus;
    if (!TRANSITIONS[current].includes(request.status)) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'INVALID_STATUS_TRANSITION', 'Transición de estado no permitida', `Un vuelo ${current} no puede pasar a ${request.status}.`);
    }
    if (request.status === 'DELAYED' && !request.estimatedDepartureAt) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Falta la salida estimada', 'Un vuelo DELAYED necesita estimatedDepartureAt.', [
        { name: 'estimatedDepartureAt', reason: 'required when status is DELAYED' },
      ]);
    }

    let affectedBookingIds: string[];
    let ownerIds: string[];
    if (request.status === 'CANCELLED') {
      const before = await this.bookingsOf(this.dataSource.manager, vuelo.id);
      // The cancellation (full refunds, inventory, booking.cancelled per booking, flight.cancelled) is the back-office one.
      await this.admin.cancelarVuelo(vuelo.id, request.reason);
      affectedBookingIds = before.map((b) => b.bookingId);
      ownerIds = [...new Set(before.map((b) => b.ownerId))];
    } else {
      await this.dataSource.transaction(async (manager) => {
        const row = await manager.findOneOrFail(Vuelo, { where: { id: vuelo.id }, lock: { mode: 'pessimistic_write' }, loadEagerRelations: false });
        const scheduled = new Date(row.fechaSalida).getTime();
        row.estado = request.status;
        row.estadoActualizadoEn = new Date();
        if (request.status === 'SCHEDULED') {
          row.retrasoMinutos = null;
          row.salidaEstimada = null;
          row.llegadaEstimada = null;
        }
        if (request.estimatedDepartureAt) {
          row.salidaEstimada = new Date(request.estimatedDepartureAt);
          row.retrasoMinutos = Math.max(0, Math.round((row.salidaEstimada.getTime() - scheduled) / 60_000));
        }
        if (request.estimatedArrivalAt) row.llegadaEstimada = new Date(request.estimatedArrivalAt);
        else if (row.salidaEstimada && request.estimatedDepartureAt) {
          row.llegadaEstimada = new Date(new Date(row.fechaLlegada).getTime() + (row.retrasoMinutos ?? 0) * 60_000);
        }
        if (request.departureGate !== undefined) row.puertaSalida = request.departureGate;
        await manager.save(row);
      });
      const affected = await this.bookingsOf(this.dataSource.manager, vuelo.id);
      affectedBookingIds = affected.map((b) => b.bookingId);
      ownerIds = [...new Set(affected.map((b) => b.ownerId))];
    }

    const flight = await this.flightStatus.getStatus(flightNumber, request.date);
    const event = await this.events.publish('flight.status_changed', vuelo.id, {
      vueloId: vuelo.id,
      codigoVuelo: vuelo.codigoVuelo,
      flightNumber: vuelo.codigoVuelo,
      date: request.date,
      status: request.status,
      previousStatus: current,
      delayMinutes: flight.delayMinutes ?? null,
      estimatedDepartureAt: flight.departure.estimatedAt ?? null,
      estimatedArrivalAt: flight.arrival.estimatedAt ?? null,
      departureGate: flight.departure.gate ?? null,
      reason: request.reason ?? null,
      destination: vuelo.destinoIATA,
      affectedBookingIds,
      ownerIds,
    });
    return { previousStatus: current, flight, affectedBookings: affectedBookingIds.length, eventId: event.id };
  }

  /** GET /operaciones/vuelos: occupancy per flight and cabin, active holds, alerts. */
  async operations(query: OperationsQueryDto) {
    const { start, end } = utcDayRange(query.date);
    const limit = query.limit ?? 20;
    const manager = this.dataSource.manager;

    const base = () => {
      const qb = manager.createQueryBuilder(Vuelo, 'v').where('v."fechaSalida" >= :start AND v."fechaSalida" < :end', { start, end });
      if (query.origin) qb.andWhere('v."origenIATA" = :origin', { origin: query.origin });
      if (query.destination) qb.andWhere('v."destinoIATA" = :destination', { destination: query.destination });
      return qb;
    };
    const totalFlights = await base().getCount();

    const page = base().orderBy('v."fechaSalida"', 'ASC').addOrderBy('v.id', 'ASC').take(limit + 1);
    if (query.cursor) {
      const [at, id] = Buffer.from(query.cursor, 'base64url').toString('utf8').split('|');
      page.andWhere(new Brackets((w) => w.where('v."fechaSalida" > :at', { at }).orWhere('v."fechaSalida" = :at AND v.id > :id', { at, id })));
    }
    let rows = await page.getMany();
    const hasMore = rows.length > limit;
    rows = rows.slice(0, limit);

    const ids = rows.map((v) => v.id);
    const held = ids.length
      ? await manager
          .createQueryBuilder(FlightHoldItem, 'i')
          .innerJoin(FlightHold, 'h', 'h."holdId" = i."holdId"')
          .select('i."vueloId"', 'vueloId')
          .addSelect('SUM(i.seats)', 'seats')
          .addSelect('COUNT(DISTINCT i."holdId")', 'holds')
          .addSelect('MIN(h."expiresAt")', 'nextExpiry')
          .where('i."vueloId" IN (:...ids) AND h.status = \'HELD\' AND h."expiresAt" > :now', { ids, now: new Date() })
          .groupBy('i."vueloId"')
          .getRawMany<{ vueloId: string; seats: string; holds: string; nextExpiry: Date }>()
      : [];
    const checkedIn = ids.length
      ? await manager
          .createQueryBuilder(CheckIn, 'c')
          .select('c."vueloId"', 'vueloId')
          .addSelect('COUNT(*)', 'total')
          .where('c."vueloId" IN (:...ids) AND c.seat IS NOT NULL', { ids })
          .groupBy('c."vueloId"')
          .getRawMany<{ vueloId: string; total: string }>()
      : [];

    const items = [];
    for (const vuelo of rows) {
      const status = (await this.flightStatus.getStatus(vuelo.codigoVuelo, query.date)).status as FlightOperationalStatus;
      if (query.status && status !== query.status) continue;
      const heldRow = held.find((h) => h.vueloId === vuelo.id);
      const heldSeats = Number(heldRow?.seats ?? 0);
      const checked = Number(checkedIn.find((c) => c.vueloId === vuelo.id)?.total ?? 0);
      const sold = Math.max(0, vuelo.capacidadTotal - vuelo.asientosDisponibles - heldSeats);
      const loadFactor = vuelo.capacidadTotal > 0 ? Math.round(((vuelo.capacidadTotal - vuelo.asientosDisponibles) / vuelo.capacidadTotal) * 100) / 100 : 0;
      const open = checkInWindow(new Date(vuelo.fechaSalida), new Date(), this.config.postSale.checkInOpensHours, this.config.postSale.checkInClosesHours) === 'OPEN';

      const alerts: { code: string; severity: 'INFO' | 'WARNING' | 'CRITICAL'; message: string }[] = [];
      if (status === 'CANCELLED') alerts.push({ code: 'CANCELLED', severity: 'CRITICAL', message: `El vuelo ${vuelo.codigoVuelo} está cancelado.` });
      if (status === 'DELAYED') alerts.push({ code: 'DELAYED', severity: 'INFO', message: `Demora de ${vuelo.retrasoMinutos ?? 0} min.` });
      if (loadFactor >= OVERBOOKING_RISK_RATIO) alerts.push({ code: 'OVERBOOKING_RISK', severity: 'CRITICAL', message: 'Ocupación al límite de la capacidad.' });
      else if (vuelo.asientosDisponibles / vuelo.capacidadTotal <= LOW_AVAILABILITY_RATIO) alerts.push({ code: 'LOW_AVAILABILITY', severity: 'WARNING', message: `Quedan ${vuelo.asientosDisponibles} asientos.` });
      if (open) alerts.push({ code: 'CHECKIN_OPEN', severity: 'INFO', message: 'El check-in está abierto.' });

      items.push({
        flightNumber: vuelo.codigoVuelo,
        date: query.date,
        origin: vuelo.origenIATA,
        destination: vuelo.destinoIATA,
        departureAt: toIso(vuelo.fechaSalida),
        status,
        aircraft: null,
        totalSeats: vuelo.capacidadTotal,
        loadFactor,
        cabins: [
          {
            cabinClass: 'ECONOMY',
            totalSeats: vuelo.capacidadTotal,
            seatsByStatus: {
              AVAILABLE: vuelo.asientosDisponibles,
              HELD: heldSeats,
              BOOKED: 0,
              TICKETED: Math.max(0, sold - checked),
              CHECKED_IN: status === 'DEPARTED' || status === 'ARRIVED' ? 0 : checked,
              BOARDED: status === 'DEPARTED' || status === 'ARRIVED' ? checked : 0,
            },
          },
        ],
        activeHolds: Number(heldRow?.holds ?? 0),
        nextHoldExpiryAt: heldRow?.nextExpiry ? toIso(heldRow.nextExpiry) : null,
        checkInOpen: open,
        alerts,
      });
    }

    const last = rows[rows.length - 1];
    return {
      date: query.date,
      totalFlights,
      nextCursor: hasMore && last ? Buffer.from(`${new Date(last.fechaSalida).toISOString()}|${last.id}`).toString('base64url') : null,
      items,
    };
  }

  /** Confirmed bookings that have the flight (through their hold). */
  private async bookingsOf(manager: EntityManager, vueloId: string): Promise<Booking[]> {
    return manager
      .createQueryBuilder(Booking, 'b')
      .innerJoin(FlightHoldItem, 'i', 'i."holdId" = b."holdId"')
      .where('i."vueloId" = :vueloId AND b.status = \'CONFIRMED\'', { vueloId })
      .getMany();
  }
}
