import { randomInt } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import type { AuthClaims } from '../auth/token.service';
import { assertInfantAssociations, assertNoDuplicatePassengers, assertPassengerTypeMatchesAge } from '../common/business-rules';
import { decodeCursor, encodeCursor } from '../common/cursor.util';
import { toIso, utcDayRange } from '../common/date.util';
import { mapBookingUniqueViolation } from '../common/db-errors';
import { DomainEventBus } from '../common/domain-event-bus';
import { PassengerBreakdown, PassengerType, countFor, PASSENGER_TYPES } from '../common/pricing.util';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { seatExists } from '../common/seat-grid';
import { buildTicketCode } from '../common/ticket-qr';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { Booking } from '../entities/booking.entity';
import { FlightHold } from '../entities/flight-hold.entity';
import { Passenger } from '../entities/passenger.entity';
import { SeatAssignment } from '../entities/seat-assignment.entity';
import { Ticket } from '../entities/ticket.entity';
import { Vuelo } from '../entities/vuelo.entity';
import type {
  BookingDetailResponseDto,
  BookingListResponseDto,
  BookingRequestDto,
  ListBookingsQueryDto,
  TicketResponseDto,
} from '../dto/booking.dto';
import { IdempotencyService } from './idempotency.service';
import { OffersService } from './offers.service';

const PNR_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
const BOOKING_ROUTE = 'POST /bookings';

export interface BookingOutcome {
  response: BookingDetailResponseDto;
  holdId: string;
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    private readonly offersService: OffersService,
    private readonly idempotency: IdempotencyService,
    private readonly events: DomainEventBus,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  /**
   * Creates the booking and issues one e-ticket per passenger as a single unit: the hold is
   * locked, validated, consumed and the booking/passengers/tickets/seats written in ONE
   * transaction (and the idempotency record completed in that same transaction). Nothing is
   * visible unless everything succeeded, and two concurrent requests for one hold serialise
   * on the row lock, so exactly one wins.
   */
  async createBooking(auth: AuthClaims, idempotencyKey: string, request: BookingRequestDto): Promise<BookingDetailResponseDto> {
    let outcome;
    try {
      outcome = await this.idempotency.execute<BookingOutcome>(
        { key: idempotencyKey, route: BOOKING_ROUTE, ownerId: auth.ownerId, body: request },
        HttpStatus.CREATED,
        async (manager) => {
          try {
            return await this.createBookingWithin(manager, auth.ownerId, request);
          } catch (error) {
            throw mapBookingUniqueViolation(error);
          }
        },
      );
    } catch (error) {
      // The failed transaction rolled back, so an overdue hold is still marked HELD: expire
      // it now (releasing its seats) rather than leaving that to the next sweep.
      if (error instanceof ProblemDetailsException && (error.getResponse() as { code?: string }).code === 'QUOTE_EXPIRED') {
        await this.offersService.expireIfDue(request.holdId);
      }
      throw error;
    }

    if (!outcome.replayed) {
      await this.announceConfirmed(auth.ownerId, outcome.result);
    }
    return outcome.result.response;
  }

  /** Publishes booking.confirmed; call it only after the transaction that created the booking committed. */
  async announceConfirmed(ownerId: string, outcome: BookingOutcome): Promise<void> {
    await this.events.publish('booking.confirmed', outcome.response.bookingId, {
      bookingId: outcome.response.bookingId,
      pnr: outcome.response.pnr,
      holdId: outcome.holdId,
      ownerId,
      ticketNumbers: (outcome.response.tickets ?? []).map((t) => t.eTicketNumber),
    });
  }

  /**
   * The booking itself, run inside the caller's transaction (see createBooking for the guarantees).
   * Public so the e-commerce order saga can issue the booking and update its own order atomically.
   * The caller publishes the domain event with announceConfirmed() once its transaction commits.
   */
  async createBookingWithin(manager: EntityManager, ownerId: string, request: BookingRequestDto): Promise<BookingOutcome> {
    const hold = await manager.findOne(FlightHold, { where: { holdId: request.holdId }, lock: { mode: 'pessimistic_write' } });
    if (!hold) {
      throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'OFFER_NO_LONGER_AVAILABLE', 'Hold not found', `Hold ${request.holdId} was not found.`);
    }
    if (hold.ownerId !== ownerId) {
      throw new ProblemDetailsException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Hold belongs to another user', 'You do not have access to this hold.');
    }
    this.assertHoldUsable(hold);

    const vuelos = await manager.find(Vuelo, { where: { id: In(hold.inventory.map((i) => i.vueloId)) } });
    if (vuelos.length !== hold.inventory.length) {
      throw new ProblemDetailsException(HttpStatus.GONE, 'OFFER_NO_LONGER_AVAILABLE', 'Flight no longer available', 'A flight of this hold no longer exists.');
    }
    const ordered = [...vuelos].sort((a, b) => new Date(a.fechaSalida).getTime() - new Date(b.fechaSalida).getTime());
    const firstFlight = ordered[0];
    const lastFlight = ordered[ordered.length - 1];

    // A hold taken before departure must not turn into a booking once the flight has left.
    if (new Date(firstFlight.fechaSalida).getTime() <= Date.now()) {
      throw new ProblemDetailsException(HttpStatus.GONE, 'OFFER_NO_LONGER_AVAILABLE', 'Flight already departed', `Flight ${firstFlight.codigoVuelo} has already departed.`);
    }

    this.validatePassengers(request, hold.passengersBreakdown, firstFlight, lastFlight, vuelos);

    if (await manager.exists(Booking, { where: { paymentReference: request.payment.paymentReference } })) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'PAYMENT_REFERENCE_INVALID', 'Payment already used', 'This paymentReference is already attached to another booking.');
    }

    const consumed = await manager.update(FlightHold, { holdId: hold.holdId, status: 'HELD' }, { status: 'CONSUMED' });
    if (consumed.affected !== 1) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'BOOKING_NOT_CONFIRMED', 'Hold already consumed', `Hold ${hold.holdId} was already used to create a booking.`);
    }

    const booking = await manager.save(
      manager.create(Booking, {
        pnr: await this.generateUniquePnr(manager),
        holdId: hold.holdId,
        status: 'CONFIRMED',
        ownerId,
        grandTotal: hold.lockedPrice,
        currency: hold.currency,
        paymentReference: request.payment.paymentReference,
        origin: firstFlight.origenIATA,
        destination: firstFlight.destinoIATA,
        departureAt: firstFlight.fechaSalida,
      }),
    );

    const savedPassengers = await manager.save(
      request.passengers.map((p) =>
        manager.create(Passenger, {
          bookingId: booking.bookingId,
          clientPassengerId: p.passengerId,
          associatedAdultClientId: p.associatedAdultId ?? null,
          passengerType: p.passengerType as PassengerType,
          firstName: p.firstName,
          lastName: p.lastName,
          documentType: p.documentType,
          documentNumber: p.documentNumber,
          nationality: p.nationality,
          birthDate: p.birthDate,
          gender: p.gender,
          contactEmail: p.contact.email,
          contactPhone: p.contact.phone,
        }),
      ),
    );

    const seatRows = request.passengers.flatMap((p, index) =>
      (p.assignedSeats ?? []).map((seat) =>
        manager.create(SeatAssignment, {
          vueloId: seat.segmentId,
          seatNumber: seat.seatNumber,
          bookingId: booking.bookingId,
          passengerId: savedPassengers[index].passengerId,
        }),
      ),
    );
    if (seatRows.length > 0) {
      await manager.save(seatRows);
    }

    const issuedAt = new Date();
    const issuedTickets: Ticket[] = [];
    for (const passenger of savedPassengers) {
      issuedTickets.push(
        await manager.save(
          manager.create(Ticket, {
            bookingId: booking.bookingId,
            passengerId: passenger.passengerId,
            eTicketNumber: await this.generateUniqueETicketNumber(manager),
            status: 'ISSUED',
            issuedAt,
          }),
        ),
      );
    }

    return { response: this.toBookingDetail(booking, issuedTickets), holdId: hold.holdId };
  }

  private assertHoldUsable(hold: FlightHold): void {
    if (hold.status === 'CONSUMED') {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'BOOKING_NOT_CONFIRMED', 'Hold already consumed', `Hold ${hold.holdId} was already used to create a booking.`);
    }
    if (hold.status !== 'HELD') {
      throw new ProblemDetailsException(HttpStatus.GONE, 'QUOTE_EXPIRED', 'Hold is no longer active', `Hold ${hold.holdId} has status ${hold.status}.`);
    }
    if (hold.expiresAt.getTime() <= Date.now()) {
      throw new ProblemDetailsException(HttpStatus.GONE, 'QUOTE_EXPIRED', 'Hold expired', `Hold ${hold.holdId} expired at ${toIso(hold.expiresAt)}.`);
    }
  }

  private validatePassengers(
    request: BookingRequestDto,
    breakdown: PassengerBreakdown,
    firstFlight: Vuelo,
    lastFlight: Vuelo,
    vuelos: Vuelo[],
  ): void {
    const fail = (title: string, detail: string, invalid?: { name: string; reason: string }) => {
      throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', title, detail, invalid ? [invalid] : undefined);
    };

    // The party must be exactly the one that was priced and held.
    for (const type of PASSENGER_TYPES) {
      const provided = request.passengers.filter((p) => p.passengerType === type).length;
      if (provided !== countFor(breakdown, type)) {
        fail(
          'Passengers do not match the hold',
          `The hold was priced for ${countFor(breakdown, type)} ${type} passenger(s) but ${provided} were provided.`,
          { name: 'passengers', reason: `expected ${countFor(breakdown, type)} ${type}` },
        );
      }
    }

    // Extra baggage is neither stored nor charged yet: refuse it rather than let the customer believe it was bought.
    const withBaggage = request.passengers.find((p) => (p.extraBaggage ?? []).length > 0);
    if (withBaggage) {
      throw new ProblemDetailsException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VALIDATION_FAILED',
        'Extra baggage not available',
        `Extra baggage cannot be purchased in this phase (passenger ${withBaggage.passengerId}).`,
        [{ name: 'passengers.extraBaggage', reason: 'not supported in this phase' }],
      );
    }

    assertNoDuplicatePassengers(request.passengers);

    const firstDate = toIso(firstFlight.fechaSalida);
    for (const passenger of request.passengers) {
      assertPassengerTypeMatchesAge(passenger.passengerType as PassengerType, passenger.birthDate, firstDate);
      if (passenger.documentExpiryDate && new Date(passenger.documentExpiryDate) < new Date(lastFlight.fechaSalida)) {
        fail('Travel document expired', `The document of ${passenger.firstName} ${passenger.lastName} expires before the last flight.`, {
          name: 'passengers.documentExpiryDate',
          reason: 'expires before the trip ends',
        });
      }
    }

    assertInfantAssociations(request.passengers);

    // Seats: lap infants take none, each seat belongs to a held segment, exists in the cabin, and is unique.
    const requested = new Set<string>();
    for (const passenger of request.passengers) {
      const perSegment = new Set<string>();
      for (const seat of passenger.assignedSeats ?? []) {
        if (passenger.passengerType === 'INFANT') {
          throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'INFANT_SEAT_NOT_ALLOWED', 'Infants cannot have a seat', `Infant ${passenger.passengerId} travels on a lap and cannot be assigned a seat.`);
        }
        const flight = vuelos.find((v) => v.id === seat.segmentId);
        if (!flight) {
          fail('Seat segment not part of the hold', `segmentId ${seat.segmentId} is not part of this booking.`, { name: 'passengers.assignedSeats.segmentId', reason: 'not part of the hold' });
        }
        if (!seatExists(flight!.capacidadTotal, seat.seatNumber)) {
          throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'SEAT_CABIN_MISMATCH', 'Seat does not exist', `Seat ${seat.seatNumber} does not exist on flight ${flight!.codigoVuelo}.`);
        }
        const key = `${seat.segmentId}:${seat.seatNumber}`;
        if (requested.has(key)) {
          throw new ProblemDetailsException(HttpStatus.CONFLICT, 'SEAT_TAKEN', 'Seat requested twice', `Seat ${seat.seatNumber} is assigned to more than one passenger.`);
        }
        requested.add(key);
        if (perSegment.has(seat.segmentId)) {
          fail('Several seats on one segment', `Passenger ${passenger.passengerId} has more than one seat on a segment.`, { name: 'passengers.assignedSeats', reason: 'one seat per segment' });
        }
        perSegment.add(seat.segmentId);
      }
    }
  }

  async getBookingDetail(ownerId: string, bookingId: string): Promise<BookingDetailResponseDto> {
    const booking = await this.findOwnedBookingOrThrow(ownerId, bookingId);
    const tickets = await this.tickets.find({ where: { bookingId } });
    return this.toBookingDetail(booking, tickets);
  }

  async getBookingTickets(ownerId: string, bookingId: string): Promise<TicketResponseDto[]> {
    const booking = await this.findOwnedBookingOrThrow(ownerId, bookingId);
    const tickets = await this.tickets.find({ where: { bookingId } });
    return tickets.map((t) => this.toTicketDto(t, booking.pnr));
  }

  async getTicketDetail(ownerId: string, bookingId: string, ticketId: string): Promise<TicketResponseDto> {
    const booking = await this.findOwnedBookingOrThrow(ownerId, bookingId);
    const ticket = await this.tickets.findOne({ where: { bookingId, ticketId } });
    if (!ticket) {
      throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'BOOKING_NOT_CONFIRMED', 'Ticket not found', `Ticket ${ticketId} was not found for booking ${bookingId}.`);
    }
    return this.toTicketDto(ticket, booking.pnr);
  }

  async listBookings(ownerId: string, query: ListBookingsQueryDto): Promise<BookingListResponseDto> {
    const limit = query.limit ?? 10;
    const qb = this.bookings.createQueryBuilder('b').where('b.ownerId = :ownerId', { ownerId });

    if (query.pnr) qb.andWhere('b.pnr = :pnr', { pnr: query.pnr });
    if (query.status) qb.andWhere('b.status = :status', { status: query.status });
    if (query.createdFrom) qb.andWhere('b.createdAt >= :from', { from: utcDayRange(query.createdFrom).start });
    if (query.createdTo) qb.andWhere('b.createdAt < :to', { to: utcDayRange(query.createdTo).end });
    if (query.cursor) {
      const { createdAt, id: bookingId } = decodeCursor(query.cursor);
      qb.andWhere('(b."createdAt", b."bookingId") < (:cursorCreatedAt, :cursorId)', {
        cursorCreatedAt: createdAt,
        cursorId: bookingId,
      });
    }

    const rows = await qb.orderBy('b.createdAt', 'DESC').addOrderBy('b.bookingId', 'DESC').take(limit + 1).getMany();
    const page = rows.slice(0, limit);

    return {
      items: page.map((b) => ({
        bookingId: b.bookingId,
        pnr: b.pnr,
        status: b.status,
        origin: b.origin,
        destination: b.destination,
        departureDate: toIso(b.departureAt).slice(0, 10),
        grandTotal: { currency: b.currency, total: b.grandTotal },
      })),
      ...(rows.length > limit ? { nextCursor: encodeCursor(page[page.length - 1].createdAt, page[page.length - 1].bookingId) } : {}),
    };
  }

  private async findOwnedBookingOrThrow(ownerId: string, bookingId: string): Promise<Booking> {
    const booking = await this.bookings.findOne({ where: { bookingId } });
    if (!booking) {
      throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'BOOKING_NOT_CONFIRMED', 'Booking not found', `Booking ${bookingId} was not found.`);
    }
    if (booking.ownerId !== ownerId) {
      throw new ProblemDetailsException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Booking belongs to another user', 'You do not have access to this booking.');
    }
    return booking;
  }

  private toBookingDetail(booking: Booking, tickets: Ticket[]): BookingDetailResponseDto {
    return {
      bookingId: booking.bookingId,
      pnr: booking.pnr,
      status: booking.status,
      grandTotal: { currency: booking.currency, total: booking.grandTotal },
      createdAt: toIso(booking.createdAt),
      updatedAt: toIso(booking.updatedAt),
      tickets: tickets.map((t) => this.toTicketDto(t, booking.pnr)),
    };
  }

  private toTicketDto(ticket: Ticket, pnr: string): TicketResponseDto {
    return {
      ticketId: ticket.ticketId,
      bookingId: ticket.bookingId,
      passengerId: ticket.passengerId,
      eTicketNumber: ticket.eTicketNumber,
      status: ticket.status,
      issuedAt: ticket.issuedAt ? toIso(ticket.issuedAt) : null,
      // Signed text for the passenger's QR code (no personal data); see common/ticket-qr.ts.
      qrPayload: ticket.eTicketNumber ? buildTicketCode(this.config.jwtSecret, ticket.eTicketNumber, pnr) : null,
    };
  }

  private async generateUniquePnr(manager: EntityManager): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      let pnr = '';
      for (let i = 0; i < 6; i++) {
        pnr += PNR_ALPHABET[randomInt(PNR_ALPHABET.length)];
      }
      if (!(await manager.exists(Booking, { where: { pnr } }))) return pnr;
    }
    throw new ProblemDetailsException(HttpStatus.CONFLICT, 'PNR_CREATION_FAILED', 'Could not allocate a record locator', 'Retry the request with the same Idempotency-Key.');
  }

  private async generateUniqueETicketNumber(manager: EntityManager): Promise<string> {
    // 13 digits, no airline-prefix table in this phase — a documented simplification.
    for (let attempt = 0; attempt < 10; attempt++) {
      let digits = '';
      for (let i = 0; i < 13; i++) {
        digits += randomInt(10).toString();
      }
      if (!(await manager.exists(Ticket, { where: { eTicketNumber: digits } }))) return digits;
    }
    throw new ProblemDetailsException(HttpStatus.CONFLICT, 'TICKET_ISSUANCE_FAILED', 'Could not allocate an e-ticket number', 'Retry the request with the same Idempotency-Key.');
  }
}
