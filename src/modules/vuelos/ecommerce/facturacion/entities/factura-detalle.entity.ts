import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { bigintNumber } from '../../../common/bigint.transformer';
import { Factura } from './factura.entity';

export type TipoLineaFactura = 'TARIFA' | 'EQUIPAJE' | 'EXPERIENCIA';

/** One invoice line: a leg and a passenger type (or a baggage purchase) with its quantity, unit price and IVA. */
@Entity('ecom_factura_detalles')
@Unique('UQ_factura_detalle_linea', ['facturaId', 'linea'])
export class FacturaDetalle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  facturaId: string;

  @ManyToOne(() => Factura, (factura) => factura.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'facturaId' })
  factura?: Factura;

  @Column({ type: 'int' })
  linea: number;

  @Column({ type: 'varchar', length: 20, default: 'TARIFA' })
  tipo: TipoLineaFactura;

  @Column({ type: 'varchar', length: 200 })
  concepto: string;

  @Column({ type: 'int' })
  cantidad: number;

  // Unit price before IVA.
  @Column({ type: 'bigint', transformer: bigintNumber })
  precioUnitarioMinor: number;

  // IVA of the whole line.
  @Column({ type: 'bigint', transformer: bigintNumber })
  ivaMinor: number;

  // cantidad x precioUnitarioMinor + ivaMinor.
  @Column({ type: 'bigint', transformer: bigintNumber })
  totalMinor: number;
}
