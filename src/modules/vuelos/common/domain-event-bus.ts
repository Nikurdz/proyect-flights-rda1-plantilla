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

/** A message broker the bus can hand events to. While one is set, consumers run when the broker delivers (at least once). */
export interface EventTransport {
  /** Hands the event to the broker. Throws if it cannot (the bus then delivers locally, so no event is lost). */
  publicar(event: DomainEvent): Promise<void>;
}

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
  private readonly catchAll: DomainEventHandler[] = [];
  private transport: EventTransport | null = null;

  subscribe(type: string, handler: DomainEventHandler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  /** Routes events through a broker (RabbitMQ) instead of calling the consumers directly. `null` goes back to in-process. */
  setTransport(transport: EventTransport | null): void {
    this.transport = transport;
  }

  /** A consumer of every event, whatever its type (the audit trail). */
  subscribeAll(handler: DomainEventHandler): void {
    this.catchAll.push(handler);
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
    if (this.transport) {
      try {
        await this.transport.publicar(event);
        return event;
      } catch (error) {
        this.logger.error(`Broker unavailable for ${type} (event ${event.id}), delivering in process: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await this.despachar(event);
    return event;
  }

  /**
   * Runs the consumers of an event, one after another. A consumer that throws is logged and does not stop the rest;
   * the number of failures is returned so a broker consumer can retry the message (consumers are idempotent).
   */
  async despachar(event: DomainEvent): Promise<{ fallos: number }> {
    let fallos = 0;
    for (const handler of [...(this.handlers.get(event.type) ?? []), ...this.catchAll]) {
      try {
        await handler(event);
      } catch (error) {
        fallos++;
        runtimeMetrics.recordConsumerFailure(event.type);
        this.logger.error(`Consumer of ${event.type} failed (event ${event.id}): ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return { fallos };
  }
}
