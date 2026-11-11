import { HttpStatus } from '@nestjs/common';
import { ProblemDetailsException } from './problem-details.exception';
import { seatExists } from './seat-grid';

/** A seat of a flight segment, as the contract names it (`segmentId` is the flight id). */
export interface SeatRef {
  segmentId: string;
  seatNumber: string;
}

/** What the seat rules need to know about a flight. */
export interface SeatFlight {
  id: string;
  capacidadTotal: number;
  codigoVuelo: string;
}

export interface SeatRuleWording {
  /** Status of "the segment is not one of the flights": the booking answers 422, the hold 400. */
  segmentStatus: HttpStatus;
  /** `invalid-params` name of the segment field, e.g. `passengers.assignedSeats.segmentId`. */
  segmentField: string;
  /** What the flights belong to, for the messages: `hold`, `offer`… */
  owner: string;
  /** Detail of a seat listed twice. */
  duplicateDetail: (seatNumber: string) => string;
}

/**
 * The checks every seat pick shares, whoever asks for it (a booking or a hold): the segment is one of the given
 * flights, the seat exists in that flight's cabin and it is not requested twice. `requested` collects the seats
 * seen so far (`segmentId:seatNumber`), so the caller can run it seat by seat. Pure: it reads no database, so
 * whether the seat is still free is the caller's business.
 */
export function assertSeatPick(seat: SeatRef, flights: SeatFlight[], requested: Set<string>, wording: SeatRuleWording): SeatFlight {
  const flight = flights.find((f) => f.id === seat.segmentId);
  if (!flight) {
    throw new ProblemDetailsException(wording.segmentStatus, 'VALIDATION_FAILED', `Seat segment not part of the ${wording.owner}`, `segmentId ${seat.segmentId} is not part of this ${wording.owner}.`, [
      { name: wording.segmentField, reason: `not part of the ${wording.owner}` },
    ]);
  }
  if (!seatExists(flight.capacidadTotal, seat.seatNumber)) {
    throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'SEAT_CABIN_MISMATCH', 'Seat does not exist', `Seat ${seat.seatNumber} does not exist on flight ${flight.codigoVuelo}.`);
  }
  const key = seatKey(seat);
  if (requested.has(key)) {
    throw new ProblemDetailsException(HttpStatus.CONFLICT, 'SEAT_TAKEN', 'Seat requested twice', wording.duplicateDetail(seat.seatNumber));
  }
  requested.add(key);
  return flight;
}

/**
 * The seats a hold sets aside (`assignedSeats` of the hold request): each one passes `assertSeatPick` against the
 * flights of the offer, and no segment gets more seats than passengers that take one (lap infants take none).
 */
export function assertHoldSeats(seats: SeatRef[], flights: SeatFlight[], seatsPerSegment: number): void {
  const requested = new Set<string>();
  const perSegment = new Map<string, number>();
  for (const seat of seats) {
    assertSeatPick(seat, flights, requested, {
      segmentStatus: HttpStatus.BAD_REQUEST,
      segmentField: 'assignedSeats.segmentId',
      owner: 'offer',
      duplicateDetail: (seatNumber) => `Seat ${seatNumber} is listed more than once.`,
    });
    const count = (perSegment.get(seat.segmentId) ?? 0) + 1;
    perSegment.set(seat.segmentId, count);
    if (count > seatsPerSegment) {
      throw new ProblemDetailsException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VALIDATION_FAILED',
        'Too many seats',
        `The hold is for ${seatsPerSegment} passenger(s) that take a seat, but more seats were requested on segment ${seat.segmentId}.`,
        [{ name: 'assignedSeats', reason: 'more seats on a segment than seat-taking passengers' }],
      );
    }
  }
}

export function seatKey(seat: SeatRef): string {
  return `${seat.segmentId}:${seat.seatNumber}`;
}
