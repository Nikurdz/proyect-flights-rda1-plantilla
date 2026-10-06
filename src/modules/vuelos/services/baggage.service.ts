import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthClaims } from '../auth/token.service';
import { mapBookingUniqueViolation } from '../common/db-errors';
import { DomainEventBus } from '../common/domain-event-bus';
import { formatMinorUnits } from '../common/money.util';
import { hasDeparted, isBeforeCutoff } from '../common/postsale-rules';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { BaggagePurchase } from '../entities/baggage-purchase.entity';
import type { AddBaggageRequestDto, BaggageAddedResponseDto, BaggageOptionDto } from '../dto/postventa.dto';
import { BookingContextService } from './booking-context.service';
import { IdempotencyService } from './idempotency.service';

interface BaggageOutcome {
  response: BaggageAddedResponseDto;
  event: Record<string, unknown>;
}

/** Extra checked bags after the sale: what can still be bought, and buying it (one transaction, idempotent). */
@Injectable()
export class BaggageService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: BookingContextService,
    private readonly idempotency: IdempotencyService,
    private readonly events: DomainEventBus,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  async options(ownerId: string, bookingId: string): Promise<BaggageOptionDto[]> {
    const manager = this.dataSource.manager;
    const context = await this.context.load(manager, ownerId, bookingId);
    this.context.assertConfirmed(context.booking);
    const purchases = await manager.find(BaggagePurchase, { where: { bookingId } });
    const now = new Date();
    const { baggagePriceMinor, baggageMaxPerLeg, cutoffHours } = this.config.postSale;

    return context.legs.flatMap((leg) => {
      const open = isBeforeCutoff(new Date(leg.vuelo.fechaSalida), now, cutoffHours);
      return context.passengers
        .filter((p) => p.passengerType !== 'INFANT')
        .map((passenger) => {
          const alreadyPurchased = this.purchased(purchases, passenger.passengerId, leg.itineraryId);
          return {
            passengerId: passenger.clientPassengerId,
            itineraryId: leg.itineraryId,
            price: { currency: context.booking.currency, total: formatMinorUnits(baggagePriceMinor) },
            maxAllowed: open ? baggageMaxPerLeg : alreadyPurchased,
            alreadyPurchased,
          };
        });
    });
  }

  async add(auth: AuthClaims, idempotencyKey: string, bookingId: string, request: AddBaggageRequestDto): Promise<BaggageAddedResponseDto> {
    const outcome = await this.idempotency.execute<BaggageOutcome>(
      { key: idempotencyKey, route: `POST /bookings/${bookingId}/baggage`, ownerId: auth.ownerId, body: request },
      HttpStatus.OK,
      async (manager) => {
        try {
          return await this.addWithin(manager, auth.ownerId, bookingId, request);
        } catch (error) {
          throw mapBookingUniqueViolation(error);
        }
      },
    );
    if (!outcome.replayed) {
      await this.events.publish('booking.baggage_added', bookingId, outcome.result.event);
    }
    return outcome.result.response;
  }

  private async addWithin(manager: EntityManager, ownerId: string, bookingId: string, request: AddBaggageRequestDto): Promise<BaggageOutcome> {
    const context = await this.context.load(manager, ownerId, bookingId, { lock: true });
    this.context.assertConfirmed(context.booking);
    const leg = this.context.legOf(context, request.itineraryId, 'itineraryId');
    const passenger = this.context.passengerOf(context, request.passengerId, 'passengerId');
    const { baggagePriceMinor, baggageMaxPerLeg, cutoffHours } = this.config.postSale;

    if (passenger.passengerType === 'INFANT') {
      throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Infants cannot carry baggage', `Passenger ${request.passengerId} is a lap infant.`, [
        { name: 'passengerId', reason: 'a lap infant has no baggage allowance' },
      ]);
    }
    const departure = new Date(leg.vuelo.fechaSalida);
    if (hasDeparted(departure, new Date())) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'FLIGHT_ALREADY_DEPARTED', 'Flight already departed', `Flight ${leg.vuelo.codigoVuelo} has already departed.`);
    }
    if (!isBeforeCutoff(departure, new Date(), cutoffHours)) {
      throw new ProblemDetailsException(HttpStatus.CONFLICT, 'CUTOFF_PASSED', 'Baggage sale closed', `Extra baggage can be bought up to ${cutoffHours} h before departure.`);
    }

    const purchases = await manager.find(BaggagePurchase, { where: { bookingId } });
    const already = this.purchased(purchases, passenger.passengerId, leg.itineraryId);
    if (already + request.quantity > baggageMaxPerLeg) {
      throw new ProblemDetailsException(
        HttpStatus.CONFLICT,
        'BAGGAGE_LIMIT_EXCEEDED',
        'Baggage limit exceeded',
        `A passenger can have at most ${baggageMaxPerLeg} extra bag(s) per leg; ${already} already bought.`,
      );
    }

    await this.context.assertPaymentReferenceFree(manager, request.payment.paymentReference);
    await manager.save(
      manager.create(BaggagePurchase, {
        bookingId,
        passengerId: passenger.passengerId,
        itineraryId: leg.itineraryId,
        vueloId: leg.vueloId,
        quantity: request.quantity,
        unitPriceMinor: baggagePriceMinor,
        totalMinor: baggagePriceMinor * request.quantity,
        currency: context.booking.currency,
        paymentReference: request.payment.paymentReference,
      }),
    );

    const totalBaggage = already + request.quantity;
    return {
      response: { passengerId: request.passengerId, itineraryId: leg.itineraryId, totalBaggage },
      event: {
        bookingId,
        pnr: context.booking.pnr,
        ownerId,
        status: context.booking.status,
        passengerId: request.passengerId,
        itineraryId: leg.itineraryId,
        quantity: request.quantity,
        totalBaggage,
      },
    };
  }

  private purchased(purchases: BaggagePurchase[], passengerId: string, itineraryId: string): number {
    return purchases.filter((p) => p.passengerId === passengerId && p.itineraryId === itineraryId).reduce((sum, p) => sum + p.quantity, 0);
  }
}
