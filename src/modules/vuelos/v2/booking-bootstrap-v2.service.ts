import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VUELOS_EVENT_NAMES } from '../common/cloud-events';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { WebhookSubscription, WebhookSubscriptionEvent } from '../entities/webhook-subscription.entity';
import { WebhooksService } from '../services/webhooks.service';

/**
 * Registers Booking Prototipo as a webhook subscriber from the environment (BOOKING_WEBHOOK_URL + BOOKING_WEBHOOK_SECRET):
 * a v2 subscription (CloudEvents signed over the body) to every contract event, owned by the partner so it hears the
 * bookings of all its users. It is idempotent: the same URL is updated, never duplicated. A URL the webhook guard refuses
 * (plain http or a private/Tailscale address outside WEBHOOKS_ALLOW_PRIVATE_HOSTS) is logged and skipped; the app starts anyway.
 */
@Injectable()
export class BookingBootstrapV2Service implements OnApplicationBootstrap {
  private readonly logger = new Logger(BookingBootstrapV2Service.name);

  constructor(
    @InjectRepository(WebhookSubscription) private readonly subscriptions: Repository<WebhookSubscription>,
    private readonly webhooks: WebhooksService,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const { webhookUrl, webhookSecret } = this.config.booking;
    if (!webhookUrl) return;
    const ownerId = `partner:${process.env.PARTNER_CLIENT_ID ?? 'booking-prototipo'}`;
    try {
      const existing = await this.subscriptions.findOne({ where: { ownerId, url: webhookUrl, active: true } });
      if (existing) {
        existing.secret = webhookSecret;
        existing.apiVersion = 2;
        existing.eventos = VUELOS_EVENT_NAMES.map((evento) => this.subscriptions.manager.create(WebhookSubscriptionEvent, { subscriptionId: existing.id, evento }));
        await this.subscriptions.save(existing);
        this.logger.log(`Booking webhook updated: ${new URL(webhookUrl).origin}`);
        return;
      }
      await this.webhooks.createRow(ownerId, { url: webhookUrl, events: [...VUELOS_EVENT_NAMES], secret: webhookSecret }, 2);
      this.logger.log(`Booking webhook registered: ${new URL(webhookUrl).origin}`);
    } catch (error) {
      this.logger.warn(`Booking webhook not registered: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
