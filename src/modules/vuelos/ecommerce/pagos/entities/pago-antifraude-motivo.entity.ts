import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Pago } from './pago.entity';

/** One reason the fraud engine gave for its verdict on a payment (blocked token, high amount, velocity…). */
@Entity('ecom_pago_antifraude_motivos')
@Unique('UQ_pago_antifraude_motivo', ['pagoId', 'motivo'])
export class PagoAntifraudeMotivo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  pagoId: string;

  @ManyToOne(() => Pago, (pago) => pago.motivosAntifraude, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pagoId' })
  pago?: Pago;

  @Column({ type: 'varchar', length: 60 })
  motivo: string;
}
