import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation, Unique } from 'typeorm';
import { ColumnNumericTransformer } from '../../../common/transformers/column-numeric.transformer';
import { Localidad } from '../ecommerce/catalogo/entities/localidad.entity';
import { Aerolinea } from './aerolinea.entity';

/** Operational status of a flight (contract v2 FlightOperationalStatus). SCHEDULED means "no override": the status then follows the clock. */
export type VueloEstado = 'SCHEDULED' | 'BOARDING' | 'DEPARTED' | 'DELAYED' | 'ARRIVED' | 'CANCELLED' | 'DIVERTED';

@Entity('vuelos')
@Unique('UQ_vuelos_codigo_salida', ['codigoVuelo', 'fechaSalida'])
@Index('IDX_vuelos_ruta_salida', ['origenIATA', 'destinoIATA', 'fechaSalida'])
@Check('CHK_vuelos_iata_formato', `"origenIATA" ~ '^[A-Z]{3}$' AND "destinoIATA" ~ '^[A-Z]{3}$'`)
@Check('CHK_vuelos_origen_distinto', `"origenIATA" <> "destinoIATA"`)
@Check('CHK_vuelos_asientos', `"asientosDisponibles" >= 0 AND "asientosDisponibles" <= "capacidadTotal"`)
export class Vuelo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 2 })
  codigoAerolinea: string;

  // The airline's name lives in its own table. Eager, so a flight read with `find` carries it; a query builder joins it
  // explicitly (`leftJoinAndSelect('v.aerolineaRef', 'a')`) and a row lock reads it afterwards (locks and joins do not mix).
  @ManyToOne(() => Aerolinea, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'codigoAerolinea' })
  aerolineaRef?: Relation<Aerolinea>;

  @Column({ type: 'varchar', length: 20 })
  codigoVuelo: string;

  @Column({ type: 'char', length: 3 })
  origenIATA: string;

  @ManyToOne(() => Localidad, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'origenIATA' })
  origen?: Relation<Localidad>;

  @Column({ type: 'char', length: 3 })
  destinoIATA: string;

  @ManyToOne(() => Localidad, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destinoIATA' })
  destino?: Relation<Localidad>;

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

  // CANCELLED flights are closed to search, holds and bookings; an admin cancels or reschedules a flight.
  @Column({ type: 'varchar', length: 12, default: 'SCHEDULED' })
  estado: VueloEstado;

  // Operational detail set by PATCH /api/v2/vuelos/flights/{n}/status.
  @Column({ type: 'int', nullable: true })
  retrasoMinutos?: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  salidaEstimada?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  llegadaEstimada?: Date | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  puertaSalida?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  estadoActualizadoEn?: Date | null;

  /** The airline's name (read from its row; needs `aerolineaRef` loaded). */
  get aerolinea(): string {
    if (!this.aerolineaRef) throw new Error(`Flight ${this.id}: airline not loaded`);
    return this.aerolineaRef.nombre;
  }
}
