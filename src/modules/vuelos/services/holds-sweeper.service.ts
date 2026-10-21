import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, LessThan } from 'typeorm';
import { CancellationQuote } from '../entities/cancellation-quote.entity';
import { DateChangeOffer } from '../entities/date-change-offer.entity';
import { FlightOffer } from '../entities/flight-offer.entity';
import { runtimeMetrics } from '../common/runtime-metrics';
import { IdempotencyService } from './idempotency.service';
import { OffersService } from './offers.service';

const SWEEP_INTERVAL_MS = 30_000;
// Expired search offers, change offers and quotes are only kept this long (they are dead the moment they expire).
const STALE_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Periodically gives back the seats of holds nobody completed (M2/A9) and prunes old
 * idempotency records. The lazy per-request expiry still guarantees correctness; this only
 * bounds how long expired holds keep inventory out of search results.
 */
@Injectable()
export class HoldsSweeper implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HoldsSweeper.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly offers: OffersService,
    private readonly idempotency: IdempotencyService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    // Never keep the process (or a test run) alive just for housekeeping.
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Search offers, date-change offers and cancellation quotes pile up one row per search/quote and are useless
   * once expired. A search offer a hold still points at is kept (the hold's booking resolves it).
   */
  async purgeStaleOffers(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_RETENTION_MS);
    const manager = this.dataSource.manager;
    await manager.delete(DateChangeOffer, { status: 'OPEN', expiresAt: LessThan(cutoff) });
    await manager.delete(CancellationQuote, { status: 'OPEN', expiresAt: LessThan(cutoff) });
    await manager
      .createQueryBuilder()
      .delete()
      .from(FlightOffer)
      .where('"expiresAt" < :cutoff', { cutoff })
      .andWhere('NOT EXISTS (SELECT 1 FROM "vuelos_flight_holds" h WHERE h."offerId" = "vuelos_flight_offers"."offerId")')
      .execute();
  }

  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const startedAt = Date.now();
    try {
      await this.offers.expireDueHolds();
      await this.idempotency.purgeExpired();
      await this.purgeStaleOffers();
      runtimeMetrics.recordJob('holds-sweeper', { durationMs: Date.now() - startedAt });
    } catch (error) {
      runtimeMetrics.recordJob('holds-sweeper', { durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) });
      this.logger.error(`Sweep failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
