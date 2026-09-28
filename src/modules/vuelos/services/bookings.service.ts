import { randomInt } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { assertPassengerTypeMatchesAge } from '../common/business-rules';
import { resolveOwnerId } from '../common/owner.util';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { Booking } from '../entities/booking.entity';
import { FlightOffer } from '../entities/flight-offer.entity';
import { Passenger } from '../entities/passenger.entity';
import { Ticket } from '../entities/ticket.entity';
import { Vuelo } from '../entities/vuelo.entity';
import type { BookingRequestDto, BookingDetailResponseDto, TicketResponseDto } from '../dto/booking.dto';
import { IdempotencyService } from './idempotency.service';
import { OffersService } from './offers.service';

const PNR_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Passenger) private readonly passengers: Repository<Passenger>,
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(FlightOffer) private readonly offers: Repository<FlightOffer>,
    @InjectRepository(Vuelo) private readonly vuelos: Repository<Vuelo>,
    private readonly offersService: OffersService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async createBooking(
    idempotencyKey: string,
    request: BookingRequestDto,
    authorizationHeader: string | undefined,
  ): Promise<BookingDetailResponseDto> {
    const route = 'POST /bookings';
    const replay = await this.idempotency.findReplay<BookingDetailResponseDto>(idempotencyKey, route);
    if (replay) {
      return replay;
    }

    const hold = await this.offersService.findHoldOrThrow(request.holdId);
    if (hold.status === 'CONSUMED') {
      throw new ProblemDetailsException(
        HttpStatus.CONFLICT,
        'BOOKING_NOT_CONFIRMED',
        'Hold already consumed',
        `Hold ${hold.holdId} was already used to create a booking.`,
      );
    }
    if (hold.status !== 'HELD') {
      throw new ProblemDetailsException(
        HttpStatus.GONE,
        'QUOTE_EXPIRED',
        'Hold is no longer active',
        `Hold ${hold.holdId} has status ${hold.status}.`,
      );
    }
    if (hold.expiresAt < new Date()) {
      throw new ProblemDetailsException(
        HttpStatus.GONE,
        'QUOTE_EXPIRED',
        'Hold expired',
        `Hold ${hold.holdId} expired at ${hold.expiresAt.toISOString()}.`,
      );
    }

    const offer = await this.offers.findOne({ where: { offerId: hold.offerId } });
    const vueloIds = offer?.itineraries.map((i) => i.vueloId) ?? [];
    const vuelos = vueloIds.length ? await this.vuelos.find({ where: { id: In(vueloIds) } }) : [];
    const firstFlightDate = vuelos.length
      ? new Date(Math.min(...vuelos.map((v) => new Date(v.fechaSalida).getTime()))).toISOString()
      : new Date().toISOString();

    for (const passenger of request.passengers) {
      assertPassengerTypeMatchesAge(
        passenger.passengerType as 'ADULT' | 'YOUTH' | 'CHILD' | 'INFANT',
        passenger.birthDate,
        firstFlightDate,
      );
    }

    const ownerId = resolveOwnerId(authorizationHeader);
    const pnr = await this.generateUniquePnr();

    const booking = await this.bookings.save(
      this.bookings.create({
        pnr,
        holdId: hold.holdId,
        status: 'CONFIRMED',
        ownerId,
        grandTotal: hold.lockedPrice,
        currency: hold.currency,
        paymentReference: request.payment.paymentReference,
      }),
    );

    const savedPassengers = await this.passengers.save(
      request.passengers.map((p) =>
        this.passengers.create({
          bookingId: booking.bookingId,
          passengerType: p.passengerType as Passenger['passengerType'],
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

    const issuedAt = new Date();
    const issuedTickets = await this.tickets.save(
      savedPassengers.map((passenger) =>
        this.tickets.create({
          bookingId: booking.bookingId,
          passengerId: passenger.passengerId,
          eTicketNumber: this.generateETicketNumber(),
          status: 'ISSUED',
          issuedAt,
        }),
      ),
    );

    await this.offersService.setHoldStatus(hold, 'CONSUMED');

    const response = this.toBookingDetail(booking, issuedTickets);
    await this.idempotency.record(idempotencyKey, route, HttpStatus.CREATED, response);
    return response;
  }

  async getBookingDetail(bookingId: string): Promise<BookingDetailResponseDto> {
    const booking = await this.findBookingOrThrow(bookingId);
    const tickets = await this.tickets.find({ where: { bookingId } });
    return this.toBookingDetail(booking, tickets);
  }

  async getBookingTickets(bookingId: string): Promise<TicketResponseDto[]> {
    await this.findBookingOrThrow(bookingId);
    const tickets = await this.tickets.find({ where: { bookingId } });
    return tickets.map((t) => this.toTicketDto(t));
  }

  async getTicketDetail(bookingId: string, ticketId: string): Promise<TicketResponseDto> {
    await this.findBookingOrThrow(bookingId);
    const ticket = await this.tickets.findOne({ where: { bookingId, ticketId } });
    if (!ticket) {
      throw new ProblemDetailsException(
        HttpStatus.NOT_FOUND,
        'BOOKING_NOT_CONFIRMED',
        'Ticket not found',
        `Ticket ${ticketId} was not found for booking ${bookingId}.`,
      );
    }
    return this.toTicketDto(ticket);
  }

  async listBookings(
    ownerId: string,
    filters: { pnr?: string; status?: string; limit: number },
  ): Promise<{ items: BookingDetailResponseDto[] }> {
    const where: Record<string, unknown> = { ownerId };
    if (filters.pnr) where.pnr = filters.pnr;
    if (filters.status) where.status = filters.status;

    const bookings = await this.bookings.find({
      where,
      take: filters.limit,
      order: { createdAt: 'DESC' },
    });
    const items = await Promise.all(
      bookings.map(async (b) => this.toBookingDetail(b, await this.tickets.find({ where: { bookingId: b.bookingId } }))),
    );
    return { items };
  }

  private async findBookingOrThrow(bookingId: string): Promise<Booking> {
    const booking = await this.bookings.findOne({ where: { bookingId } });
    if (!booking) {
      throw new ProblemDetailsException(
        HttpStatus.NOT_FOUND,
        'BOOKING_NOT_CONFIRMED',
        'Booking not found',
        `Booking ${bookingId} was not found.`,
      );
    }
    return booking;
  }

  private toBookingDetail(booking: Booking, tickets: Ticket[]): BookingDetailResponseDto {
    return {
      bookingId: booking.bookingId,
      pnr: booking.pnr,
      status: booking.status,
      grandTotal: { currency: booking.currency, total: booking.grandTotal },
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
      tickets: tickets.map((t) => this.toTicketDto(t)),
    };
  }

  private toTicketDto(ticket: Ticket): TicketResponseDto {
    return {
      ticketId: ticket.ticketId,
      bookingId: ticket.bookingId,
      passengerId: ticket.passengerId,
      eTicketNumber: ticket.eTicketNumber,
      status: ticket.status,
      issuedAt: ticket.issuedAt.toISOString(),
    };
  }

  private async generateUniquePnr(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      let pnr = '';
      for (let i = 0; i < 6; i++) {
        pnr += PNR_ALPHABET[randomInt(PNR_ALPHABET.length)];
      }
      const exists = await this.bookings.findOne({ where: { pnr } });
      if (!exists) return pnr;
    }
    throw new Error('Could not generate a unique PNR after 10 attempts.');
  }

  private generateETicketNumber(): string {
    // 13 digits, no airline-prefix table in this phase — a documented simplification.
    let digits = '';
    for (let i = 0; i < 13; i++) {
      digits += randomInt(10).toString();
    }
    return digits;
  }
}
