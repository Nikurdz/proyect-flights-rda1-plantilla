import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { encryptedJson } from '../common/cifrado';

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

  @Column({ type: 'jsonb' })
  events: string[];

  @Column({ type: 'text', transformer: encryptedJson<string>() })
  secret: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
