import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, ValueTransformer } from 'typeorm';

export type EstadoPago =
  | 'PENDIENTE'
  | 'AUTORIZADO'
  | 'CAPTURADO'
  | 'CAPTURA_PENDIENTE'
  | 'RECHAZADO'
  | 'RECHAZADO_ANTIFRAUDE'
  | 'ANULADO'
  // The ticket was not issued but the gateway would not release the authorisation yet: retried by the reconciler.
  | 'ANULACION_PENDIENTE';

export interface MedioPagoUsado {
  tipo: 'TARJETA';
  marca: string;
  /** Last four digits as returned by the gateway; the card number itself never reaches us (RN-18). */
  ultimos4: string | null;
}

export interface ResultadoAntifraude {
  veredicto: 'APROBAR' | 'REVISAR' | 'RECHAZAR';
  puntaje: number;
  motivos: string[];
}

const bigintNumber: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null | undefined) => (value === null || value === undefined ? value : Number(value)),
};

/** One payment attempt. A declined or fraud-rejected attempt is kept: it is the audit trail. */
@Entity('ecom_pagos')
@Index('IDX_ecom_pagos_oferta', ['ofertaId', 'creadoEn'])
export class Pago {
  @PrimaryGeneratedColumn('uuid')
  pagoId: string;

  @Column({ type: 'uuid' })
  ofertaId: string;

  // Filled once the order exists, so a payment can be traced to its order and back.
  @Column({ type: 'uuid', nullable: true })
  ordenId: string | null;

  @Column({ type: 'varchar', length: 100 })
  ownerId: string;

  @Column({ type: 'varchar', length: 5 })
  mercado: string;

  @Column({ type: 'char', length: 3 })
  moneda: string;

  @Column({ type: 'bigint', transformer: bigintNumber })
  montoMinor: number;

  @Column({ type: 'jsonb' })
  medio: MedioPagoUsado;

  @Column({ type: 'int', default: 1 })
  cuotas: number;

  @Column({ type: 'varchar', length: 25, default: 'PENDIENTE' })
  estado: EstadoPago;

  // The gateway's reference for the authorisation; this is the paymentReference the flight core stores.
  @Column({ type: 'varchar', length: 100, nullable: true })
  autorizacionRef: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  codigoRechazo: string | null;

  @Column({ type: 'jsonb', nullable: true })
  antifraude: ResultadoAntifraude | null;

  // RF-PAY-008: the Idempotency-Key of the purchase that created this attempt.
  @Column({ type: 'varchar', length: 100 })
  claveIdempotencia: string;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadoEn: Date;
}
