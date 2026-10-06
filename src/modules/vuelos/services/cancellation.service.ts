import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthClaims } from '../auth/token.service';
import { DomainEventBus } from '../common/domain-event-bus';
import { formatMinorUnits, toMinorUnits } from '../common/money.util';
import { CancellationAmounts, cancellationAmounts, hasDeparted, isBeforeCutoff } from '../common/postsale-rules';
import { priceForPartyParts } from '../common/pricing.util';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { BaggagePurchase } from '../entities/baggage-purchase.entity';
import { CancellationQuote } from '../entities/cancellation-quote.entity';
import { CheckIn } from '../entities/check-in.entity';
import { SeatAssignment } from '../entities/seat-assignment.entity';
import { Ticket } from '../entities/ticket.entity';
import type { CancelBookingRequestDto, CancelBookingResponseDto, CancellationQuoteResponseDto } from '../dto/postventa.dto';
import { BookingContext, BookingContextService } from './booking-context.service';
import { IdempotencyService } from './idempotency.service';
import { InventoryService } from './inventory.service';

interface CancelOutcome {
  response: CancelBookingResponseDto;
  event: Record<string, unknown>;
}

/** Quote and execute the cancellation of a booking: tickets refunded or voided, seats returned, refund announced. */
@Injectable()
export class CancellationService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: BookingContextService,
    private readonly inventory: InventoryService,
    private readonly idempotency: IdempotencyService,
    private readonly events: DomainEventBus,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  async quote(ownerId: string, bookingId: string): Promise<CancellationQuoteResponseDto> {
    const manager = this.dataSource.manager;
    const context = await this.context.load(manager, ownerId, bookingId);
    this.context.assertConfirmed(context.booking);
    this.assertCancellable(context);

    const amounts = await this.amountsFor(manager, context, this.config.postSale.cancelPenaltyPercent);
    const quote = await manager.save(
      manager.create(CancellationQuote, {
        bookingId,
        ownerId,
        isRefundable: amounts.isRefundable,
        refundMinor: amounts.refundMinor,
        penaltyMinor: amounts.penaltyMinor,
        currency: context.booking.currency,
        status: 'OPEN',
        expiresAt: new Date(Date.now() + this.config.postSale.quoteTtlMinutes * 60_000),
      }),
    );
    return {
      quoteId: quote.quoteId,
      isRefundable: quote.isRefundable,
      refundAmount: formatMinorUnits(quote.refundMinor),
      penaltyAmount: formatMinorUnits(quote.penaltyMinor),
      currency: quote.currency,
      expiresAt: quote.expiresAt.toISOString(),
    };
  }

  async cancel(auth: AuthClaims, idempotencyKey: string, bookingId: string, request: CancelBookingRequestDto): Promise<CancelBookingResponseDto> {
    const outcome = await this.idempotency.execute<CancelOutcome>(
      { key: idempotencyKey, route: `POST /bookings/${bookingId}/cancel`, ownerId: auth.ownerId, body: request },
      HttpStatus.OK,
      async (manager) => {
        const context = await this.context.load(manager, auth.ownerId, bookingId, { lock: true });
        this.context.assertConfirmed(context.booking);
        this.assertCancellable(context);

        const quote = await manager.findOne(CancellationQuote, { where: { quoteId: request.quoteId, bookingId }, lock: { mode: 'pessimistic_write' } });
        if (!quote) {
          throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Unknown quote', `Quote ${request.quoteId} does not belong to booking ${bookingId}.`, [
            { name: 'quoteId', reason: 'not a quote of this booking' },
          ]);
        }
        if (quote.status !== 'OPEN' || quote.expiresAt.getTime() <= Date.now()) {
          throw new ProblemDetailsException(HttpStatus.GONE, 'QUOTE_EXPIRED', 'Quote expired', `Quote ${quote.quoteId} is no longer valid; ask for a new one.`);
        }
        quote.status = 'USED';
        await manager.save(quote);

        const amounts: CancellationAmounts = { isRefundable: quote.isRefundable, refundMinor: quote.refundMinor, penaltyMinor: quote.penaltyMinor };
        return this.applyCancellation(manager, context, amounts, request.reason ?? 'Cancelada por el viajero');
      },
    );
    if (!outcome.replayed) {
      await this.events.publish('booking.cancelled', bookingId, outcome.result.event);
    }
    return outcome.result.response;
  }

  /**
   * Cancels a booking inside the caller's transaction and returns the response and the event to publish once it
   * commits. Used by the traveller's cancellation and by an admin cancelling a flight (which refunds everything).
   */
  async applyCancellation(manager: EntityManager, context: BookingContext, amounts: CancellationAmounts, reason: string): Promise<CancelOutcome> {
    const { booking, hold } = context;
    const refunded = amounts.refundMinor > 0;

    booking.status = 'CANCELLED';
    this.context.addChange(booking, `Reserva cancelada (${reason}). Reembolso ${formatMinorUnits(amounts.refundMinor)} ${booking.currency}, penalidad ${formatMinorUnits(amounts.penaltyMinor)} ${booking.currency}.`);
    await manager.save(booking);

    await manager.update(Ticket, { bookingId: booking.bookingId }, { status: refunded ? 'REFUNDED' : 'VOIDED' });
    await manager.delete(SeatAssignment, { bookingId: booking.bookingId });
    await manager.delete(CheckIn, { bookingId: booking.bookingId });
    // Exactly what the hold took from each flight goes back; never a recomputed figure.
    await this.inventory.restore(manager, hold.inventory);

    return {
      response: {
        bookingId: booking.bookingId,
        status: booking.status,
        refundAmount: formatMinorUnits(amounts.refundMinor),
        penaltyAmount: formatMinorUnits(amounts.penaltyMinor),
        currency: booking.currency,
      },
      event: {
        bookingId: booking.bookingId,
        pnr: booking.pnr,
        ownerId: booking.ownerId,
        status: booking.status,
        paymentReference: booking.paymentReference,
        refundAmount: formatMinorUnits(amounts.refundMinor),
        refundMinor: amounts.refundMinor,
        penaltyAmount: formatMinorUnits(amounts.penaltyMinor),
        currency: booking.currency,
        reason,
      },
    };
  }

  /** The refund and penalty of a booking for a given penalty percentage (0 when the airline cancels). */
  async amountsFor(manager: EntityManager, context: BookingContext, penaltyPercent: number, airlineCancelled = false): Promise<CancellationAmounts> {
    const taxesMinor = context.legs.reduce(
      (sum, leg) => sum + priceForPartyParts(toMinorUnits(leg.vuelo.precioBase), leg.family.priceMultiplier, context.hold.passengersBreakdown, this.config.taxRate).taxes,
      0,
    );
    const purchases = await manager.find(BaggagePurchase, { where: { bookingId: context.booking.bookingId } });
    return cancellationAmounts({
      fareTotalMinor: toMinorUnits(context.booking.grandTotal),
      taxesMinor,
      baggageMinor: purchases.reduce((sum, p) => sum + p.totalMinor, 0),
      // When the airline is the one cancelling, even a non-refundable fare goes back in full.
      refundable: airlineCancelled || context.legs.every((leg) => leg.family.refundable),
      penaltyPercent: airlineCancelled ? 0 : penaltyPercent,
    });
  }

  /** Cancelling closes at the cutoff before the first departure, like every other change after the sale. */
  private assertCancellable(context: BookingContext): void {
    const departure = new Date(Math.min(...context.legs.map((leg) => new Date(leg.vuelo.fechaSalida).getTime())));
    const now = new Date();
    if (hasDeparted(departure, now)) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'FLIGHT_ALREADY_DEPARTED', 'Flight already departed', 'The first flight of this booking has already departed.');
    }
    if (!isBeforeCutoff(departure, now, this.config.postSale.cutoffHours)) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'CUTOFF_PASSED', 'Cancellation closed', `A booking can be cancelled up to ${this.config.postSale.cutoffHours} h before departure.`);
    }
  }
}

