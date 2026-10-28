import { createHmac, timingSafeEqual } from 'node:crypto';
import { Body, Headers, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { BOOKING_INBOUND_TYPES, bookingCloudEventToDomainEvent } from '../common/cloud-events';
import { DomainEventBus } from '../common/domain-event-bus';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { V2Controller } from './v2-controller';

const sameSignature = (expected: string, received: string): boolean => {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Booking Prototipo's events over HTTP (the same events as the broker's `q.vuelos.entrantes`, for a deployment without
 * RabbitMQ, e.g. the local Tailscale tests): `pagos.payment.confirmed`, `pagos.payment.failed` and
 * `paquetes.package.cancelled`, as structured CloudEvents. The request is authenticated by its signature,
 * `X-Webhook-Signature: sha256=<HMAC-SHA256(BOOKING_WEBHOOK_SECRET, raw body)>` (the `timestamp.body` form is accepted when
 * `X-Webhook-Timestamp` is sent). The handlers are idempotent, so Booking may retry: a handler failure answers 500.
 */
@V2Controller('webhooks/booking')
export class BookingInboundV2Controller {
  constructor(
    private readonly events: DomainEventBus,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers('x-webhook-signature') signature: string | undefined,
    @Headers('x-webhook-timestamp') timestamp: string | undefined,
    @Body() body: unknown,
  ) {
    const secret = this.config.booking.webhookSecret;
    const raw = request.rawBody?.toString('utf8') ?? '';
    const hmac = (text: string) => `sha256=${createHmac('sha256', secret).update(text).digest('hex')}`;
    const valid = !!secret && !!signature && (sameSignature(hmac(raw), signature) || (!!timestamp && sameSignature(hmac(`${timestamp}.${raw}`), signature)));
    if (!valid) {
      throw new ProblemDetailsException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Firma inválida', secret ? 'X-Webhook-Signature no coincide con el cuerpo.' : 'Este nodo no tiene BOOKING_WEBHOOK_SECRET configurado.');
    }

    let event;
    try {
      event = bookingCloudEventToDomainEvent(body);
    } catch {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Evento inválido', 'El cuerpo debe ser un CloudEvent de Booking (type ec.edu.epn.booking.<evento>).');
    }
    if (!(BOOKING_INBOUND_TYPES as readonly string[]).includes(event.type)) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Evento no soportado', `Este nodo atiende ${BOOKING_INBOUND_TYPES.join(', ')}; llegó ${event.type}.`);
    }
    const { fallos } = await this.events.despachar(event);
    if (fallos > 0) {
      throw new ProblemDetailsException(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', 'No se pudo procesar', 'El evento no se procesó; reintente.');
    }
    return { received: true, eventId: event.id };
  }
}
