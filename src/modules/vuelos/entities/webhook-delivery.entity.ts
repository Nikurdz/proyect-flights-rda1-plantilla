import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export type WebhookDeliveryStatus = 'PENDING' | 'DELIVERED' | 'DEAD';

/**
 * One event owed to one subscription. The (subscription, event) pair is unique so that an event announced
 * twice is queued once; the dispatcher claims due rows with FOR UPDATE SKIP LOCKED, so several instances
 * never deliver the same row at the same time.
 */
@Entity('vuelos_webhook_deliveries')
@Unique('UQ_vuelos_webhook_delivery_event', ['subscriptionId', 'eventId'])
@Index('IDX_vuelos_webhook_delivery_due', ['status', 'nextAttemptAt'])
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  deliveryId: string;

  @Column({ type: 'uuid' })
  subscriptionId: string;

  @Column({ type: 'uuid' })
  eventId: string;

  @Column({ type: 'varchar', length: 40 })
  eventType: string;

  /** The WebhookPayload that is sent, kept so every retry sends exactly the same body. */
  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', length: 12, default: 'PENDING' })
  status: WebhookDeliveryStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz' })
  nextAttemptAt: Date;

  @Column({ type: 'int', nullable: true })
  lastStatusCode: number | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;
}
