import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { runtimeMetrics } from '../common/runtime-metrics';
import { IdempotencyService } from './idempotency.service';
import { OffersService } from './offers.service';

const SWEEP_INTERVAL_MS = 30_000;

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
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    // Never keep the process (or a test run) alive just for housekeeping.
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const startedAt = Date.now();
    try {
      await this.offers.expireDueHolds();
      await this.idempotency.purgeExpired();
      runtimeMetrics.recordJob('barredor-holds', { durationMs: Date.now() - startedAt });
    } catch (error) {
      runtimeMetrics.recordJob('barredor-holds', { durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) });
      this.logger.error(`Sweep failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
