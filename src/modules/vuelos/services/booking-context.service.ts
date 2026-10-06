import { HttpStatus, Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { BaggagePurchase } from '../entities/baggage-purchase.entity';
import { Booking } from '../entities/booking.entity';
import { DateChangeOffer } from '../entities/date-change-offer.entity';
import { FareFamily } from '../entities/fare-family.entity';
import { FlightHold } from '../entities/flight-hold.entity';
import { Passenger } from '../entities/passenger.entity';
import { Vuelo } from '../entities/vuelo.entity';

/** One leg of a booking: the contract-facing itinerary id, the flight behind it and the fare bought for it. */
export interface BookingLeg {
  itineraryId: string;
  vueloId: string;
  vuelo: Vuelo;
  fareBrand: string;
  family: FareFamily;
}

export interface BookingContext {
  booking: Booking;
  hold: FlightHold;
  /** In the order of the hold's selections. */
  legs: BookingLeg[];
  passengers: Passenger[];
}

/**
 * Loads a booking with everything the after-sale operations need (its hold, its legs, its passengers) and
 * enforces ownership. The hold is the link between a booking and its flights: `inventory[i]` and
 * `itinerarySelections[i]` describe the same leg (the hold writes them together, in the same order), so the
 * i-th itinerary id sits on the i-th flight. The booking owner is only ever the verified `sub`.
 */
@Injectable()
export class BookingContextService {
  async load(manager: EntityManager, ownerId: string, bookingId: string, options: { lock?: boolean } = {}): Promise<BookingContext> {
    const booking = await manager.findOne(Booking, { where: { bookingId }, ...(options.lock ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
    if (!booking) {
      throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'BOOKING_NOT_CONFIRMED', 'Booking not found', `Booking ${bookingId} was not found.`);
    }
    if (booking.ownerId !== ownerId) {
      throw new ProblemDetailsException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Booking belongs to another user', 'You do not have access to this booking.');
    }
    return this.complete(manager, booking);
  }

  /** Same data for a booking already loaded (the admin acts on bookings of any owner). */
  async complete(manager: EntityManager, booking: Booking): Promise<BookingContext> {
    const hold = await manager.findOneOrFail(FlightHold, { where: { holdId: booking.holdId } });
    const vuelos = await manager.find(Vuelo, { where: { id: In(hold.inventory.map((i) => i.vueloId)) } });
    const families = await manager.find(FareFamily, { where: { code: In(hold.itinerarySelections.map((s) => s.fareBrand)) } });
    const legs = hold.itinerarySelections.map((selection, index) => {
      const vueloId = hold.inventory[index].vueloId;
      return {
        itineraryId: selection.itineraryId,
        vueloId,
        vuelo: vuelos.find((v) => v.id === vueloId)!,
        fareBrand: selection.fareBrand,
        family: families.find((f) => f.code === selection.fareBrand)!,
      };
    });
    const passengers = await manager.find(Passenger, { where: { bookingId: booking.bookingId } });
    return { booking, hold, legs, passengers };
  }

  /** Only a confirmed booking can be altered; a cancelled one answers ALREADY_CANCELLED. */
  assertConfirmed(booking: Booking): void {
    if (booking.status === 'CANCELLED') {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'ALREADY_CANCELLED', 'Booking already cancelled', `Booking ${booking.bookingId} was cancelled.`);
    }
    if (booking.status !== 'CONFIRMED') {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'BOOKING_NOT_CONFIRMED', 'Booking is not confirmed', `Booking ${booking.bookingId} is ${booking.status}.`);
    }
  }

  /** The leg a contract itinerary id refers to, or a 400 naming the parameter. */
  legOf(context: BookingContext, itineraryId: string, parameter: string): BookingLeg {
    const leg = context.legs.find((l) => l.itineraryId === itineraryId);
    if (!leg) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Itinerary not part of the booking', `Itinerary ${itineraryId} does not belong to booking ${context.booking.bookingId}.`, [
        { name: parameter, reason: 'does not belong to the booking' },
      ]);
    }
    return leg;
  }

  /** The caller-chosen passenger id used by the contract (the same one seats and infants refer to). */
  passengerOf(context: BookingContext, clientPassengerId: string, parameter: string): Passenger {
    const passenger = context.passengers.find((p) => p.clientPassengerId === clientPassengerId);
    if (!passenger) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Passenger not part of the booking', `Passenger ${clientPassengerId} does not belong to booking ${context.booking.bookingId}.`, [
        { name: parameter, reason: 'does not belong to the booking' },
      ]);
    }
    return passenger;
  }

  /**
   * A payment reference backs one operation only: it cannot be the one of any booking, of an earlier baggage
   * purchase made after the sale, or of an earlier date change. (A booking's own reference is reused by the bags
   * bought together with it, which is why those are not checked here.)
   */
  async assertPaymentReferenceFree(manager: EntityManager, paymentReference: string): Promise<void> {
    const used =
      (await manager.exists(Booking, { where: { paymentReference } })) ||
      (await manager.exists(BaggagePurchase, { where: { paymentReference } })) ||
      (await manager.exists(DateChangeOffer, { where: { paymentReference } }));
    if (used) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'PAYMENT_REFERENCE_INVALID', 'Payment already used', 'This paymentReference is already attached to another operation.');
    }
  }

  /** Appends a line to the booking history shown as BookingDetail.changes. */
  addChange(booking: Booking, description: string): void {
    booking.changes = [...(booking.changes ?? []), { changedAt: new Date().toISOString(), description }];
  }
}
