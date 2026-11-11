import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AuthClaims } from '../auth/token.service';
import { DomainEventBus } from '../common/domain-event-bus';
import { formatMinorUnits } from '../common/money.util';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { Ticket } from '../entities/ticket.entity';
import { BookingContextService } from '../services/booking-context.service';
import { BookingsService } from '../services/bookings.service';
import { BookingViewV2Service, TicketV2 } from './booking-view-v2.service';
import { bookingLinks, Links } from './v2-links';

export interface TicketIssuanceResponse {
  bookingId: string;
  pnr: string;
  status: 'CONFIRMED' | 'TICKET_ISSUING';
  tickets: TicketV2[];
  issued: number;
  _links: Links;
}

/**
 * POST /bookings/{id}/tickets of contract v2. Issuing is idempotent by construction: tickets that already exist are
 * returned with `issued: 0`. In this system a booking is issued in the same transaction that creates it, so the call
 * normally just reads; it issues the tickets only for a booking still waiting for them (TICKET_ISSUING / PENDING_PAYMENT,
 * e.g. after Booking confirmed the payment).
 */
@Injectable()
export class TicketsV2Service {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: BookingContextService,
    private readonly bookings: BookingsService,
    private readonly view: BookingViewV2Service,
    private readonly events: DomainEventBus,
  ) {}

  async issue(auth: AuthClaims, bookingId: string): Promise<TicketIssuanceResponse> {
    return this.issueFor(auth.ownerId, bookingId);
  }

  async issueFor(ownerId: string, bookingId: string): Promise<TicketIssuanceResponse> {
    const result = await this.dataSource.transaction(async (manager) => {
      const context = await this.context.load(manager, ownerId, bookingId, { lock: true });
      const { booking } = context;
      if (booking.status === 'CANCELLED') {
        throw new ProblemDetailsException(HttpStatus.CONFLICT, 'ALREADY_CANCELLED', 'Reserva cancelada', `La reserva ${bookingId} fue cancelada.`);
      }
      if (!['CONFIRMED', 'TICKET_ISSUING', 'PENDING_PAYMENT'].includes(booking.status)) {
        throw new ProblemDetailsException(HttpStatus.CONFLICT, 'BOOKING_NOT_CONFIRMED', 'La reserva no admite emisión', `La reserva ${bookingId} está ${booking.status}.`);
      }

      const existing = await manager.find(Ticket, { where: { bookingId } });
      let issued = 0;
      for (const passenger of context.passengers) {
        if (existing.some((t) => t.passengerId === passenger.passengerId && t.status === 'ISSUED')) continue;
        await manager.save(
          manager.create(Ticket, {
            bookingId,
            passengerId: passenger.passengerId,
            eTicketNumber: await this.bookings.generateUniqueETicketNumber(manager),
            status: 'ISSUED',
            issuedAt: new Date(),
          }),
        );
        issued += 1;
      }
      if (issued > 0 && booking.status !== 'CONFIRMED') {
        booking.status = 'CONFIRMED';
        await manager.save(booking);
      }
      return { context, issued, tickets: await this.view.ticketsOf(manager, context) };
    });

    const { booking } = result.context;
    if (result.issued > 0) {
      const base = {
        bookingId,
        pnr: booking.pnr,
        holdId: booking.holdId,
        ownerId: booking.ownerId,
        grandTotal: { currency: booking.currency, total: formatMinorUnits(booking.totalMinor) },
        paymentReference: booking.paymentReference,
        ticketNumbers: result.tickets.map((t) => t.eTicketNumber).filter((n): n is string => !!n),
        tickets: result.tickets.map((t) => ({ ticketId: t.ticketId, eTicketNumber: t.eTicketNumber, passengerId: t.passengerId })),
      };
      await this.events.publish('booking.ticket_issuing', bookingId, { ...base, status: 'TICKET_ISSUING' });
      await this.events.publish('booking.ticket_issued', bookingId, { ...base, status: 'CONFIRMED' });
    }
    return { bookingId, pnr: booking.pnr, status: 'CONFIRMED', tickets: result.tickets, issued: result.issued, _links: bookingLinks(bookingId, booking.status) };
  }
}
