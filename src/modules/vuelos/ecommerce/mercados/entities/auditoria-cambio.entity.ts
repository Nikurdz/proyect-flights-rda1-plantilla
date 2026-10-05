import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// RF-ADM-006 / RNF-31: an append-only record of configuration changes (who, when, before,
// after). The service exposes no update or delete for it.
@Entity('ecom_auditoria_cambios')
@Index('IDX_ecom_auditoria_entidad', ['entidad', 'entidadId', 'creadoEn'])
export class AuditoriaCambio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  entidad: string;

  @Column({ type: 'varchar', length: 100 })
  entidadId: string;

  @Column({ type: 'varchar', length: 100 })
  actorId: string;

  @Column({ type: 'varchar', length: 30 })
  accion: string;

  @Column({ type: 'jsonb' })
  antes: unknown;

  @Column({ type: 'jsonb' })
  despues: unknown;

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  creadoEn: Date;
}
