import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, ValueTransformer } from 'typeorm';
import { encryptedJson } from '../../../common/cifrado';
import type { CondicionesAceptadas, Contacto, Facturacion, PasajeroDatos, TrayectoOferta } from '../../ofertas/entities/oferta.entity';

// SRS §8.5. PAGO_EN_VERIFICACION belongs to asynchronous payment methods (R4); it is part of the
// model so the transition table is complete, but nothing enters it in this phase.
export type EstadoOrden =
  | 'PENDIENTE_PAGO'
  | 'PAGO_EN_VERIFICACION'
  | 'PAGADA'
  | 'EMITIDA'
  | 'FALLIDA_COMPENSADA'
  | 'MODIFICADA'
  | 'DEVOLUCION_EN_CURSO'
  | 'REEMBOLSADA'
  | 'EN_VIAJE'
  | 'COMPLETADA'
  | 'EXPIRADA';

/** RF-ORD-005: only these transitions are legal. */
export const TRANSICIONES: Record<EstadoOrden, EstadoOrden[]> = {
  PENDIENTE_PAGO: ['PAGO_EN_VERIFICACION', 'PAGADA', 'EXPIRADA'],
  PAGO_EN_VERIFICACION: ['PAGADA', 'EXPIRADA'],
  PAGADA: ['EMITIDA', 'FALLIDA_COMPENSADA'],
  EMITIDA: ['MODIFICADA', 'DEVOLUCION_EN_CURSO', 'EN_VIAJE'],
  MODIFICADA: ['EMITIDA'],
  DEVOLUCION_EN_CURSO: ['REEMBOLSADA'],
  EN_VIAJE: ['COMPLETADA'],
  REEMBOLSADA: [],
  COMPLETADA: [],
  EXPIRADA: [],
  FALLIDA_COMPENSADA: [],
};

export interface PasajeroOrden extends PasajeroDatos {
  /** The e-ticket issued for this passenger (one per passenger, RF-ORD-003). */
  eTicket: string | null;
  ticketId: string | null;
}

export interface HistorialEstado {
  estado: EstadoOrden;
  en: string;
  motivo?: string;
}

export interface ResumenPago {
  pagoId: string;
  marca: string;
  ultimos4: string | null;
  cuotas: number;
}

const bigintNumber: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null | undefined) => (value === null || value === undefined ? value : Number(value)),
};

@Entity('ecom_ordenes')
@Index('UQ_ecom_ordenes_numero', ['numeroOrden'], { unique: true })
@Index('IDX_ecom_ordenes_pnr', ['pnr'])
@Index('IDX_ecom_ordenes_booking', ['bookingId'])
@Index('IDX_ecom_ordenes_owner_created', ['ownerId', 'creadaEn', 'ordenId'])
@Index('IDX_ecom_ordenes_creada', ['creadaEn', 'ordenId'])
// One live order per offer; a failed (compensated) attempt does not block a retry on the same offer.
@Index('UQ_ecom_ordenes_oferta_activa', ['ofertaId'], { unique: true, where: `"estado" <> 'FALLIDA_COMPENSADA'` })
export class Orden {
  @PrimaryGeneratedColumn('uuid')
  ordenId: string;

  // RF-ORD-001: the platform's own order number, distinct from the PNR.
  @Column({ type: 'varchar', length: 20 })
  numeroOrden: string;

  @Column({ type: 'uuid' })
  ofertaId: string;

  @Column({ type: 'varchar', length: 100 })
  ownerId: string;

  @Column({ type: 'uuid', nullable: true })
  clienteId: string | null;

  @Column({ type: 'varchar', length: 5 })
  mercado: string;

  @Column({ type: 'char', length: 3 })
  moneda: string;

  @Column({ type: 'bigint', transformer: bigintNumber })
  totalMinor: number;

  @Column({ type: 'varchar', length: 25 })
  estado: EstadoOrden;

  @Column({ type: 'varchar', length: 10, default: 'WEB' })
  canal: string;

  @Column({ type: 'jsonb' })
  pago: ResumenPago;

  // The record locator and booking in the flight core (RN-20: both identify the same purchase).
  @Column({ type: 'char', length: 6, nullable: true })
  pnr: string | null;

  @Column({ type: 'uuid', nullable: true })
  bookingId: string | null;

  @Column({ type: 'jsonb' })
  trayectos: TrayectoOferta[];

  @Column({ type: 'text', transformer: encryptedJson<PasajeroOrden[]>() })
  pasajeros: PasajeroOrden[];

  @Column({ type: 'text', transformer: encryptedJson<Contacto>() })
  contacto: Contacto;

  @Column({ type: 'text', transformer: encryptedJson<Facturacion>() })
  facturacion: Facturacion;

  @Column({ type: 'jsonb' })
  condicionesAceptadas: CondicionesAceptadas;

  @Column({ type: 'jsonb' })
  historial: HistorialEstado[];

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  creadaEn: Date;

  @UpdateDateColumn({ type: 'timestamptz', precision: 3 })
  actualizadaEn: Date;
}
