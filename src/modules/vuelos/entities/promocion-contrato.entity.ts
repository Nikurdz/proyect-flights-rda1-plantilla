import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, Relation, UpdateDateColumn } from 'typeorm';

/**
 * The B2B promotions agreement with Booking Prototipo (contract v2 `ContratoPromociones`): whether the airline takes
 * part in combos and the highest discount it authorises. One row per partner node (`id`); the scope lists are rows
 * of `PromocionAlcance`.
 */
@Entity('vuelos_promocion_contrato')
export class PromocionContrato {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  id: string;

  @Column({ type: 'boolean' })
  permitePromociones: boolean;

  @Column({ type: 'numeric', precision: 5, scale: 2, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  porcentajeDescuentoMaximo: number;

  @Column({ type: 'date', nullable: true })
  vigenciaHasta: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  condicionesCombo: string | null;

  @OneToMany(() => PromocionAlcance, (a) => a.contrato, { cascade: true })
  alcances?: PromocionAlcance[];

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadoEn: Date;
}

export type PromocionAlcanceTipo = 'DESTINO' | 'RUTA' | 'CABINA';

/** One destination (IATA), route (`UIO-GYE`) or cabin the agreement applies to. */
@Entity('vuelos_promocion_alcance')
@Index('IDX_vuelos_promocion_alcance_contrato', ['contratoId'])
export class PromocionAlcance {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  contratoId: string;

  @ManyToOne(() => PromocionContrato, (c) => c.alcances, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contratoId' })
  contrato?: Relation<PromocionContrato>;

  @PrimaryColumn({ type: 'varchar', length: 10 })
  tipo: PromocionAlcanceTipo;

  @PrimaryColumn({ type: 'varchar', length: 20 })
  valor: string;
}
