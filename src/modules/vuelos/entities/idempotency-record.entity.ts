import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

export type IdempotencyState = 'IN_PROGRESS' | 'COMPLETED';

// RN-18/RF-087: a retried request with the same Idempotency-Key replays the original
// response instead of re-executing. Scoped to (key, route, owner): the same key is only
// meaningful within one endpoint, and one caller must never be able to replay another's
// stored response. The row is claimed before the work starts and completed in the same
// transaction as the work, so a crash can never leave a half-recorded success behind.
@Entity('vuelos_idempotency_records')
@Index('IDX_vuelos_idempotency_created', ['createdAt'])
export class IdempotencyRecord {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  idempotencyKey: string;

  @PrimaryColumn({ type: 'varchar', length: 100 })
  route: string;

  @PrimaryColumn({ type: 'varchar', length: 100 })
  ownerId: string;

  // SHA-256 of the canonical request body: the same key with a different payload is a
  // client bug and is rejected instead of silently replaying the first response.
  @Column({ type: 'char', length: 64 })
  requestHash: string;

  @Column({ type: 'varchar', length: 12, default: 'IN_PROGRESS' })
  state: IdempotencyState;

  @Column({ type: 'int', nullable: true })
  responseStatus: number | null;

  @Column({ type: 'jsonb', nullable: true })
  responseBody: unknown;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
