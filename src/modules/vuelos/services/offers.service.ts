import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import type { AuthClaims } from '../auth/token.service';
import { assertGroupSize, assertInfantRatio } from '../common/business-rules';
import { DomainEventBus } from '../common/domain-event-bus';
import { toIso } from '../common/date.util';
import { formatMinorUnits, toMinorUnits } from '../common/money.util';
import { PassengerBreakdown, priceForParty, seatsRequired } from '../common/pricing.util';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { buildSeatGrid } from '../common/seat-grid';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { FareFamily } from '../entities/fare-family.entity';
import { FlightHold, HoldStatus } from '../entities/flight-hold.entity';
import { FlightOffer } from '../entities/flight-offer.entity';
import { SeatAssignment } from '../entities/seat-assignment.entity';
import { Vuelo } from '../entities/vuelo.entity';
import type { HoldRequestDto, HoldResponseDto, HoldStatusResponseDto } from '../dto/hold.dto';
import { IdempotencyService } from './idempotency.service';
import { InventoryService } from './inventory.service';

const HOLD_ROUTE = 'POST /offers/hold';

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    @InjectRepository(FlightOffer) private readonly offers: Repository<FlightOffer>,
    @InjectRepository(FlightHold) private readonly holds: Repository<FlightHold>,
    @InjectRepository(Vuelo) private readonly vuelos: Repository<Vuelo>,
    @InjectRepository(SeatAssignment) private readonly seatAssignments: Repository<SeatAssignment>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
    private readonly idempotency: IdempotencyService,
    private readonly inventory: InventoryService,
    private readonly events: DomainEventBus,
  ) {}

  async getSeatmap(offerId: string, requestedSegmentId?: string) {
    const offer = await this.requireLiveOffer(this.offers.manager, offerId);
    const segmentId = requestedSegmentId ?? offer.itineraries[0].vueloId;

    const reference = offer.itineraries.find((i) => i.vueloId === segmentId);
    if (!reference) {
      throw new ProblemDetailsException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Segment not part of the offer',
        `segmentId ${segmentId} does not belong to offer ${offerId}.`,
        [{ name: 'segmentId', reason: 'does not belong to the offer' }],
      );
    }

    const vuelo = await this.vuelos.findOne({ where: { id: segmentId } });
    if (!vuelo) {
      throw new ProblemDetailsException(
        HttpStatus.GONE,
        'OFFER_NO_LONGER_AVAILABLE',
        'Flight no longer available',
        `The flight behind segment ${segmentId} no longer exists.`,
      );
    }

    const taken = new Set(
      (await this.seatAssignments.find({ where: { vueloId: vuelo.id } })).map((s) => s.seatNumber),
    );
    const rows = buildSeatGrid(vuelo.capacidadTotal).map((row) => ({
      rowNumber: row.rowNumber,
      seats: row.seats.map((seat) => ({
        seatNumber: seat.seatNumber,
        isAvailable: !taken.has(seat.seatNumber),
        characteristics: seat.characteristics,
      })),
    }));

    return { segmentId, cabins: [{ cabinClass: 'ECONOMY', rows }] };
  }

  async createHold(auth: AuthClaims, idempotencyKey: string, request: HoldRequestDto): Promise<HoldResponseDto> {
    const scope = { key: idempotencyKey, route: HOLD_ROUTE, ownerId: auth.ownerId, body: request };

    let outcome;
    try {
      outcome = await this.idempotency.execute(scope, HttpStatus.CREATED, (manager) =>
        this.createHoldWithin(manager, auth.ownerId, request),
      );
    } catch (error) {
      // Seats may look sold out only because expired holds were not swept yet: release
      // them and try once more before reporting SEAT_TAKEN.
      const soldOut = error instanceof ProblemDetailsException && (error.getResponse() as { code?: string }).code === 'SEAT_TAKEN';
      if (!soldOut || (await this.expireDueHolds()) === 0) throw error;
      outcome = await this.idempotency.execute(scope, HttpStatus.CREATED, (manager) =>
        this.createHoldWithin(manager, auth.ownerId, request),
      );
    }
    return outcome.result;
  }

  /**
   * The hold itself, run inside the caller's transaction. Public so the e-commerce offer flow can
   * create its offer and the inventory hold atomically instead of compensating a half-done pair.
   */
  async createHoldWithin(
    manager: EntityManager,
    ownerId: string,
    request: HoldRequestDto,
  ): Promise<HoldResponseDto> {
    const offer = await this.requireLiveOffer(manager, request.offerId);

    const breakdown: PassengerBreakdown = {
      adults: request.passengersBreakdown.adults ?? 1,
      youths: request.passengersBreakdown.youths ?? 0,
      children: request.passengersBreakdown.children ?? 0,
      infants: request.passengersBreakdown.infants ?? 0,
    };
    assertInfantRatio(breakdown);
    assertGroupSize(breakdown, this.config.maxPassengersPerOrder);

    // Every leg of the offer must be chosen exactly once.
    const selected = new Set<string>();
    for (const selection of request.itinerarySelections) {
      if (selected.has(selection.itineraryId) || !offer.itineraries.some((i) => i.itineraryId === selection.itineraryId)) {
        throw new ProblemDetailsException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'VALIDATION_FAILED',
          'Invalid itinerary selection',
          `itineraryId ${selection.itineraryId} is duplicated or does not belong to offer ${offer.offerId}.`,
          [{ name: 'itinerarySelections.itineraryId', reason: 'duplicated or not part of the offer' }],
        );
      }
      // Only the economy cabin is sold and priced in this phase: do not quote a premium cabin at economy fares.
      if (selection.cabinClass !== 'ECONOMY') {
        throw new ProblemDetailsException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'VALIDATION_FAILED',
          'Cabin not available',
          `Only ECONOMY is available in this phase, not ${selection.cabinClass}.`,
          [{ name: 'itinerarySelections.cabinClass', reason: 'only ECONOMY is available' }],
        );
      }
      selected.add(selection.itineraryId);
    }
    if (selected.size !== offer.itineraries.length) {
      throw new ProblemDetailsException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VALIDATION_FAILED',
        'Incomplete itinerary selection',
        'itinerarySelections must choose a fare for every itinerary of the offer.',
        [{ name: 'itinerarySelections', reason: 'one selection per itinerary is required' }],
      );
    }

    const families = await manager.find(FareFamily, {
      where: { code: In(request.itinerarySelections.map((s) => s.fareBrand)) },
    });
    const vuelos = await manager.find(Vuelo, { where: { id: In(offer.itineraries.map((i) => i.vueloId)) } });

    const seats = seatsRequired(breakdown);
    let lockedMinor = 0;
    const inventory: { vueloId: string; seats: number }[] = [];

    for (const selection of request.itinerarySelections) {
      const reference = offer.itineraries.find((i) => i.itineraryId === selection.itineraryId)!;
      const vuelo = vuelos.find((v) => v.id === reference.vueloId);
      const family = families.find((f) => f.code === selection.fareBrand);

      if (!vuelo) {
        throw new ProblemDetailsException(HttpStatus.GONE, 'OFFER_NO_LONGER_AVAILABLE', 'Flight no longer available', `Flight ${reference.vueloId} no longer exists.`);
      }
      if (!family) {
        throw new ProblemDetailsException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'VALIDATION_FAILED',
          'Unknown fare brand',
          `fareBrand ${selection.fareBrand} does not exist.`,
          [{ name: 'itinerarySelections.fareBrand', reason: 'unknown fare brand' }],
        );
      }
      if (new Date(vuelo.fechaSalida).getTime() <= Date.now()) {
        throw new ProblemDetailsException(HttpStatus.GONE, 'OFFER_NO_LONGER_AVAILABLE', 'Flight already departed', `Flight ${vuelo.codigoVuelo} has already departed.`);
      }

      lockedMinor += priceForParty(toMinorUnits(vuelo.precioBase), family.priceMultiplier, breakdown, this.config.taxRate);
      inventory.push({ vueloId: vuelo.id, seats });
    }

    await this.inventory.reserve(manager, inventory);

    const expiresAt = new Date(Date.now() + this.config.holdTtlMinutes * 60_000);
    const hold = await manager.save(
      manager.create(FlightHold, {
        offerId: offer.offerId,
        ownerId,
        status: 'HELD',
        lockedPrice: formatMinorUnits(lockedMinor),
        currency: offer.currency,
        ttlMinutes: this.config.holdTtlMinutes,
        itinerarySelections: request.itinerarySelections,
        passengersBreakdown: breakdown,
        inventory,
        expiresAt,
      }),
    );

    return {
      holdId: hold.holdId,
      status: 'HELD',
      expiresAt: expiresAt.toISOString(),
      ttlMinutes: hold.ttlMinutes,
      lockedPrice: { currency: offer.currency, total: hold.lockedPrice },
    };
  }

  async getHoldStatus(ownerId: string, holdId: string): Promise<HoldStatusResponseDto> {
    let hold = await this.findOwnedHoldOrThrow(this.holds.manager, ownerId, holdId);
    if (hold.status === 'HELD' && hold.expiresAt.getTime() <= Date.now()) {
      await this.expireIfDue(holdId);
      hold = await this.findOwnedHoldOrThrow(this.holds.manager, ownerId, holdId);
    }

    return {
      status: hold.status,
      expiresAt: toIso(hold.expiresAt),
      remainingSeconds: hold.status === 'HELD' ? Math.max(0, Math.floor((hold.expiresAt.getTime() - Date.now()) / 1000)) : 0,
      lockedPrice: { currency: hold.currency, total: hold.lockedPrice },
    };
  }

  /** DELETE is idempotent: releasing a released hold is a no-op; a consumed or expired one is not releasable. */
  async releaseHold(ownerId: string, holdId: string): Promise<void> {
    const released = await this.dataSource.transaction(async (manager) => {
      const hold = await manager.findOne(FlightHold, { where: { holdId }, lock: { mode: 'pessimistic_write' } });
      this.assertOwner(hold, ownerId, holdId);

      switch (hold.status) {
        case 'RELEASED':
          return false;
        case 'CONSUMED':
          throw new ProblemDetailsException(HttpStatus.CONFLICT, 'BOOKING_NOT_CONFIRMED', 'Hold already consumed', `Hold ${holdId} was already used for a booking and cannot be released.`);
        case 'EXPIRED':
          throw new ProblemDetailsException(HttpStatus.GONE, 'QUOTE_EXPIRED', 'Hold expired', `Hold ${holdId} has already expired.`);
        default:
          if (hold.expiresAt.getTime() <= Date.now()) {
            await this.transition(manager, hold, 'EXPIRED');
            return 'expired' as const;
          }
          await this.transition(manager, hold, 'RELEASED');
          return true;
      }
    });

    if (released === 'expired') {
      await this.events.publish('hold.expired', holdId, { holdId });
      throw new ProblemDetailsException(HttpStatus.GONE, 'QUOTE_EXPIRED', 'Hold expired', `Hold ${holdId} has already expired.`);
    }
    if (released) {
      await this.events.publish('hold.released', holdId, { holdId });
    }
  }

  /** Expires one hold if (and only if) it is still HELD past its expiry, restoring its seats. Idempotent. */
  async expireIfDue(holdId: string): Promise<boolean> {
    const expired = await this.dataSource.transaction(async (manager) => {
      const hold = await manager.findOne(FlightHold, { where: { holdId }, lock: { mode: 'pessimistic_write' } });
      if (!hold || hold.status !== 'HELD' || hold.expiresAt.getTime() > Date.now()) return false;
      return this.transition(manager, hold, 'EXPIRED');
    });
    if (expired) {
      await this.events.publish('hold.expired', holdId, { holdId });
    }
    return expired;
  }

  /** Sweeps every overdue hold. Safe to run from several instances: rows are claimed with SKIP LOCKED. */
  async expireDueHolds(): Promise<number> {
    const expiredIds: string[] = await this.dataSource.transaction(async (manager) => {
      const due = await manager
        .getRepository(FlightHold)
        .createQueryBuilder('h')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('h.status = :status AND h.expiresAt < :now', { status: 'HELD', now: new Date() })
        .getMany();

      const ids: string[] = [];
      for (const hold of due) {
        if (await this.transition(manager, hold, 'EXPIRED')) ids.push(hold.holdId);
      }
      return ids;
    });

    for (const holdId of expiredIds) {
      await this.events.publish('hold.expired', holdId, { holdId });
    }
    if (expiredIds.length > 0) {
      this.logger.log(`Expired ${expiredIds.length} overdue hold(s) and restored their seats`);
    }
    return expiredIds.length;
  }

  /**
   * HELD -> RELEASED|EXPIRED as a conditional UPDATE: only the caller that wins the
   * transition restores the seats, so a seat can never be returned twice.
   */
  private async transition(manager: EntityManager, hold: FlightHold, to: Extract<HoldStatus, 'RELEASED' | 'EXPIRED'>): Promise<boolean> {
    const result = await manager.update(FlightHold, { holdId: hold.holdId, status: 'HELD' }, { status: to });
    if (result.affected !== 1) return false;
    await this.inventory.restore(manager, hold.inventory);
    return true;
  }

  private async requireLiveOffer(manager: EntityManager, offerId: string): Promise<FlightOffer> {
    const offer = await manager.findOne(FlightOffer, { where: { offerId } });
    if (!offer) {
      throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'OFFER_NO_LONGER_AVAILABLE', 'Offer not found', `Offer ${offerId} was not found or has expired.`);
    }
    if (offer.expiresAt.getTime() <= Date.now()) {
      throw new ProblemDetailsException(HttpStatus.GONE, 'QUOTE_EXPIRED', 'Offer expired', `Offer ${offerId} expired at ${toIso(offer.expiresAt)}.`);
    }
    return offer;
  }

  private async findOwnedHoldOrThrow(manager: EntityManager, ownerId: string, holdId: string): Promise<FlightHold> {
    const hold = await manager.findOne(FlightHold, { where: { holdId } });
    this.assertOwner(hold, ownerId, holdId);
    return hold;
  }

  private assertOwner(hold: FlightHold | null, ownerId: string, holdId: string): asserts hold is FlightHold {
    if (!hold) {
      throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'OFFER_NO_LONGER_AVAILABLE', 'Hold not found', `Hold ${holdId} was not found.`);
    }
    if (hold.ownerId !== ownerId) {
      throw new ProblemDetailsException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Hold belongs to another user', 'You do not have access to this hold.');
    }
  }
}
