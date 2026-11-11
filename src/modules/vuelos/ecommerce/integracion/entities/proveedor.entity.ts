import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type TipoServicio = 'ATRACCIONES' | 'AUTOS' | 'ALOJAMIENTOS';
export const TIPOS_SERVICIO: TipoServicio[] = ['ATRACCIONES', 'AUTOS', 'ALOJAMIENTOS'];

/**
 * A partner team's service the platform integrates with (Gestión de Proveedores). `activo` is the kill-switch: while it
 * is false nothing is called, the cached catalogue is hidden from customers and no new reservation is accepted.
 */
@Entity('proveedores')
@Index('UQ_proveedores_nombre', ['nombre'], { unique: true })
export class Proveedor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  // The team that owns the service (e.g. "Equipo Atracciones").
  @Column({ type: 'varchar', length: 100 })
  equipo: string;

  // Base address of the partner API, without a trailing slash (e.g. https://host/api/v2).
  @Column({ type: 'varchar', length: 300 })
  baseUrl: string;

  @Column({ type: 'varchar', length: 20 })
  tipoServicio: TipoServicio;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadoEn: Date;
}
