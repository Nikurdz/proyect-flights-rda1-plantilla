import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainEvent, DomainEventBus } from '../common/domain-event-bus';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { resolveSafeTarget, UnsafeUrlError } from '../common/safe-http';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { toCloudEvent, VUELOS_EVENT_NAMES } from '../common/cloud-events';
import { WEBHOOK_EVENTS } from '../dto/enums';
import type { WebhookSubscriptionDto } from '../dto/webhooks.dto';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { WebhookSubscription, WebhookSubscriptionEvent } from '../entities/webhook-subscription.entity';

export const WEBHOOK_API_VERSION = '1.5.0.0';

/** What a subscriber sees of a subscription: never the secret, which only signs deliveries. */
export interface WebhookSubscriptionView {
  id: string;
  url: string;
  events: string[];
}

const view = (s: WebhookSubscription): WebhookSubscriptionView => ({ id: s.id, url: s.url, events: s.events });

/** The view contract v2 returns: the same plus `active` and `createdAt` (the secret is write-only). */
export interface WebhookSubscriptionViewV2 extends WebhookSubscriptionView {
  active: boolean;
  createdAt: string;
}

export const viewV2 = (s: WebhookSubscription): WebhookSubscriptionViewV2 => ({ ...view(s), active: s.active, createdAt: s.createdAt.toISOString() });

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
    for (const type of new Set<string>([...WEBHOOK_EVENTS, ...VUELOS_EVENT_NAMES])) {
      this.events.subscribe(type, (event) => this.enqueue(event));
    }
  }

  async create(ownerId: string, request: WebhookSubscriptionDto, apiVersion = 1): Promise<WebhookSubscriptionView> {
    return view(await this.createRow(ownerId, request, apiVersion));
  }

  /** Same as `create`, returning the stored subscription (v2 shows `active` and `createdAt` too). */
  async createRow(ownerId: string, request: WebhookSubscriptionDto, apiVersion = 1): Promise<WebhookSubscription> {
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
    const saved = await this.subscriptions.save(this.subscriptions.create({
        ownerId,
        url: request.url,
        eventos: [...new Set(request.events)].map((evento) => this.subscriptions.manager.create(WebhookSubscriptionEvent, { evento })),
        secret: request.secret,
        active: true,
        apiVersion,
      }));
    return saved;
  }

  async list(ownerId: string): Promise<WebhookSubscriptionView[]> {
    return (await this.listRows(ownerId)).map(view);
  }

  async listRows(ownerId: string): Promise<WebhookSubscription[]> {
    return this.subscriptions.find({ where: { ownerId, active: true }, relations: { eventos: true }, order: { createdAt: 'ASC' } });
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
    const eventOwners = [...new Set([...(Array.isArray(payload.ownerIds) ? payload.ownerIds : []), payload.ownerId].filter((o): o is string => typeof o === 'string'))];
    if (eventOwners.length === 0) return;
    // A booking made by a partner for one of its users (`partner:<id>:user:<u>`) is also heard by the partner's own webhooks (`partner:<id>`).
    const owners = [...new Set(eventOwners.flatMap((o) => (o.startsWith('partner:') ? [o, o.split(':').slice(0, 2).join(':')] : [o])))];

    const subscribers = await this.subscriptions
      .createQueryBuilder('s')
      .innerJoin('s.eventos', 'e', 'e.evento = :tipo', { tipo: event.type })
      .where('s."ownerId" IN (:...owners)', { owners })
      .andWhere('s.active = true')
      .getMany();
    if (subscribers.length === 0) return;

    const legacyBody = this.payloadOf(event, payload);
    const cloudEvent = toCloudEvent(event, this.config.nodeSource);
    for (const subscription of subscribers) {
      const body = subscription.apiVersion === 2 && cloudEvent ? (cloudEvent as unknown as Record<string, unknown>) : legacyBody;
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
