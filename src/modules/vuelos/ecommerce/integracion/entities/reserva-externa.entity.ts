import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation, UpdateDateColumn } from 'typeorm';
import { bigintNumber } from '../../../common/bigint.transformer';
import { encryptedJson } from '../../../common/cifrado';
import { DatosFacturacion } from '../../facturacion/entities/datos-facturacion.entity';
import { Cliente } from '../../identidad/entities/cliente.entity';
import { CatalogoExterno } from './catalogo-externo.entity';
import { Proveedor } from './proveedor.entity';

export type EstadoReservaExterna = 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'FALLIDA_COMPENSADA';

/** A partner product bought through the platform: paid here, confirmed in the partner system, invoiced here. */
@Entity('reservas_externas')
@Index('IDX_reservas_externas_owner', ['ownerId', 'creadaEn'])
@Index('IDX_reservas_externas_proveedor', ['proveedorId', 'estado'])
export class ReservaExterna {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Verified `sub` of the buyer (customer or guest; a guest is not a row, so no foreign key).
  @Column({ type: 'varchar', length: 100 })
  ownerId: string;

  @Column({ type: 'uuid', nullable: true })
  clienteId: string | null;

  @ManyToOne(() => Cliente, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'clienteId' })
  cliente?: Relation<Cliente> | null;

  @Column({ type: 'uuid' })
  proveedorId: string;

  @ManyToOne(() => Proveedor, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'proveedorId' })
  proveedor?: Relation<Proveedor>;

  @Column({ type: 'uuid' })
  catalogoId: string;

  @ManyToOne(() => CatalogoExterno, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'catalogoId' })
  catalogo?: Relation<CatalogoExterno>;

  // The partner's reservation id once it confirmed.
  @Column({ type: 'uuid', nullable: true })
  externalReservationId: string | null;

  @Column({ type: 'varchar', length: 20, default: 'PENDIENTE' })
  estado: EstadoReservaExterna;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  hora: string | null;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ type: 'text', transformer: encryptedJson<string>() })
  nombreCliente: string;

  @Column({ type: 'text', transformer: encryptedJson<string>() })
  correoCliente: string;

  @Column({ type: 'bigint', transformer: bigintNumber })
  totalMinor: number;

  @Column({ type: 'char', length: 3 })
  moneda: string;

  @Column({ type: 'uuid' })
  datosFacturacionId: string;

  @ManyToOne(() => DatosFacturacion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'datosFacturacionId' })
  datosFacturacion?: Relation<DatosFacturacion>;

  // Why a reservation failed or was cancelled.
  @Column({ type: 'varchar', length: 300, nullable: true })
  motivo: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creadaEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadaEn: Date;
}
