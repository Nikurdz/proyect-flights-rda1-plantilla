import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Cliente } from '../../identidad/entities/cliente.entity';

// RF-ADM-006 / RNF-31: an append-only record of configuration changes (who, when, before,
// after). The service exposes no update or delete for it.
@Entity('auditoria_administrativa')
@Index('IDX_ecom_auditoria_entidad', ['entidad', 'entidadId', 'creadoEn'])
export class AuditoriaCambio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  entidad: string;

  @Column({ type: 'varchar', length: 100 })
  entidadId: string;

  // The administrator that made the change (an account, so a real foreign key).
  @Column({ type: 'uuid' })
  actorId: string;

  @ManyToOne(() => Cliente, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actorId' })
  actor?: Relation<Cliente>;

  @Column({ type: 'varchar', length: 30 })
  accion: string;

  @Column({ type: 'jsonb' })
  antes: unknown;

  @Column({ type: 'jsonb' })
  despues: unknown;

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  creadoEn: Date;
}
