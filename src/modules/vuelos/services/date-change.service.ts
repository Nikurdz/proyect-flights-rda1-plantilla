import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthClaims } from '../auth/token.service';
import { mapBookingUniqueViolation } from '../common/db-errors';
import { DomainEventBus } from '../common/domain-event-bus';
import { formatMinorUnits, toMinorUnits } from '../common/money.util';
import { changePricing, hasDeparted, isBeforeCutoff } from '../common/postsale-rules';
import { priceForPartyParts, seatsRequired } from '../common/pricing.util';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { seatExists } from '../common/seat-grid';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { CheckIn } from '../entities/check-in.entity';
import { DateChangeOffer } from '../entities/date-change-offer.entity';
import { SeatAssignment } from '../entities/seat-assignment.entity';
import { Vuelo } from '../entities/vuelo.entity';
import type { BookingDetailResponseDto } from '../dto/booking.dto';
import type { DateChangeOptionDto, DateChangeRequestDto, DateChangeSearchRequestDto } from '../dto/postventa.dto';
import { BookingContext, BookingContextService } from './booking-context.service';
import { BookingsService } from './bookings.service';
import { IdempotencyService } from './idempotency.service';
import { InventoryService } from './inventory.service';
import { SearchService } from './search.service';

const MAX_OPTIONS_PER_CHANGE = 5;

interface ChangeOutcome {
  response: BookingDetailResponseDto;
  event: Record<string, unknown>;
}

/**
 * Moving one leg of a booking to another flight of the same route. Searching prices every candidate and
 * stores it as an offer; confirming swaps the inventory (take the new seats, give back the old ones), moves the
 * seat assignments and updates the booking in ONE transaction, so a change either happens entirely or not at all.
 */
@Injectable()
export class DateChangeService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: BookingContextService,
    private readonly search: SearchService,
    private readonly inventory: InventoryService,
    private readonly bookings: BookingsService,
    private readonly idempotency: IdempotencyService,
    private readonly events: DomainEventBus,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  async searchOptions(ownerId: string, bookingId: string, request: DateChangeSearchRequestDto): Promise<DateChangeOptionDto[]> {
    const manager = this.dataSource.manager;
    const context = await this.context.load(manager, ownerId, bookingId);
    this.context.assertConfirmed(context.booking);
    const seatsNeeded = seatsRequired(context.hold.passengersBreakdown);

    const options: DateChangeOptionDto[] = [];
    for (const change of request.changes) {
      const leg = this.context.legOf(context, change.itineraryId, 'changes.itineraryId');
      this.assertChangeable(leg.family.changeable, leg.fareBrand);
      this.assertOpen(new Date(leg.vuelo.fechaSalida), leg.vuelo.codigoVuelo);

      const candidates = (await this.search.findDirectFlights(leg.vuelo.origenIATA, leg.vuelo.destinoIATA, change.newDepartureDate, seatsNeeded))
        .filter((vuelo) => vuelo.id !== leg.vueloId && this.keepsLegOrder(context, leg.itineraryId, vuelo))
        .slice(0, MAX_OPTIONS_PER_CHANGE);

      const oldParts = priceForPartyParts(toMinorUnits(leg.vuelo.precioBase), leg.family.priceMultiplier, context.hold.passengersBreakdown, this.config.taxRate);
      for (const vuelo of candidates) {
        const newParts = priceForPartyParts(toMinorUnits(vuelo.precioBase), leg.family.priceMultiplier, context.hold.passengersBreakdown, this.config.taxRate);
        const pricing = changePricing(oldParts, newParts, this.config.postSale.changeFeeMinor);
        const offer = await manager.save(
          manager.create(DateChangeOffer, {
            bookingId,
            ownerId,
            itineraryId: leg.itineraryId,
            fromVueloId: leg.vueloId,
            toVueloId: vuelo.id,
            ...pricing,
            currency: context.booking.currency,
            status: 'OPEN',
            paymentReference: null,
            expiresAt: new Date(Date.now() + this.config.postSale.quoteTtlMinutes * 60_000),
          }),
        );
        options.push({
          changeOfferId: offer.changeOfferId,
          expiresAt: offer.expiresAt.toISOString(),
          segments: [this.search.toSegment(vuelo)],
          priceDifference: {
            fareDifference: formatMinorUnits(pricing.fareDifferenceMinor),
            taxDifference: formatMinorUnits(pricing.taxDifferenceMinor),
            changeFee: formatMinorUnits(pricing.changeFeeMinor),
            totalToPay: formatMinorUnits(pricing.totalToPayMinor),
          },
        });
      }
    }
    return options;
  }

  async confirm(auth: AuthClaims, idempotencyKey: string, bookingId: string, request: DateChangeRequestDto): Promise<BookingDetailResponseDto> {
    const outcome = await this.idempotency.execute<ChangeOutcome>(
      { key: idempotencyKey, route: `POST /bookings/${bookingId}/date-change`, ownerId: auth.ownerId, body: request },
      HttpStatus.OK,
      async (manager) => {
        try {
          return await this.confirmWithin(manager, auth.ownerId, bookingId, request);
        } catch (error) {
          throw mapBookingUniqueViolation(error);
        }
      },
    );
    if (!outcome.replayed) {
      await this.events.publish('booking.changed', bookingId, outcome.result.event);
    }
    return outcome.result.response;
  }

  private async confirmWithin(manager: EntityManager, ownerId: string, bookingId: string, request: DateChangeRequestDto): Promise<ChangeOutcome> {
    const context = await this.context.load(manager, ownerId, bookingId, { lock: true });
    this.context.assertConfirmed(context.booking);

    const offer = await manager.findOne(DateChangeOffer, { where: { changeOfferId: request.changeOfferId, bookingId, ownerId }, lock: { mode: 'pessimistic_write' } });
    if (!offer) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Unknown change offer', `Change offer ${request.changeOfferId} does not belong to booking ${bookingId}.`, [
        { name: 'changeOfferId', reason: 'not an offer of this booking' },
      ]);
    }
    const legIndex = context.legs.findIndex((l) => l.itineraryId === offer.itineraryId);
    const leg = context.legs[legIndex];
    // An offer is only good for the flight it was priced against, once, and while it lives.
    if (offer.status !== 'OPEN' || offer.expiresAt.getTime() <= Date.now() || !leg || leg.vueloId !== offer.fromVueloId) {
      throw new ProblemDetailsException(HttpStatus.GONE, 'CHANGE_OFFER_EXPIRED', 'Change offer expired', `Change offer ${offer.changeOfferId} is no longer valid; search again.`);
    }
    this.assertChangeable(leg.family.changeable, leg.fareBrand);
    this.assertOpen(new Date(leg.vuelo.fechaSalida), leg.vuelo.codigoVuelo);

    const newVuelo = await manager.findOne(Vuelo, { where: { id: offer.toVueloId } });
    if (!newVuelo || newVuelo.estado !== 'SCHEDULED' || hasDeparted(new Date(newVuelo.fechaSalida), new Date())) {
      throw new ProblemDetailsException(HttpStatus.GONE, 'OFFER_NO_LONGER_AVAILABLE', 'Flight no longer available', 'The flight of this change offer is no longer available.');
    }

    if (offer.totalToPayMinor > 0) {
      if (!request.payment) {
        throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'PAYMENT_NOT_AUTHORIZED', 'Payment required', `This change has ${formatMinorUnits(offer.totalToPayMinor)} ${offer.currency} to pay: send payment.paymentReference.`, [
          { name: 'payment', reason: 'required when the change has an amount to pay' },
        ]);
      }
      await this.context.assertPaymentReferenceFree(manager, request.payment.paymentReference);
    }

    // Inventory: take the seats of the new flight first (SEAT_TAKEN rolls everything back), then give the old ones back.
    const seats = context.hold.inventory[legIndex].seats;
    await this.inventory.reserve(manager, [{ vueloId: newVuelo.id, seats }]);
    await this.inventory.restore(manager, [{ vueloId: leg.vueloId, seats }]);
    context.hold.inventory = context.hold.inventory.map((item, index) => (index === legIndex ? { ...item, vueloId: newVuelo.id } : item));
    await manager.save(context.hold);

    // Seats and check-in belong to the old flight: they do not travel. The request may choose seats on the new one.
    await manager.delete(SeatAssignment, { bookingId, vueloId: leg.vueloId });
    await manager.delete(CheckIn, { bookingId, vueloId: leg.vueloId });
    await this.assignSeats(manager, context, newVuelo, request);

    const old = leg.vuelo;
    leg.vuelo = newVuelo;
    leg.vueloId = newVuelo.id;
    const first = context.legs.reduce((a, b) => (new Date(a.vuelo.fechaSalida).getTime() <= new Date(b.vuelo.fechaSalida).getTime() ? a : b));
    context.booking.origin = first.vuelo.origenIATA;
    context.booking.destination = first.vuelo.destinoIATA;
    context.booking.departureAt = first.vuelo.fechaSalida;
    // The fare difference raises what the booking is worth (never lowers it: a cheaper flight is not refunded).
    const raise = Math.max(0, offer.fareDifferenceMinor + offer.taxDifferenceMinor);
    context.booking.grandTotal = formatMinorUnits(toMinorUnits(context.booking.grandTotal) + raise);
    if (raise > 0 && context.hold.lockedTaxesMinor !== null) {
      context.hold.lockedTaxesMinor += Math.max(0, offer.taxDifferenceMinor);
      await manager.save(context.hold);
    }
    this.context.addChange(
      context.booking,
      `Cambio de fecha: ${old.codigoVuelo} del ${new Date(old.fechaSalida).toISOString().slice(0, 10)} a ${newVuelo.codigoVuelo} del ${new Date(newVuelo.fechaSalida).toISOString().slice(0, 10)}. Pagado ${formatMinorUnits(offer.totalToPayMinor)} ${offer.currency} (cargo ${formatMinorUnits(offer.changeFeeMinor)}).`,
    );
    await manager.save(context.booking);

    offer.status = 'USED';
    offer.paymentReference = request.payment?.paymentReference ?? null;
    await manager.save(offer);

    return {
      response: await this.bookings.detailOf(manager, context.booking),
      event: {
        bookingId,
        pnr: context.booking.pnr,
        ownerId,
        status: context.booking.status,
        itineraryId: offer.itineraryId,
        fromVueloId: offer.fromVueloId,
        toVueloId: newVuelo.id,
        newDepartureAt: new Date(newVuelo.fechaSalida).toISOString(),
        totalToPay: formatMinorUnits(offer.totalToPayMinor),
      },
    };
  }

  /**
   * The optional seats of the request go to the booking's seat-taking passengers in ascending passenger-id order
   * (the contract lists seats without naming who they are for). Each must be on the new flight, exist in its
   * cabin and be free: the unique (flight, seat) index is the last word.
   */
  private async assignSeats(manager: EntityManager, context: BookingContext, newVuelo: Vuelo, request: DateChangeRequestDto): Promise<void> {
    const seats = request.assignedSeats ?? [];
    if (seats.length === 0) return;
    const takers = context.passengers.filter((p) => p.passengerType !== 'INFANT').sort((a, b) => a.clientPassengerId.localeCompare(b.clientPassengerId));
    if (seats.length > takers.length) {
      throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Too many seats', `The booking has ${takers.length} passenger(s) that take a seat.`, [
        { name: 'assignedSeats', reason: 'more seats than seat-taking passengers' },
      ]);
    }
    const seen = new Set<string>();
    const rows = seats.map((seat, index) => {
      if (seat.segmentId !== newVuelo.id) {
        throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Seat not on the new flight', `segmentId ${seat.segmentId} is not the new flight of the change.`, [
          { name: 'assignedSeats.segmentId', reason: 'must be the segmentId of the new flight' },
        ]);
      }
      if (!seatExists(newVuelo.capacidadTotal, seat.seatNumber)) {
        throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'SEAT_CABIN_MISMATCH', 'Seat does not exist', `Seat ${seat.seatNumber} does not exist on flight ${newVuelo.codigoVuelo}.`);
      }
      if (seen.has(seat.seatNumber)) {
        throw new ProblemDetailsException(HttpStatus.CONFLICT, 'SEAT_TAKEN', 'Seat requested twice', `Seat ${seat.seatNumber} is listed more than once.`);
      }
      seen.add(seat.seatNumber);
      return manager.create(SeatAssignment, { vueloId: newVuelo.id, seatNumber: seat.seatNumber, bookingId: context.booking.bookingId, passengerId: takers[index].passengerId });
    });
    await manager.save(rows);
  }

  /** The new flight must keep the legs in order: after the one that comes before it and before the one that follows. */
  private keepsLegOrder(context: BookingContext, itineraryId: string, candidate: Vuelo): boolean {
    const others = context.legs.filter((l) => l.itineraryId !== itineraryId).map((l) => l.vuelo);
    const candidateDeparture = new Date(candidate.fechaSalida).getTime();
    const current = context.legs.find((l) => l.itineraryId === itineraryId)!.vuelo;
    const currentDeparture = new Date(current.fechaSalida).getTime();
    return others.every((other) => {
      const otherDeparture = new Date(other.fechaSalida).getTime();
      return otherDeparture < currentDeparture ? new Date(other.fechaLlegada).getTime() < candidateDeparture : candidateDeparture < otherDeparture;
    });
  }

  private assertChangeable(changeable: boolean, fareBrand: string): void {
    if (!changeable) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'FARE_NOT_CHANGEABLE', 'Fare not changeable', `The ${fareBrand} fare does not allow date changes.`);
    }
  }

  private assertOpen(departure: Date, flight: string): void {
    const now = new Date();
    if (hasDeparted(departure, now)) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'FLIGHT_ALREADY_DEPARTED', 'Flight already departed', `Flight ${flight} has already departed.`);
    }
    if (!isBeforeCutoff(departure, now, this.config.postSale.cutoffHours)) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'CUTOFF_PASSED', 'Change closed', `A date change is possible up to ${this.config.postSale.cutoffHours} h before departure.`);
    }
  }
}
