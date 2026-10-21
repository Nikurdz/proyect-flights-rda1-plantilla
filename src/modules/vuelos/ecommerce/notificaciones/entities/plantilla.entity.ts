import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

// RF-NTF-007: templates by type, market and language, versioned. `mercado` null means "every
// market"; a market-specific template wins over the generic one. Placeholders are {{name}}.
@Entity('ecom_plantillas_notificacion')
@Unique('UQ_ecom_plantillas', ['tipo', 'mercado', 'idioma', 'version'])
export class PlantillaNotificacion {
  @PrimaryGeneratedColumn('uuid')
  plantillaId: string;

  @Column({ type: 'varchar', length: 30 })
  tipo: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  mercado: string | null;

  @Column({ type: 'varchar', length: 5 })
  idioma: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'varchar', length: 200 })
  asunto: string;

  @Column({ type: 'text' })
  cuerpo: string;

  @Column({ type: 'boolean', default: true })
  activa: boolean;
}
