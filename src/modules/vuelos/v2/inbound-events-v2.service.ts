import { createHash } from 'node:crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DomainEvent, DomainEventBus } from '../common/domain-event-bus';
import { Booking } from '../entities/booking.entity';
import { CancellationService } from '../services/cancellation.service';
import { TicketsV2Service } from './tickets-v2.service';

/** An event id as the UUID the idempotency guard expects (the same event always maps to the same key). */
const keyFor = (eventId: string): string => {
  const h = createHash('sha256').update(`vuelos-inbound:${eventId}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

/**
 * What the airline does with the events Booking Prototipo publishes (contract v2 §8). They reach the bus from the
 * broker's `q.vuelos.entrantes` queue as `pagos.payment.confirmed`, `pagos.payment.failed` and
 * `paquetes.package.cancelled`. Every handler is idempotent: the broker delivers at least once.
 *  - payment confirmed → issue the booking's tickets (a no-op when they are already issued);
 *  - payment failed → a booking still waiting for payment becomes FAILED; a confirmed one is cancelled as a compensation;
 *  - package cancelled → the flight part of the combo is cancelled (SAGA_COMPENSATION).
 */
@Injectable()
export class InboundEventsV2Service implements OnModuleInit {
  private readonly logger = new Logger(InboundEventsV2Service.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly events: DomainEventBus,
    private readonly tickets: TicketsV2Service,
    private readonly cancellation: CancellationService,
  ) {}

  onModuleInit(): void {
    this.events.subscribe('pagos.payment.confirmed', (e) => this.paymentConfirmed(e));
    this.events.subscribe('pagos.payment.failed', (e) => this.paymentFailed(e));
    this.events.subscribe('paquetes.package.cancelled', (e) => this.packageCancelled(e));
  }

  async paymentConfirmed(event: DomainEvent): Promise<void> {
    const booking = await this.bookingOf(event);
    if (!booking) return;
    await this.tickets.issueFor(booking.ownerId, booking.bookingId);
  }

  async paymentFailed(event: DomainEvent): Promise<void> {
    const booking = await this.bookingOf(event);
    if (!booking || ['CANCELLED', 'FAILED'].includes(booking.status)) return;
    if (booking.status === 'CONFIRMED') {
      await this.cancel(event, booking, 'SAGA_COMPENSATION', 'El pago fue rechazado: compensación de la saga.');
      return;
    }
    await this.dataSource.getRepository(Booking).update({ bookingId: booking.bookingId, status: booking.status }, { status: 'FAILED' });
    this.logger.log(`Booking ${booking.bookingId} marked FAILED after a failed payment [${event.correlationId}]`);
  }

  async packageCancelled(event: DomainEvent): Promise<void> {
    const booking = await this.bookingOf(event);
    if (!booking || booking.status !== 'CONFIRMED') return;
    await this.cancel(event, booking, 'SAGA_COMPENSATION', 'El paquete del que forma parte fue cancelado.');
  }

  private async cancel(event: DomainEvent, booking: Booking, reasonCode: string, reason: string): Promise<void> {
    await this.cancellation.cancelWithEvent({ ownerId: booking.ownerId, kind: 'service', roles: [] }, keyFor(event.id), booking.bookingId, { reasonCode, reason });
  }

  private async bookingOf(event: DomainEvent): Promise<Booking | null> {
    const data = event.payload as { bookingId?: string; paymentReference?: string };
    const repo = this.dataSource.getRepository(Booking);
    const booking = data.bookingId ? await repo.findOneBy({ bookingId: data.bookingId }) : data.paymentReference ? await repo.findOneBy({ paymentReference: data.paymentReference }) : null;
    if (!booking) this.logger.warn(`${event.type} names no booking of ours (${data.bookingId ?? data.paymentReference ?? 'no id'}) [${event.correlationId}]`);
    return booking;
  }
}
