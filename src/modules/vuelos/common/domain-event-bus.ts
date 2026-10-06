import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { currentCorrelationId } from './correlation';
import { runtimeMetrics } from './runtime-metrics';

// SRS §10.3: every event carries id, type, schema version, instant, market, correlation id
// and the affected aggregate. Consumers must be idempotent (events may be delivered twice).
export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  schemaVersion: number;
  occurredAt: string;
  market: string | null;
  correlationId: string;
  aggregateId: string;
  payload: T;
}

export type DomainEventHandler = (event: DomainEvent) => Promise<void> | void;

/**
 * In-process event bus. There is no message broker in this phase (RDA1), so domains in
 * the same deployable integrate through this instead of calling each other directly; a
 * broker adapter can replace publish() later without touching producers or consumers.
 * A failing consumer is logged and isolated — it can never fail the producer's request.
 */
@Injectable()
export class DomainEventBus {
  private readonly logger = new Logger('DomainEvents');
  private readonly handlers = new Map<string, DomainEventHandler[]>();

  subscribe(type: string, handler: DomainEventHandler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  async publish<T>(
    type: string,
    aggregateId: string,
    payload: T,
    options: { market?: string | null } = {},
  ): Promise<DomainEvent<T>> {
    const event: DomainEvent<T> = {
      id: randomUUID(),
      type,
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      market: options.market ?? null,
      correlationId: currentCorrelationId(),
      aggregateId,
      payload,
    };

    this.logger.log(`${type} aggregate=${aggregateId} [${event.correlationId}]`);
    runtimeMetrics.recordEvent(type);
    for (const handler of this.handlers.get(type) ?? []) {
      try {
        await handler(event);
      } catch (error) {
        runtimeMetrics.recordConsumerFailure(type);
        this.logger.error(
          `Consumer of ${type} failed (event ${event.id}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return event;
  }
}
