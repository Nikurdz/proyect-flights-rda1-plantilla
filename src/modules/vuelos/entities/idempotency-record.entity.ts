import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// RN-18/RF-087: a retried request with the same Idempotency-Key must replay the
// original response instead of double-booking. Keyed on (idempotencyKey, route) since
// the same key is scoped to one endpoint, not global across the whole API.
@Entity('vuelos_idempotency_records')
export class IdempotencyRecord {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  idempotencyKey: string;

  @PrimaryColumn({ type: 'varchar', length: 100 })
  route: string;

  @Column({ type: 'int' })
  responseStatus: number;

  @Column({ type: 'jsonb' })
  responseBody: unknown;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
