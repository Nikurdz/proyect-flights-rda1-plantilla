import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Proveedor } from './proveedor.entity';

export type EstadoSalud = 'UP' | 'DEGRADADO' | 'DOWN';

/** One health check of a partner: state and latency. The latest row is the light shown in the console; the rest is history. */
@Entity('proveedor_salud')
@Index('IDX_proveedor_salud_proveedor', ['proveedorId', 'comprobadoEn'])
export class ProveedorSalud {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'uuid' })
  proveedorId: string;

  @ManyToOne(() => Proveedor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proveedorId' })
  proveedor?: Relation<Proveedor>;

  @Column({ type: 'varchar', length: 10 })
  estado: EstadoSalud;

  @Column({ type: 'int', nullable: true })
  latenciaMs: number | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  detalle: string | null;

  @Column({ type: 'timestamptz', precision: 3 })
  comprobadoEn: Date;
}
