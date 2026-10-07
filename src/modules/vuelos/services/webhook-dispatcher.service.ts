import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { runtimeMetrics } from '../common/runtime-metrics';
import { postJson, resolveSafeTarget, signWebhookBody } from '../common/safe-http';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { WebhookSubscription } from '../entities/webhook-subscription.entity';

const POLL_INTERVAL_MS = 15_000;
const BATCH = 10;
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 4_096;
/** While a delivery is being attempted it is leased this long, so another instance leaves it alone. */
const LEASE_MS = 60_000;
/** Wait before the retry after the n-th failed attempt: 1 min, 5 min, 30 min, 2 h, 6 h; then the delivery is dead. */
export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 6 * 3_600_000];

export interface DispatchResult {
  delivered: number;
  failed: number;
  dead: number;
}

/**
 * Sends the queued webhook deliveries. Same shape as the other background jobs (timer + `running` flag + metrics):
 * it claims due rows with FOR UPDATE SKIP LOCKED and a short lease, so several instances share the work without
 * ever sending a delivery twice at the same time. Every attempt goes through the SSRF-safe client; a 2xx answer
 * delivers, anything else (or no answer) is retried with backoff until the delivery is declared dead.
 */
@Injectable()
export class WebhookDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookDispatcherService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.process(), POLL_INTERVAL_MS);
    // Never keep the process (or a test run) alive just for housekeeping.
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async process(now: Date = new Date()): Promise<DispatchResult> {
    const result: DispatchResult = { delivered: 0, failed: 0, dead: 0 };
    if (this.running) return result;
    this.running = true;
    const startedAt = Date.now();
    try {
      for (const delivery of await this.claimDue(now)) {
        const outcome = await this.attempt(delivery, now);
        result[outcome] += 1;
      }
      runtimeMetrics.recordJob('webhook-dispatcher', { durationMs: Date.now() - startedAt, result: { ...result } });
    } catch (error) {
      runtimeMetrics.recordJob('webhook-dispatcher', { durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) });
      this.logger.error(`Webhook dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
    return result;
  }

  /** Due deliveries, leased to this run. */
  private async claimDue(now: Date): Promise<WebhookDelivery[]> {
    return this.dataSource.transaction(async (manager) => {
      const due = await manager
        .createQueryBuilder(WebhookDelivery, 'd')
        .where("d.status = 'PENDING' AND d.\"nextAttemptAt\" <= :now", { now })
        .orderBy('d."nextAttemptAt"', 'ASC')
        .limit(BATCH)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();
      for (const delivery of due) {
        delivery.nextAttemptAt = new Date(now.getTime() + LEASE_MS);
      }
      if (due.length > 0) await manager.save(due);
      return due;
    });
  }

  private async attempt(delivery: WebhookDelivery, now: Date): Promise<keyof DispatchResult> {
    const repo = this.dataSource.getRepository(WebhookDelivery);
    const subscription = await this.dataSource.getRepository(WebhookSubscription).findOne({ where: { id: delivery.subscriptionId } });
    if (!subscription || !subscription.active) {
      await repo.update({ deliveryId: delivery.deliveryId }, { status: 'DEAD', lastError: 'subscription removed' });
      return 'dead';
    }

    delivery.attempts += 1;
    let statusCode: number | null = null;
    let error: string | null = null;
    try {
      // Resolved again at every attempt: an address that turned private since registration is refused.
      const target = await resolveSafeTarget(subscription.url, this.config.webhooks.allowPrivateHosts);
      const body = JSON.stringify(delivery.payload);
      const timestamp = String(Math.floor(now.getTime() / 1000));
      const response = await postJson(
        target,
        body,
        {
          'User-Agent': 'RAM-Alliance-Webhooks/1',
          'X-Webhook-Id': delivery.deliveryId,
          'X-Webhook-Event': delivery.eventType,
          'X-Webhook-Timestamp': timestamp,
          'X-Webhook-Signature': signWebhookBody(subscription.secret, timestamp, body),
        },
        { timeoutMs: REQUEST_TIMEOUT_MS, maxResponseBytes: MAX_RESPONSE_BYTES },
      );
      statusCode = response.status;
      if (response.status < 200 || response.status >= 300) error = `the receiver answered ${response.status}`;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    if (!error) {
      await repo.update({ deliveryId: delivery.deliveryId }, { status: 'DELIVERED', attempts: delivery.attempts, lastStatusCode: statusCode, lastError: null, deliveredAt: new Date() });
      return 'delivered';
    }

    const retryIn = RETRY_DELAYS_MS[delivery.attempts - 1];
    if (retryIn === undefined) {
      await repo.update({ deliveryId: delivery.deliveryId }, { status: 'DEAD', attempts: delivery.attempts, lastStatusCode: statusCode, lastError: error.slice(0, 300) });
      return 'dead';
    }
    await repo.update(
      { deliveryId: delivery.deliveryId },
      { attempts: delivery.attempts, lastStatusCode: statusCode, lastError: error.slice(0, 300), nextAttemptAt: new Date(now.getTime() + retryIn) },
    );
    return 'failed';
  }
}
