import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, PrimaryGeneratedColumn, Relation, Unique } from 'typeorm';
import { bigintNumber } from '../../../common/bigint.transformer';
import { Proveedor } from './proveedor.entity';

/** A category of a partner product (an entry has several). */
@Entity('catalogo_externo_categorias')
export class CatalogoExternoCategoria {
  @PrimaryColumn({ type: 'uuid' })
  catalogoId: string;

  @ManyToOne(() => CatalogoExterno, (c) => c.categorias, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'catalogoId' })
  catalogo?: Relation<CatalogoExterno>;

  @PrimaryColumn({ type: 'varchar', length: 60 })
  categoria: string;
}

/**
 * A partner product (an attraction, a tour…) imported by "sincronizar" and shown to customers. It is a local cache: the
 * price and the availability belong to the partner and are checked again when a reservation is made.
 */
@Entity('catalogo_externo')
@Unique('UQ_catalogo_externo_proveedor_id', ['proveedorId', 'externalId'])
@Index('IDX_catalogo_externo_tipo', ['tipo', 'activo'])
export class CatalogoExterno {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  proveedorId: string;

  @ManyToOne(() => Proveedor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proveedorId' })
  proveedor?: Relation<Proveedor>;

  // The id the partner gives the product.
  @Column({ type: 'varchar', length: 100 })
  externalId: string;

  // SINGLE_TICKET, GUIDED_TOUR, PACKAGE…
  @Column({ type: 'varchar', length: 30 })
  tipo: string;

  @Column({ type: 'varchar', length: 200 })
  nombre: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  duracion: string | null;

  @Column({ type: 'bigint', transformer: bigintNumber })
  precioMinor: number;

  @Column({ type: 'char', length: 3 })
  moneda: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imagenUrl: string | null;

  @Column({ type: 'boolean', default: false })
  cancelacionGratis: boolean;

  // False once a sync no longer lists the product: kept for the reservations that point at it.
  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ type: 'timestamptz' })
  sincronizadoEn: Date;

  @OneToMany(() => CatalogoExternoCategoria, (c) => c.catalogo, { cascade: true })
  categorias?: CatalogoExternoCategoria[];
}
