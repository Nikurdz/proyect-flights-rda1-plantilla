import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Oferta } from './oferta.entity';

/** RF-CHK-012: the express acceptance of the terms in force, with its time (one per offer). */
@Entity('ecom_aceptaciones_condiciones')
export class AceptacionCondiciones {
  @PrimaryColumn({ type: 'uuid' })
  ofertaId: string;

  @OneToOne(() => Oferta, (oferta) => oferta.aceptacion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ofertaId' })
  oferta?: Oferta;

  @Column({ type: 'varchar', length: 20 })
  terminos: string;

  @Column({ type: 'varchar', length: 20 })
  condicionesTransporte: string;

  @Column({ type: 'timestamptz' })
  aceptadoEn: Date;
}
