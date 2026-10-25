import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { encryptedJson } from '../common/cifrado';

/** One event type a subscription wants to receive (booking.confirmed, flight.cancelled…). */
@Entity('vuelos_webhook_subscription_events')
export class WebhookSubscriptionEvent {
  @PrimaryColumn({ type: 'uuid' })
  subscriptionId: string;

  @ManyToOne(() => WebhookSubscription, (s) => s.eventos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscriptionId' })
  subscription?: Relation<WebhookSubscription>;

  @PrimaryColumn({ type: 'varchar', length: 40 })
  evento: string;
}

/**
 * A subscriber of the owner's booking events. The secret signs every delivery (HMAC-SHA256), so it has to be
 * readable by the server: it is stored encrypted, not hashed, and is never returned by any endpoint.
 */
@Entity('vuelos_webhook_subscriptions')
@Index('IDX_vuelos_webhooks_owner', ['ownerId'])
export class WebhookSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  ownerId: string;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  // One row per event type; load with `relations: { eventos: true }`.
  @OneToMany(() => WebhookSubscriptionEvent, (e) => e.subscription, { cascade: true })
  eventos?: WebhookSubscriptionEvent[];

  @Column({ type: 'text', transformer: encryptedJson<string>() })
  secret: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  get events(): string[] {
    return (this.eventos ?? []).map((e) => e.evento).sort();
  }
}
