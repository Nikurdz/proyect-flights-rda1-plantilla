import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { bigintNumber } from '../../../common/bigint.transformer';
import type { PassengerType } from '../../../common/pricing.util';
import { OfertaTrayecto } from './oferta-trayecto.entity';

/** The unit price of one passenger type on one leg (RN-07: always base + taxes and charges). */
@Entity('ecom_oferta_trayecto_precios')
export class OfertaTrayectoPrecio {
  @PrimaryColumn({ type: 'uuid' })
  trayectoId: string;

  @PrimaryColumn({ type: 'varchar', length: 10 })
  tipoPasajero: PassengerType;

  @ManyToOne(() => OfertaTrayecto, (trayecto) => trayecto.precios, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  @JoinColumn({ name: 'trayectoId' })
  trayecto?: OfertaTrayecto;

  @Column({ type: 'bigint', transformer: bigintNumber })
  baseMinor: number;

  @Column({ type: 'bigint', transformer: bigintNumber })
  tasasMinor: number;
}
