import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { DomainEvent, DomainEventBus } from '../common/domain-event-bus';

export const PUBSUB = Symbol('GATEWAY_PUBSUB');
export const TOPIC_ESTADO = 'estadoReservaCambiado';

/**
 * Feeds the `estadoReservaCambiado` subscription from the event bus: every event that names the account it is about
 * (`ownerId`, or the customer id) is pushed to that account's open subscriptions. In process; with RabbitMQ the
 * broker delivers the event to the instance that handles it, and each instance serves its own subscribers.
 */
@Injectable()
export class GatewayEventBridge implements OnModuleInit {
  constructor(
    private readonly events: DomainEventBus,
    @Inject(PUBSUB) private readonly pubsub: PubSub,
  ) {}

  onModuleInit(): void {
    this.events.subscribeAll((event) => this.publicar(event));
  }

  async publicar(event: DomainEvent): Promise<void> {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const ownerId = typeof payload.ownerId === 'string' ? payload.ownerId : typeof payload.clienteId === 'string' ? payload.clienteId : null;
    if (!ownerId) return;
    await this.pubsub.publish(TOPIC_ESTADO, {
      ownerId,
      estadoReservaCambiado: { evento: event.type, agregadoId: event.aggregateId, correlationId: event.correlationId, ocurridoEn: event.occurredAt },
    });
  }
}
