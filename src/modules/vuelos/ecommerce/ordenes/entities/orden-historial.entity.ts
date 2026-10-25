import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { EstadoOrden } from './orden.entity';
import { Orden } from './orden.entity';

/** One state the order went through (RF-ORD-005), in order. The audit trail of the order state machine. */
@Entity('ecom_orden_historial')
@Unique('UQ_orden_historial_secuencia', ['ordenId', 'secuencia'])
@Index('IDX_orden_historial_orden', ['ordenId'])
export class OrdenHistorial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ordenId: string;

  @ManyToOne(() => Orden, (orden) => orden.historial, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ordenId' })
  orden?: Orden;

  @Column({ type: 'int' })
  secuencia: number;

  @Column({ type: 'varchar', length: 25 })
  estado: EstadoOrden;

  @Column({ type: 'timestamptz', precision: 3 })
  en: Date;

  @Column({ type: 'varchar', length: 300, nullable: true })
  motivo: string | null;
}
