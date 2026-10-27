import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { toIso } from '../common/date.util';
import { formatMinorUnits } from '../common/money.util';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { buildSeatGrid } from '../common/seat-grid';
import { BoardingPassListResponseDto, CheckInResponseDto } from '../dto/postventa.dto';
import { Booking } from '../entities/booking.entity';
import { BookingCambio } from '../entities/booking-cambio.entity';
import { CheckIn } from '../entities/check-in.entity';
import { SeatAssignment } from '../entities/seat-assignment.entity';
import { Ticket } from '../entities/ticket.entity';
import { Vuelo } from '../entities/vuelo.entity';
import { BookingContext, BookingContextService } from '../services/booking-context.service';
import { bookingLinks, checkInLinks, Links } from './v2-links';

export type SeatStatus = 'AVAILABLE' | 'HELD' | 'BOOKED' | 'TICKETED' | 'CHECKED_IN' | 'BOARDED';

export interface TicketV2 {
  ticketId: string;
  bookingId: string;
  passengerId: string;
  passengerName: string;
  eTicketNumber: string | null;
  status: string;
  issuedAt: string | null;
  segments: {
    segmentId: string;
    status: string;
    couponNumber: string | null;
    flightNumber: string;
    departureIataCode: string;
    arrivalIataCode: string;
    departureAt: string;
    arrivalAt: string;
    seatNumber: string | null;
  }[];
  failureReason: string | null;
}

/**
 * The contract v2 views of a booking: detail with `_links` and the sales channel, tickets with a coupon per segment,
 * boarding passes with the gate and seat maps with a status per seat. They read what the v1 services already store.
 */
@Injectable()
export class BookingViewV2Service {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: BookingContextService,
  ) {}

  async detail(ownerId: string, bookingId: string) {
    const manager = this.dataSource.manager;
    const context = await this.load(manager, ownerId, bookingId);
    const { booking } = context;
    const tickets = await this.ticketsOf(manager, context);
    const cambios = await manager.find(BookingCambio, { where: { bookingId }, order: { cambiadoEn: 'ASC' } });
    return {
      bookingId: booking.bookingId,
      pnr: booking.pnr,
      status: booking.status,
      grandTotal: { currency: booking.currency, total: formatMinorUnits(booking.totalMinor) },
      createdAt: toIso(booking.createdAt),
      updatedAt: toIso(booking.updatedAt),
      holdId: booking.holdId,
      paymentReference: booking.paymentReference,
      ...this.salesChannelOf(booking),
      tickets,
      ...(cambios.length ? { changes: cambios.map((c) => ({ changedAt: c.cambiadoEn.toISOString(), description: c.descripcion })) } : {}),
      _links: bookingLinks(booking.bookingId, booking.status),
    };
  }

  /** The booking as the v1 services return it after a change (date change), in v2 format. */
  async detailOfBooking(manager: EntityManager, booking: Booking) {
    const context = await this.context.complete(manager, booking);
    const cambios = await manager.find(BookingCambio, { where: { bookingId: booking.bookingId }, order: { cambiadoEn: 'ASC' } });
    return {
      bookingId: booking.bookingId,
      pnr: booking.pnr,
      status: booking.status,
      grandTotal: { currency: booking.currency, total: formatMinorUnits(booking.totalMinor) },
      createdAt: toIso(booking.createdAt),
      updatedAt: toIso(booking.updatedAt),
      holdId: booking.holdId,
      paymentReference: booking.paymentReference,
      ...this.salesChannelOf(booking),
      tickets: await this.ticketsOf(manager, context),
      ...(cambios.length ? { changes: cambios.map((c) => ({ changedAt: c.cambiadoEn.toISOString(), description: c.descripcion })) } : {}),
      _links: bookingLinks(booking.bookingId, booking.status),
    };
  }

  async tickets(ownerId: string, bookingId: string): Promise<TicketV2[]> {
    const manager = this.dataSource.manager;
    return this.ticketsOf(manager, await this.load(manager, ownerId, bookingId));
  }

  async ticket(ownerId: string, bookingId: string, ticketId: string): Promise<TicketV2> {
    const found = (await this.tickets(ownerId, bookingId)).find((t) => t.ticketId === ticketId || `TKT-${t.ticketId}` === ticketId);
    if (!found) {
      throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Boleto no encontrado', `El boleto ${ticketId} no existe en la reserva ${bookingId}.`);
    }
    return found;
  }

  async ticketsOf(manager: EntityManager, context: BookingContext): Promise<TicketV2[]> {
    const tickets = await manager.find(Ticket, { where: { bookingId: context.booking.bookingId } });
    const seats = await manager.find(SeatAssignment, { where: { bookingId: context.booking.bookingId } });
    return context.passengers
      .map((passenger) => ({ passenger, ticket: tickets.find((t) => t.passengerId === passenger.passengerId) }))
      .filter((row): row is { passenger: (typeof context.passengers)[number]; ticket: Ticket } => !!row.ticket)
      .map(({ passenger, ticket }) => ({
        ticketId: ticket.ticketId,
        bookingId: ticket.bookingId,
        passengerId: passenger.clientPassengerId,
        passengerName: `${passenger.firstName} ${passenger.lastName}`,
        eTicketNumber: ticket.eTicketNumber ?? null,
        status: ticket.status,
        issuedAt: ticket.issuedAt ? toIso(ticket.issuedAt) : null,
        segments: context.legs.map((leg, index) => ({
          segmentId: leg.vueloId,
          status: ticket.status === 'ISSUED' || ticket.status === 'REFUNDED' || ticket.status === 'VOIDED' ? 'ISSUED' : ticket.status === 'FAILED' ? 'FAILED' : 'PENDING',
          couponNumber: ticket.eTicketNumber ? `${ticket.eTicketNumber}-${index + 1}` : null,
          flightNumber: leg.vuelo.codigoVuelo,
          departureIataCode: leg.vuelo.origenIATA,
          arrivalIataCode: leg.vuelo.destinoIATA,
          departureAt: toIso(leg.vuelo.fechaSalida),
          arrivalAt: toIso(leg.vuelo.fechaLlegada),
          seatNumber: seats.find((s) => s.passengerId === passenger.passengerId && s.vueloId === leg.vueloId)?.seatNumber ?? null,
        })),
        failureReason: null,
      }));
  }

  async checkInResponse(base: CheckInResponseDto): Promise<CheckInResponseDto & { _links: Links }> {
    return { ...base, _links: checkInLinks(base.bookingId) };
  }

  /** Boarding passes with the departure gate of each segment. */
  async boardingPasses(base: BoardingPassListResponseDto): Promise<{ bookingId: string; boardingPasses: (BoardingPassListResponseDto['boardingPasses'][number] & { gate: string | null })[] }> {
    const vueloIds = [...new Set(base.boardingPasses.map((p) => p.segmentId))];
    const vuelos = vueloIds.length ? await this.dataSource.manager.find(Vuelo, { where: { id: In(vueloIds) } }) : [];
    return { ...base, boardingPasses: base.boardingPasses.map((p) => ({ ...p, gate: vuelos.find((v) => v.id === p.segmentId)?.puertaSalida ?? null })) };
  }

  /** Status of every taken seat of a flight: BOOKED/TICKETED (by ticket), CHECKED_IN and BOARDED (checked in and the flight left). */
  async seatStatuses(vueloId: string): Promise<Map<string, SeatStatus>> {
    const manager = this.dataSource.manager;
    const assignments = await manager.find(SeatAssignment, { where: { vueloId } });
    if (assignments.length === 0) return new Map();
    const passengerIds = assignments.map((a) => a.passengerId);
    const tickets = await manager.find(Ticket, { where: { passengerId: In(passengerIds) } });
    const checkIns = await manager.find(CheckIn, { where: { vueloId, passengerId: In(passengerIds) } });
    const vuelo = await manager.findOne(Vuelo, { where: { id: vueloId } });
    const left = !!vuelo && (['DEPARTED', 'ARRIVED'].includes(vuelo.estado) || new Date(vuelo.fechaSalida).getTime() <= Date.now());
    const result = new Map<string, SeatStatus>();
    for (const a of assignments) {
      const checkedIn = checkIns.some((c) => c.passengerId === a.passengerId);
      const ticketed = tickets.some((t) => t.passengerId === a.passengerId && t.status === 'ISSUED');
      result.set(a.seatNumber, checkedIn ? (left ? 'BOARDED' : 'CHECKED_IN') : ticketed ? 'TICKETED' : 'BOOKED');
    }
    return result;
  }

  /** The v1 seat map with `status` per seat. */
  async seatmap(base: { segmentId: string; cabins: { cabinClass: string; rows: { rowNumber: number; seats: { seatNumber: string; isAvailable: boolean; characteristics: string[] }[] }[] }[] }) {
    const statuses = await this.seatStatuses(base.segmentId);
    return {
      ...base,
      cabins: base.cabins.map((cabin) => ({
        ...cabin,
        rows: cabin.rows.map((row) => ({ ...row, seats: row.seats.map((seat) => ({ ...seat, status: statuses.get(seat.seatNumber) ?? 'AVAILABLE' })) })),
      })),
    };
  }

  /** Exposed for the seat change: the cabin layout of a flight. */
  cabinSeats(capacity: number): string[] {
    return buildSeatGrid(capacity).flatMap((row) => row.seats.map((s) => s.seatNumber));
  }

  private salesChannelOf(booking: Booking): { salesChannel?: Record<string, unknown> } {
    if (!booking.channelPartnerId && !booking.channelPartnerOrderId && !booking.channelPackageId && !booking.channelPromotionApplied) return {};
    return {
      salesChannel: {
        ...(booking.channelPartnerId ? { partnerId: booking.channelPartnerId } : {}),
        ...(booking.channelPartnerOrderId ? { partnerOrderId: booking.channelPartnerOrderId } : {}),
        packageId: booking.channelPackageId ?? null,
        promotionApplied: booking.channelPromotionApplied ?? false,
        ...(booking.channelDiscountPercentage !== null && booking.channelDiscountPercentage !== undefined ? { discountPercentage: booking.channelDiscountPercentage } : {}),
      },
    };
  }

  private load(manager: EntityManager, ownerId: string, bookingId: string): Promise<BookingContext> {
    return this.context.load(manager, ownerId, bookingId);
  }
}
