import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VUELOS_EVENT_NAMES } from '../common/cloud-events';
import { runtimeMetrics } from '../common/runtime-metrics';
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
    if (!webhookUrl) {
      runtimeMetrics.setIntegration('booking-webhook', { estado: 'SIN_CONFIGURAR', detalle: 'BOOKING_WEBHOOK_URL no está definida: Booking no recibe nuestros webhooks.' });
      return;
    }
    const ownerId = `partner:${process.env.PARTNER_CLIENT_ID ?? 'booking-prototipo'}`;
    const destino = new URL(webhookUrl).origin;
    try {
      const existing = await this.subscriptions.findOne({ where: { ownerId, url: webhookUrl, active: true } });
      if (existing) {
        existing.secret = webhookSecret;
        existing.apiVersion = 2;
        existing.eventos = VUELOS_EVENT_NAMES.map((evento) => this.subscriptions.manager.create(WebhookSubscriptionEvent, { subscriptionId: existing.id, evento }));
        await this.subscriptions.save(existing);
        runtimeMetrics.setIntegration('booking-webhook', { estado: 'SUSCRITO', owner: ownerId, destino, suscripcionId: existing.id });
        this.logger.log(`Booking webhook updated: ${destino}`);
        return;
      }
      const created = await this.webhooks.createRow(ownerId, { url: webhookUrl, events: [...VUELOS_EVENT_NAMES], secret: webhookSecret }, 2);
      runtimeMetrics.setIntegration('booking-webhook', { estado: 'SUSCRITO', owner: ownerId, destino, suscripcionId: created.id });
      this.logger.log(`Booking webhook registered: ${destino}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runtimeMetrics.setIntegration('booking-webhook', { estado: 'ERROR', owner: ownerId, destino, detalle: message.slice(0, 300) });
      this.logger.warn(`Booking webhook not registered: ${message}`);
    }
  }
}
