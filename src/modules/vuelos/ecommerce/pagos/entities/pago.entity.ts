import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bigintNumber } from '../../../common/bigint.transformer';
import { ReservaExterna } from '../../integracion/entities/reserva-externa.entity';
import { Mercado } from '../../mercados/entities/mercado.entity';
import { Oferta } from '../../ofertas/entities/oferta.entity';
import { Orden } from '../../ordenes/entities/orden.entity';
import { PagoAntifraudeMotivo } from './pago-antifraude-motivo.entity';

export type EstadoPago =
  | 'PENDIENTE'
  | 'AUTORIZADO'
  | 'CAPTURADO'
  | 'CAPTURA_PENDIENTE'
  | 'RECHAZADO'
  | 'RECHAZADO_ANTIFRAUDE'
  | 'ANULADO'
  // The ticket was not issued but the gateway would not release the authorisation yet: retried by the reconciler.
  | 'ANULACION_PENDIENTE'
  // The booking was cancelled and the money went back to the card (the amount is in `reembolsoMinor`).
  | 'REEMBOLSADO'
  // The refund is owed but the gateway failed: retried by the reconciler.
  | 'REEMBOLSO_PENDIENTE';

export interface ResultadoAntifraude {
  veredicto: 'APROBAR' | 'REVISAR' | 'RECHAZAR';
  puntaje: number;
  motivos: string[];
}

/** One payment attempt. A declined or fraud-rejected attempt is kept: it is the audit trail. */
@Entity('ecom_pagos')
@Index('IDX_ecom_pagos_oferta', ['ofertaId', 'creadoEn'])
@Index('IDX_ecom_pagos_creado', ['creadoEn'])
// A payment pays an offer (a flight) or a reservation of a partner product, never both and never neither.
@Check('CHK_ecom_pagos_origen', '("ofertaId" IS NOT NULL) <> ("reservaExternaId" IS NOT NULL)')
export class Pago {
  @PrimaryGeneratedColumn('uuid')
  pagoId: string;

  @Column({ type: 'uuid', nullable: true })
  ofertaId: string | null;

  @ManyToOne(() => Oferta, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'ofertaId' })
  oferta?: Oferta | null;

  @Column({ type: 'uuid', nullable: true })
  reservaExternaId: string | null;

  @ManyToOne(() => ReservaExterna, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'reservaExternaId' })
  reservaExterna?: ReservaExterna | null;

  // Filled once the order exists, so a payment can be traced to its order and back.
  @Column({ type: 'uuid', nullable: true })
  ordenId: string | null;

  @ManyToOne(() => Orden, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'ordenId' })
  orden?: Orden | null;

  @Column({ type: 'varchar', length: 100 })
  ownerId: string;

  @Column({ type: 'varchar', length: 5 })
  mercado: string;

  @ManyToOne(() => Mercado, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'mercado' })
  mercadoRef?: Mercado;

  @Column({ type: 'char', length: 3 })
  moneda: string;

  @Column({ type: 'bigint', transformer: bigintNumber })
  montoMinor: number;

  // What went back to the card when the booking was cancelled (or is owed while the state is REEMBOLSO_PENDIENTE).
  @Column({ type: 'bigint', nullable: true, transformer: bigintNumber })
  reembolsoMinor: number | null;

  // The card brand and, once the gateway answers, the last four digits (the card number never reaches us, RN-18).
  @Column({ type: 'varchar', length: 20 })
  marca: string;

  @Column({ type: 'char', length: 4, nullable: true })
  ultimos4: string | null;

  @Column({ type: 'int', default: 1 })
  cuotas: number;

  @Column({ type: 'varchar', length: 25, default: 'PENDIENTE' })
  estado: EstadoPago;

  // The gateway's reference for the authorisation; this is the paymentReference the flight core stores.
  @Column({ type: 'varchar', length: 100, nullable: true })
  autorizacionRef: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  codigoRechazo: string | null;

  // The fraud engine answer: verdict and score here, the reasons one per row in `motivosAntifraude`.
  @Column({ type: 'varchar', length: 10, nullable: true })
  antifraudeVeredicto: ResultadoAntifraude['veredicto'] | null;

  @Column({ type: 'int', nullable: true })
  antifraudePuntaje: number | null;

  @OneToMany(() => PagoAntifraudeMotivo, (m) => m.pago, { cascade: true })
  motivosAntifraude?: PagoAntifraudeMotivo[];

  // RF-PAY-008: the Idempotency-Key of the purchase that created this attempt.
  @Column({ type: 'varchar', length: 100 })
  claveIdempotencia: string;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadoEn: Date;
}
