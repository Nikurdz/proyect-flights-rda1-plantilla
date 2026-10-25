import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { bigintNumber } from '../../../common/bigint.transformer';
import { Orden } from '../../ordenes/entities/orden.entity';
import { DatosFacturacion } from './datos-facturacion.entity';
import { FacturaDetalle } from './factura-detalle.entity';

export type EstadoFactura = 'EMITIDA' | 'ANULADA';

/** Invoice header: one per issued order. The amounts split the order total into subtotal and IVA (the tax rate). */
@Entity('ecom_facturas')
@Index('UQ_ecom_facturas_numero', ['numeroFactura'], { unique: true })
@Index('IDX_ecom_facturas_emitida', ['emitidaEn'])
export class Factura {
  @PrimaryGeneratedColumn('uuid')
  facturaId: string;

  @Column({ type: 'varchar', length: 20 })
  numeroFactura: string;

  @Column({ type: 'uuid', unique: true })
  ordenId: string;

  @OneToOne(() => Orden, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ordenId' })
  orden?: Orden;

  @Column({ type: 'uuid' })
  datosFacturacionId: string;

  @ManyToOne(() => DatosFacturacion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'datosFacturacionId' })
  datosFacturacion?: DatosFacturacion;

  @Column({ type: 'char', length: 3 })
  moneda: string;

  @Column({ type: 'bigint', transformer: bigintNumber })
  subtotalMinor: number;

  @Column({ type: 'bigint', transformer: bigintNumber })
  ivaMinor: number;

  @Column({ type: 'bigint', transformer: bigintNumber })
  totalMinor: number;

  @Column({ type: 'varchar', length: 10, default: 'EMITIDA' })
  estado: EstadoFactura;

  @OneToMany(() => FacturaDetalle, (detalle) => detalle.factura, { cascade: true })
  detalles?: FacturaDetalle[];

  @CreateDateColumn({ type: 'timestamptz' })
  emitidaEn: Date;
}
