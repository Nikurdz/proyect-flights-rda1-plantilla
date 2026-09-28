import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Stretch scope: simple CRUD backing only, per the plan's agreed scope for this pass.
// Nothing publishes to these subscriptions yet — there is no async event pipeline.
@Entity('vuelos_webhook_subscriptions')
export class WebhookSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'text', array: true })
  events: string[];

  @Column({ type: 'varchar', length: 200 })
  secret: string;
}
