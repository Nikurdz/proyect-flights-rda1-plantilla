import { Check, Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ColumnNumericTransformer } from '../../../common/transformers/column-numeric.transformer';

@Entity('vuelos')
@Unique('UQ_vuelos_codigo_salida', ['codigoVuelo', 'fechaSalida'])
@Index('IDX_vuelos_ruta_salida', ['origenIATA', 'destinoIATA', 'fechaSalida'])
@Check('CHK_vuelos_iata_formato', `"origenIATA" ~ '^[A-Z]{3}$' AND "destinoIATA" ~ '^[A-Z]{3}$'`)
@Check('CHK_vuelos_origen_distinto', `"origenIATA" <> "destinoIATA"`)
@Check('CHK_vuelos_asientos', `"asientosDisponibles" >= 0 AND "asientosDisponibles" <= "capacidadTotal"`)
export class Vuelo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  aerolinea: string;

  @Column({ type: 'varchar', length: 2 })
  codigoAerolinea: string;

  @Column({ type: 'varchar', length: 20 })
  codigoVuelo: string;

  @Column({ type: 'char', length: 3 })
  origenIATA: string;

  @Column({ type: 'char', length: 3 })
  destinoIATA: string;

  // Instants are stored in UTC (RNF-28), hence timestamptz rather than a zone-less timestamp.
  @Column({ type: 'timestamptz' })
  fechaSalida: Date;

  @Column({ type: 'timestamptz' })
  fechaLlegada: Date;

  @Column('numeric', {
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  precioBase: number;

  // Remaining inventory. Decremented when a hold is created and restored when it is
  // released or expires — see InventoryService; nothing else may write this column.
  @Column({ type: 'int' })
  asientosDisponibles: number;

  @Column({ type: 'int', default: 180 })
  capacidadTotal: number;

  @Column({ type: 'int' })
  durationMinutes: number;
}
