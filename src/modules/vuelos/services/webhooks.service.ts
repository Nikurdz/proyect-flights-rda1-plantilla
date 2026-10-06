import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainEvent, DomainEventBus } from '../common/domain-event-bus';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { resolveSafeTarget, UnsafeUrlError } from '../common/safe-http';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { WEBHOOK_EVENTS } from '../dto/enums';
import type { WebhookSubscriptionDto } from '../dto/webhooks.dto';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { WebhookSubscription } from '../entities/webhook-subscription.entity';

export const WEBHOOK_API_VERSION = '1.5.0.0';

/** What a subscriber sees of a subscription: never the secret, which only signs deliveries. */
export interface WebhookSubscriptionView {
  id: string;
  url: string;
  events: string[];
}

const view = (s: WebhookSubscription): WebhookSubscriptionView => ({ id: s.id, url: s.url, events: s.events });

/**
 * Subscriptions to booking events (GET/POST/DELETE /webhooks) and the fan-out of domain events into deliveries.
 * Subscriptions belong to the account that created them and only receive events about that account's own
 * bookings. The delivery itself (signing, SSRF defence, retries) is WebhookDispatcherService's job.
 */
@Injectable()
export class WebhooksService implements OnModuleInit {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(WebhookSubscription) private readonly subscriptions: Repository<WebhookSubscription>,
    @InjectRepository(WebhookDelivery) private readonly deliveries: Repository<WebhookDelivery>,
    private readonly events: DomainEventBus,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  onModuleInit(): void {
    // Every event the contract lets a subscriber ask for is announced on the in-process bus; a failing consumer is
    // isolated by the bus, so a webhook problem can never fail the operation that produced the event.
    for (const type of WEBHOOK_EVENTS) {
      this.events.subscribe(type, (event) => this.enqueue(event));
    }
  }

  async create(ownerId: string, request: WebhookSubscriptionDto): Promise<WebhookSubscriptionView> {
    try {
      await resolveSafeTarget(request.url, this.config.webhooks.allowPrivateHosts);
    } catch (error) {
      if (error instanceof UnsafeUrlError) {
        throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Webhook URL not accepted', `The webhook URL was rejected: ${error.message}.`, [{ name: 'url', reason: error.message }]);
      }
      throw error;
    }
    const existing = await this.subscriptions.count({ where: { ownerId, active: true } });
    if (existing >= this.config.webhooks.maxPerOwner) {
      throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Too many webhooks', `An account can have at most ${this.config.webhooks.maxPerOwner} webhooks; delete one first.`);
    }
    const saved = await this.subscriptions.save(this.subscriptions.create({ ownerId, url: request.url, events: [...new Set(request.events)], secret: request.secret, active: true }));
    return view(saved);
  }

  async list(ownerId: string): Promise<WebhookSubscriptionView[]> {
    const rows = await this.subscriptions.find({ where: { ownerId, active: true }, order: { createdAt: 'ASC' } });
    return rows.map(view);
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const subscription = await this.subscriptions.findOne({ where: { id, ownerId, active: true } });
    if (!subscription) {
      throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Webhook not found', `Webhook ${id} was not found.`);
    }
    await this.subscriptions.update({ id }, { active: false });
    // Whatever was still waiting for this subscription is dropped with it.
    await this.deliveries.delete({ subscriptionId: id, status: 'PENDING' });
  }

  /** Queues one delivery per matching subscription of the account(s) the event is about; announcing twice queues once. */
  async enqueue(event: DomainEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    const owners = [...new Set([...(Array.isArray(payload.ownerIds) ? payload.ownerIds : []), payload.ownerId].filter((o): o is string => typeof o === 'string'))];
    if (owners.length === 0) return;

    const subscribers = await this.subscriptions
      .createQueryBuilder('s')
      .where('s."ownerId" IN (:...owners)', { owners })
      .andWhere('s.active = true')
      .andWhere('s.events @> :wanted::jsonb', { wanted: JSON.stringify([event.type]) })
      .getMany();
    if (subscribers.length === 0) return;

    const body = this.payloadOf(event, payload);
    for (const subscription of subscribers) {
      await this.deliveries
        .createQueryBuilder()
        .insert()
        .into(WebhookDelivery)
        .values({ subscriptionId: subscription.id, eventId: event.id, eventType: event.type, payload: body, status: 'PENDING', attempts: 0, nextAttemptAt: new Date() })
        .orIgnore()
        .execute();
    }
    this.logger.log(`${event.type} queued for ${subscribers.length} webhook(s)`);
  }

  /** The contract's WebhookPayload: the event and the few facts a subscriber needs to look the rest up. */
  private payloadOf(event: DomainEvent, payload: Record<string, unknown>): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const key of ['bookingId', 'pnr', 'status', 'refundAmount']) {
      if (payload[key] !== undefined && payload[key] !== null) data[key] = payload[key];
    }
    return { eventId: event.id, eventType: event.type, occurredAt: event.occurredAt, apiVersion: WEBHOOK_API_VERSION, data };
  }
}
