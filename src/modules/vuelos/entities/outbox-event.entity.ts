import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * The feed behind GET /api/v2/vuelos/eventos: every contract event, in order, as the CloudEvent that was (or will be)
 * delivered by webhook. It is the safety net for a subscriber that missed a delivery. `seq` gives the cursor
 * (`evt-vue-000120`); `eventoId` is the domain event id, so announcing an event twice stores it once. `data` is an opaque
 * document (jsonb is kept for those only).
 */
@Entity('vuelos_outbox')
@Index('UQ_vuelos_outbox_evento', ['eventoId'], { unique: true })
@Index('IDX_vuelos_outbox_tipo', ['type', 'seq'])
export class OutboxEvent {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  seq: string;

  @Column({ type: 'uuid' })
  eventoId: string;

  /** Short type (`booking.confirmed`). */
  @Column({ type: 'varchar', length: 40 })
  type: string;

  @Column({ type: 'varchar', length: 100 })
  subject: string;

  @Column({ type: 'varchar', length: 100 })
  correlationId: string;

  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  @Column({ type: 'jsonb' })
  cloudEvent: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
