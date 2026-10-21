import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthClaims } from '../auth/token.service';
import { uniqueViolationColumns } from '../common/db-errors';
import { DomainEventBus } from '../common/domain-event-bus';
import { boardingGroupFor, checkInWindow, firstFreeSeat, hasDeparted } from '../common/postsale-rules';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { buildSeatGrid } from '../common/seat-grid';
import { buildBoardingCode } from '../common/ticket-qr';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { CheckIn } from '../entities/check-in.entity';
import { SeatAssignment } from '../entities/seat-assignment.entity';
import { Ticket } from '../entities/ticket.entity';
import type { BoardingPassListResponseDto, CheckInResponseDto } from '../dto/postventa.dto';
import { BookingContext, BookingContextService } from './booking-context.service';

const SEAT_RETRIES = 5;

/**
 * Check-in and boarding passes. Check-in is naturally idempotent (a passenger already checked in on a flight keeps
 * the row), so it needs no Idempotency-Key. Check-ins of one flight are serialised with an advisory lock, which
 * keeps the boarding positions a clean 1, 2, 3... in order of arrival and the automatic seats free of races.
 */
@Injectable()
export class CheckInService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: BookingContextService,
    private readonly events: DomainEventBus,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  async checkIn(auth: AuthClaims, bookingId: string): Promise<CheckInResponseDto> {
    const result = await this.dataSource.transaction(async (manager) => {
      const context = await this.context.load(manager, auth.ownerId, bookingId, { lock: true });
      this.context.assertConfirmed(context.booking);

      const now = new Date();
      const { checkInOpensHours, checkInClosesHours } = this.config.postSale;
      const windows = context.legs.map((leg) => checkInWindow(new Date(leg.vuelo.fechaSalida), now, checkInOpensHours, checkInClosesHours));
      if (!windows.includes('OPEN')) {
        const first = context.legs.map((l) => new Date(l.vuelo.fechaSalida)).sort((a, b) => a.getTime() - b.getTime())[0];
        if (hasDeparted(first, now)) {
          throw new ProblemDetailsException(HttpStatus.CONFLICT, 'FLIGHT_ALREADY_DEPARTED', 'Flight already departed', 'The flight of this booking has already departed.');
        }
        throw new ProblemDetailsException(
          HttpStatus.CONFLICT,
          'CHECK_IN_NOT_AVAILABLE',
          'Check-in not available',
          windows.includes('NOT_YET')
            ? `Check-in opens ${checkInOpensHours} h before departure and closes ${checkInClosesHours} h before.`
            : `Check-in closed ${checkInClosesHours} h before departure.`,
        );
      }

      let created = 0;
      for (const [index, leg] of context.legs.entries()) {
        if (windows[index] !== 'OPEN') continue;
        // One check-in at a time per flight (released with the transaction).
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [leg.vueloId]);
        for (const passenger of context.passengers) {
          const exists = await manager.exists(CheckIn, { where: { bookingId, passengerId: passenger.passengerId, vueloId: leg.vueloId } });
          if (exists) continue;
          const seat = passenger.passengerType === 'INFANT' ? null : await this.seatFor(manager, bookingId, passenger.passengerId, leg.vueloId, leg.vuelo.capacidadTotal);
          const position = (await manager.count(CheckIn, { where: { vueloId: leg.vueloId } })) + 1;
          await manager.save(manager.create(CheckIn, { bookingId, passengerId: passenger.passengerId, vueloId: leg.vueloId, seat, boardingGroup: boardingGroupFor(leg.fareBrand), boardingPosition: position }));
          created += 1;
        }
      }

      const rows = await manager.find(CheckIn, { where: { bookingId } });
      return { context, rows, created };
    });

    const response = this.toResponse(result.context, result.rows);
    if (result.created > 0) {
      await this.events.publish('booking.checked_in', bookingId, {
        bookingId,
        pnr: result.context.booking.pnr,
        ownerId: auth.ownerId,
        status: result.context.booking.status,
        checkedInPassengers: result.created,
      });
    }
    return response;
  }

  async boardingPasses(ownerId: string, bookingId: string): Promise<BoardingPassListResponseDto> {
    const manager = this.dataSource.manager;
    const context = await this.context.load(manager, ownerId, bookingId);
    this.context.assertConfirmed(context.booking);
    const rows = await manager.find(CheckIn, { where: { bookingId } });
    if (rows.length === 0) {
      throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'BOARDING_PASS_NOT_AVAILABLE', 'Boarding pass not available', 'Check in first: boarding passes are issued by the check-in.');
    }
    const tickets = await manager.find(Ticket, { where: { bookingId } });

    const boardingPasses = rows
      .filter((row) => row.seat)
      .map((row) => {
        const leg = context.legs.find((l) => l.vueloId === row.vueloId)!;
        const passenger = context.passengers.find((p) => p.passengerId === row.passengerId)!;
        const ticket = tickets.find((t) => t.passengerId === row.passengerId)!;
        return {
          departure: new Date(leg.vuelo.fechaSalida).getTime(),
          pass: {
            passengerId: passenger.clientPassengerId,
            segmentId: row.vueloId,
            seat: row.seat as string,
            boardingGroup: row.boardingGroup,
            boardingPosition: String(row.boardingPosition),
            barcode: buildBoardingCode(this.config.jwtSecret, ticket.eTicketNumber, context.booking.pnr, leg.vuelo.codigoVuelo, row.seat as string),
            barcodeType: 'QR',
          },
        };
      })
      .sort((a, b) => a.departure - b.departure || a.pass.passengerId.localeCompare(b.pass.passengerId))
      .map((item) => item.pass);

    return { bookingId, boardingPasses };
  }

  /** The seat the passenger chose, or the first free one of the cabin (retried if another booking takes it first). */
  private async seatFor(manager: EntityManager, bookingId: string, passengerId: string, vueloId: string, capacity: number): Promise<string> {
    const chosen = await manager.findOne(SeatAssignment, { where: { bookingId, passengerId, vueloId } });
    if (chosen) return chosen.seatNumber;

    const cabin = buildSeatGrid(capacity).flatMap((row) => row.seats.map((seat) => seat.seatNumber));
    for (let attempt = 0; attempt < SEAT_RETRIES; attempt += 1) {
      const taken = new Set((await manager.find(SeatAssignment, { where: { vueloId } })).map((s) => s.seatNumber));
      const seat = firstFreeSeat(cabin, taken);
      if (!seat) {
        throw new ProblemDetailsException(HttpStatus.CONFLICT, 'CHECK_IN_FAILED', 'No seat available', 'The cabin is full: no seat could be assigned.');
      }
      try {
        await manager.transaction(async (inner) => inner.save(inner.create(SeatAssignment, { vueloId, seatNumber: seat, bookingId, passengerId })));
        return seat;
      } catch (error) {
        if (uniqueViolationColumns(error) === null) throw error; // only a lost race for the seat is retried
      }
    }
    throw new ProblemDetailsException(HttpStatus.CONFLICT, 'CHECK_IN_FAILED', 'Seat assignment failed', 'Could not assign a seat; try again.');
  }

  private toResponse(context: BookingContext, rows: CheckIn[]): CheckInResponseDto {
    const checkedInPassengers = context.passengers.map((passenger) => {
      const segments = context.legs.map((leg) => {
        const row = rows.find((r) => r.passengerId === passenger.passengerId && r.vueloId === leg.vueloId);
        return { segmentId: leg.vueloId, seat: row?.seat ?? null, status: row ? 'CHECKED_IN' : 'NOT_CHECKED_IN' };
      });
      return { passengerId: passenger.clientPassengerId, status: segments.every((s) => s.status === 'CHECKED_IN') ? 'CHECKED_IN' : 'NOT_CHECKED_IN', segments };
    });
    const done = checkedInPassengers.every((p) => p.status === 'CHECKED_IN');
    const some = checkedInPassengers.some((p) => p.segments.some((s) => s.status === 'CHECKED_IN'));
    return { bookingId: context.booking.bookingId, status: done ? 'COMPLETED' : some ? 'IN_PROGRESS' : 'AVAILABLE', checkedInPassengers };
  }
}
