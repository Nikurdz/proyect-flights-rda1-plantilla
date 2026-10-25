import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bigintNumber } from '../../../common/bigint.transformer';
import { encryptedJson } from '../../../common/cifrado';
import { Booking } from '../../../entities/booking.entity';
import { Cliente } from '../../identidad/entities/cliente.entity';
import { DatosFacturacion } from '../../facturacion/entities/datos-facturacion.entity';
import { Mercado } from '../../mercados/entities/mercado.entity';
import type { Contacto } from '../../ofertas/entities/oferta.entity';
import { Oferta } from '../../ofertas/entities/oferta.entity';
import { OrdenHistorial } from './orden-historial.entity';

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

export interface HistorialEstado {
  estado: EstadoOrden;
  en: string;
  motivo?: string;
}

/**
 * The commercial record of a purchase: number, state machine and the links to everything else. It copies nothing:
 * the legs come from the booking (or, for a failed attempt, from the offer), the travellers from the offer, the
 * tickets and seats from the booking, the payment from `ecom_pagos`, the billing identity is shared, and the terms
 * accepted are the offer's.
 */
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

  @ManyToOne(() => Oferta, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ofertaId' })
  oferta?: Oferta;

  // Verified `sub` of the buyer (customer or guest). A guest is not a row, so there is no foreign key.
  @Column({ type: 'varchar', length: 100 })
  ownerId: string;

  @Column({ type: 'uuid', nullable: true })
  clienteId: string | null;

  @ManyToOne(() => Cliente, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'clienteId' })
  cliente?: Cliente | null;

  @Column({ type: 'varchar', length: 5 })
  mercado: string;

  @ManyToOne(() => Mercado, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'mercado' })
  mercadoRef?: Mercado;

  @Column({ type: 'char', length: 3 })
  moneda: string;

  @Column({ type: 'bigint', transformer: bigintNumber })
  totalMinor: number;

  @Column({ type: 'varchar', length: 25 })
  estado: EstadoOrden;

  @Column({ type: 'varchar', length: 10, default: 'WEB' })
  canal: string;

  // The record locator and booking in the flight core (RN-20: both identify the same purchase).
  @Column({ type: 'char', length: 6, nullable: true })
  pnr: string | null;

  @Column({ type: 'uuid', nullable: true, unique: true })
  bookingId: string | null;

  @ManyToOne(() => Booking, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'bookingId' })
  booking?: Booking | null;

  @Column({ type: 'uuid' })
  datosFacturacionId: string;

  @ManyToOne(() => DatosFacturacion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'datosFacturacionId' })
  datosFacturacion?: DatosFacturacion;

  // Contact data is personal data: encrypted at rest (RNF-18).
  @Column({ type: 'text', transformer: encryptedJson<string>() })
  contactoCorreo: string;

  @Column({ type: 'text', transformer: encryptedJson<string>() })
  contactoTelefono: string;

  // One row per state change. Load with `relations: { historial: true }` (OrdenesService.cargar does).
  @OneToMany(() => OrdenHistorial, (h) => h.orden, { cascade: true })
  historial?: OrdenHistorial[];

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  creadaEn: Date;

  @UpdateDateColumn({ type: 'timestamptz', precision: 3 })
  actualizadaEn: Date;

  get contacto(): Contacto {
    return { correo: this.contactoCorreo, telefono: this.contactoTelefono };
  }
}
