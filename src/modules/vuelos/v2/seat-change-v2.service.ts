import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AuthClaims } from '../auth/token.service';
import { mapBookingUniqueViolation } from '../common/db-errors';
import { DomainEventBus } from '../common/domain-event-bus';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { seatExists } from '../common/seat-grid';
import { formatMinorUnits } from '../common/money.util';
import { CheckIn } from '../entities/check-in.entity';
import { SeatAssignment } from '../entities/seat-assignment.entity';
import { BookingContextService } from '../services/booking-context.service';
import { IdempotencyService } from '../services/idempotency.service';
import { SeatChangeRequestDto } from './dto-v2';
import { bookingLinks, Links } from './v2-links';

export interface SeatChangeResponse {
  bookingId: string;
  seats: { passengerId: string; segmentId: string; previousSeatNumber: string | null; seatNumber: string; status: 'TICKETED' | 'BOOKED' }[];
  amountCharged: { currency: string; total: string };
  _links: Links;
}

interface SeatChangeOutcome {
  response: SeatChangeResponse;
  event: Record<string, unknown>;
}

/**
 * PUT /bookings/{id}/seats of contract v2: moves passengers to other seats of the same cabin, all or none. The seat
 * left goes back to the map; the unique (flight, seat) index is the last word on a race. Seats are free in this phase,
 * so nothing is charged and a `payment` is accepted but not used.
 */
@Injectable()
export class SeatChangeV2Service {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: BookingContextService,
    private readonly idempotency: IdempotencyService,
    private readonly events: DomainEventBus,
  ) {}

  async changeSeats(auth: AuthClaims, idempotencyKey: string, bookingId: string, request: SeatChangeRequestDto): Promise<SeatChangeResponse> {
    const outcome = await this.idempotency.execute<SeatChangeOutcome>(
      { key: idempotencyKey, route: `PUT /bookings/${bookingId}/seats`, ownerId: auth.ownerId, body: request },
      HttpStatus.OK,
      async (manager) => {
        try {
          const context = await this.context.load(manager, auth.ownerId, bookingId, { lock: true });
          this.context.assertConfirmed(context.booking);

          const taken = new Set<string>();
          const changes: SeatChangeResponse['seats'] = [];
          for (const item of request.seats) {
            const passenger = this.context.passengerOf(context, item.passengerId, 'seats.passengerId');
            const leg = context.legs.find((l) => l.vueloId === item.segmentId);
            if (!leg) {
              throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Segmento ajeno a la reserva', `El segmento ${item.segmentId} no pertenece a la reserva ${bookingId}.`, [
                { name: 'seats.segmentId', reason: 'does not belong to the booking' },
              ]);
            }
            if (passenger.passengerType === 'INFANT') {
              throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'INFANT_SEAT_NOT_ALLOWED', 'Un infante no ocupa asiento', `El infante ${item.passengerId} viaja en brazos.`);
            }
            if (!seatExists(leg.vuelo.capacidadTotal, item.seatNumber)) {
              throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'SEAT_CABIN_MISMATCH', 'El asiento no existe en la cabina', `El asiento ${item.seatNumber} no existe en el vuelo ${leg.vuelo.codigoVuelo}.`);
            }
            if (new Date(leg.vuelo.fechaSalida).getTime() <= Date.now()) {
              throw new ProblemDetailsException(HttpStatus.CONFLICT, 'CUTOFF_PASSED', 'El vuelo ya salió', `El vuelo ${leg.vuelo.codigoVuelo} ya salió: no se pueden cambiar asientos.`);
            }
            if (await manager.exists(CheckIn, { where: { bookingId, passengerId: passenger.passengerId, vueloId: leg.vueloId } })) {
              throw new ProblemDetailsException(HttpStatus.CONFLICT, 'CUTOFF_PASSED', 'Check-in ya realizado', `El pasajero ${item.passengerId} ya hizo check-in en ${leg.vuelo.codigoVuelo}: el asiento no se puede cambiar.`);
            }
            const key = `${item.segmentId}:${item.seatNumber}`;
            if (taken.has(key)) {
              throw new ProblemDetailsException(HttpStatus.CONFLICT, 'SEAT_TAKEN', 'Asiento repetido', `El asiento ${item.seatNumber} se pidió para más de un pasajero.`);
            }
            taken.add(key);

            const current = await manager.findOne(SeatAssignment, { where: { bookingId, passengerId: passenger.passengerId, vueloId: leg.vueloId } });
            changes.push({ passengerId: item.passengerId, segmentId: item.segmentId, previousSeatNumber: current?.seatNumber ?? null, seatNumber: item.seatNumber, status: 'TICKETED' });
          }

          // A seat held by another booking is taken; one held by a passenger of this booking is free only if that passenger leaves it in this same request (a swap).
          const leaving = new Set(changes.filter((c) => c.previousSeatNumber !== c.seatNumber).map((c) => `${c.segmentId}:${c.previousSeatNumber}`));
          for (const change of changes.filter((c) => c.previousSeatNumber !== c.seatNumber)) {
            const occupied = await manager.findOne(SeatAssignment, { where: { vueloId: change.segmentId, seatNumber: change.seatNumber } });
            if (occupied && !(occupied.bookingId === bookingId && leaving.has(`${change.segmentId}:${change.seatNumber}`))) {
              throw new ProblemDetailsException(HttpStatus.CONFLICT, 'SEAT_TAKEN', 'Asiento ocupado', `El asiento ${change.seatNumber} ya está ocupado.`);
            }
          }

          // Applied in two passes so two passengers of the booking can swap seats under the unique (flight, seat) index.
          const rows = await manager.find(SeatAssignment, { where: { bookingId } });
          const moving = changes.filter((c) => c.previousSeatNumber !== c.seatNumber);
          for (const change of moving) {
            const passenger = this.context.passengerOf(context, change.passengerId, 'seats.passengerId');
            const row = rows.find((r) => r.passengerId === passenger.passengerId && r.vueloId === change.segmentId);
            if (row) await manager.delete(SeatAssignment, { id: row.id });
          }
          for (const change of moving) {
            const passenger = this.context.passengerOf(context, change.passengerId, 'seats.passengerId');
            await manager.save(manager.create(SeatAssignment, { vueloId: change.segmentId, seatNumber: change.seatNumber, bookingId, passengerId: passenger.passengerId }));
          }
          if (moving.length > 0) {
            await this.context.addChange(manager, context.booking, `Cambio de asientos: ${moving.map((c) => `${c.previousSeatNumber ?? '-'}→${c.seatNumber}`).join(', ')}.`);
          }

          const response: SeatChangeResponse = {
            bookingId,
            seats: changes,
            amountCharged: { currency: context.booking.currency, total: formatMinorUnits(0) },
            _links: bookingLinks(bookingId, context.booking.status),
          };
          const event = {
            bookingId,
            pnr: context.booking.pnr,
            ownerId: auth.ownerId,
            status: context.booking.status,
            seats: changes.map(({ passengerId, segmentId, previousSeatNumber, seatNumber }) => ({ passengerId, segmentId, previousSeatNumber, seatNumber })),
            amountCharged: response.amountCharged.total,
            moved: moving.length,
          };
          return { response, event };
        } catch (error) {
          throw mapBookingUniqueViolation(error);
        }
      },
    );
    if (!outcome.replayed && (outcome.result.event.moved as number) > 0) {
      await this.events.publish('booking.seat_changed', bookingId, outcome.result.event);
    }
    return outcome.result.response;
  }
}
