import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { computeFarePrice } from '../common/pricing.util';
import { FareFamily } from '../entities/fare-family.entity';
import { FlightHold } from '../entities/flight-hold.entity';
import { FlightOffer } from '../entities/flight-offer.entity';
import { Vuelo } from '../entities/vuelo.entity';
import type { HoldRequestDto } from '../dto/hold.dto';
import type { HoldResponseDto, HoldStatusResponseDto } from '../dto/hold.dto';
import { IdempotencyService } from './idempotency.service';

const SEAT_CHARACTERISTICS_BY_COLUMN: Record<string, string[]> = {
  A: ['WINDOW'],
  B: [],
  C: ['AISLE'],
  D: ['AISLE'],
  E: [],
  F: ['WINDOW'],
};

@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(FlightOffer) private readonly offers: Repository<FlightOffer>,
    @InjectRepository(FlightHold) private readonly holds: Repository<FlightHold>,
    @InjectRepository(Vuelo) private readonly vuelos: Repository<Vuelo>,
    @InjectRepository(FareFamily) private readonly fareFamilies: Repository<FareFamily>,
    private readonly config: ConfigService,
    private readonly idempotency: IdempotencyService,
  ) {}

  getSeatmap(offerId: string, segmentId: string) {
    // Generated deterministically — there is no persisted aircraft/seat inventory for a
    // direct-flights-only MVP (see the plan's documented simplification).
    const rows = Array.from({ length: 10 }, (_, i) => i + 12).map((rowNumber) => ({
      rowNumber,
      seats: Object.entries(SEAT_CHARACTERISTICS_BY_COLUMN).map(([column, characteristics]) => ({
        seatNumber: `${rowNumber}${column}`,
        isAvailable: (rowNumber + column.charCodeAt(0)) % 5 !== 0,
        characteristics: rowNumber === 12 ? [...characteristics, 'EXTRA_LEGROOM'] : characteristics,
      })),
    }));

    return {
      segmentId,
      cabins: [{ cabinClass: 'ECONOMY', rows }],
    };
  }

  async createHold(
    idempotencyKey: string,
    request: HoldRequestDto,
  ): Promise<HoldResponseDto> {
    const route = 'POST /offers/hold';
    const replay = await this.idempotency.findReplay<HoldResponseDto>(idempotencyKey, route);
    if (replay) {
      return replay;
    }

    const offer = await this.offers.findOne({ where: { offerId: request.offerId } });
    if (!offer) {
      throw new ProblemDetailsException(
        HttpStatus.NOT_FOUND,
        'OFFER_NO_LONGER_AVAILABLE',
        'Offer not found',
        `Offer ${request.offerId} was not found or has expired.`,
      );
    }
    if (offer.expiresAt < new Date()) {
      throw new ProblemDetailsException(
        HttpStatus.GONE,
        'QUOTE_EXPIRED',
        'Offer expired',
        `Offer ${request.offerId} expired at ${offer.expiresAt.toISOString()}.`,
      );
    }

    const taxRate = Number(this.config.get<string>('TAX_RATE', '0.15'));
    const ttlMinutes = Number(this.config.get<string>('HOLD_TTL_MINUTES', '15'));
    const families = await this.fareFamilies.find({
      where: { code: In(request.itinerarySelections.map((s) => s.fareBrand)) },
    });
    const vueloIds = offer.itineraries.map((i) => i.vueloId);
    const vuelos = await this.vuelos.find({ where: { id: In(vueloIds) } });

    let lockedTotal = 0;
    for (const selection of request.itinerarySelections) {
      const ref = offer.itineraries.find((i) => i.itineraryId === selection.itineraryId);
      const vuelo = vuelos.find((v) => v.id === ref?.vueloId);
      const family = families.find((f) => f.code === selection.fareBrand);
      if (!ref || !vuelo || !family) {
        throw new ProblemDetailsException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'VALIDATION_FAILED',
          'Invalid itinerary selection',
          `itineraryId ${selection.itineraryId} or fareBrand ${selection.fareBrand} does not belong to offer ${offer.offerId}.`,
        );
      }
      lockedTotal += computeFarePrice(vuelo.precioBase, family.priceMultiplier, taxRate).total;
    }

    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
    const hold = await this.holds.save(
      this.holds.create({
        offerId: offer.offerId,
        status: 'HELD',
        lockedPrice: lockedTotal.toFixed(2),
        currency: offer.currency,
        ttlMinutes,
        itinerarySelections: request.itinerarySelections,
        passengersBreakdown: offer.passengersBreakdown,
        expiresAt,
      }),
    );

    const response: HoldResponseDto = {
      holdId: hold.holdId,
      status: 'HELD',
      expiresAt: expiresAt.toISOString(),
      ttlMinutes,
      lockedPrice: { currency: offer.currency, total: hold.lockedPrice },
    };

    await this.idempotency.record(idempotencyKey, route, HttpStatus.CREATED, response);
    return response;
  }

  async getHoldStatus(holdId: string): Promise<HoldStatusResponseDto> {
    const hold = await this.findHoldOrThrow(holdId);
    const status = this.lazilyExpire(hold);
    if (status !== hold.status) {
      hold.status = status;
      await this.holds.save(hold);
    }

    const remainingSeconds = Math.max(0, Math.floor((hold.expiresAt.getTime() - Date.now()) / 1000));
    return {
      status: hold.status,
      expiresAt: hold.expiresAt.toISOString(),
      remainingSeconds,
      lockedPrice: { currency: hold.currency, total: hold.lockedPrice },
    };
  }

  async releaseHold(holdId: string): Promise<void> {
    const hold = await this.findHoldOrThrow(holdId);
    await this.setHoldStatus(hold, 'RELEASED');
  }

  /** Used by BookingsService to mark a hold CONSUMED once a booking is created from it. */
  async setHoldStatus(hold: FlightHold, status: FlightHold['status']): Promise<void> {
    hold.status = status;
    await this.holds.save(hold);
  }

  /** Used by BookingsService to atomically consume a hold when creating a booking. */
  async findHoldOrThrow(holdId: string): Promise<FlightHold> {
    const hold = await this.holds.findOne({ where: { holdId } });
    if (!hold) {
      throw new ProblemDetailsException(
        HttpStatus.NOT_FOUND,
        'OFFER_NO_LONGER_AVAILABLE',
        'Hold not found',
        `Hold ${holdId} was not found.`,
      );
    }
    return hold;
  }

  private lazilyExpire(hold: FlightHold): FlightHold['status'] {
    if (hold.status === 'HELD' && hold.expiresAt < new Date()) {
      return 'EXPIRED';
    }
    return hold.status;
  }
}
