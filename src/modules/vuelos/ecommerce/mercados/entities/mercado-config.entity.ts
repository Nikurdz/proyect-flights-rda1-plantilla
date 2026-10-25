import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, PrimaryGeneratedColumn, Relation, Unique } from 'typeorm';
import { ColumnNumericTransformer } from '../../../../../common/transformers/column-numeric.transformer';
import { FareFamily } from '../../../entities/fare-family.entity';
import { Mercado } from './mercado.entity';

/**
 * The configuration of a market, one table per kind of value (it used to live in arrays and jsonb documents of the
 * market row). `orden` keeps the order the values were configured in. Every row hangs from its market by a real
 * foreign key and goes with it.
 */

/** A language the portal is offered in. */
@Entity('ecom_mercado_idiomas')
export class MercadoIdioma {
  @PrimaryColumn({ type: 'varchar', length: 5 })
  mercadoCodigo: string;

  @ManyToOne(() => Mercado, (m) => m.idiomasRef, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mercadoCodigo' })
  mercado?: Relation<Mercado>;

  @PrimaryColumn({ type: 'varchar', length: 5 })
  idioma: string;

  @Column({ type: 'int' })
  orden: number;
}

/** A tab of the search box (VUELOS, ESIM…), RF-MKT-005. */
@Entity('ecom_mercado_productos')
export class MercadoProducto {
  @PrimaryColumn({ type: 'varchar', length: 5 })
  mercadoCodigo: string;

  @ManyToOne(() => Mercado, (m) => m.productosRef, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mercadoCodigo' })
  mercado?: Relation<Mercado>;

  @PrimaryColumn({ type: 'varchar', length: 30 })
  producto: string;

  @Column({ type: 'int' })
  orden: number;
}

/** A tax-id type accepted for billing data, with the pattern its number must fully match (RF-CHK-011). */
@Entity('ecom_mercado_identificaciones')
export class MercadoIdentificacionFiscal {
  @PrimaryColumn({ type: 'varchar', length: 5 })
  mercadoCodigo: string;

  @ManyToOne(() => Mercado, (m) => m.identificacionesRef, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mercadoCodigo' })
  mercado?: Relation<Mercado>;

  @PrimaryColumn({ type: 'varchar', length: 20 })
  tipo: string;

  @Column({ type: 'varchar', length: 60 })
  etiqueta: string;

  @Column({ type: 'varchar', length: 100 })
  patron: string;

  @Column({ type: 'int' })
  orden: number;
}

export type TipoDocumentoLegal = 'TERMINOS' | 'PRIVACIDAD' | 'CONDICIONES_TRANSPORTE';

/** A legal document of the market (terms, privacy, conditions of carriage) with its current version and address. */
@Entity('ecom_mercado_documentos_legales')
export class MercadoDocumentoLegal {
  @PrimaryColumn({ type: 'varchar', length: 5 })
  mercadoCodigo: string;

  @ManyToOne(() => Mercado, (m) => m.documentosRef, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mercadoCodigo' })
  mercado?: Relation<Mercado>;

  @PrimaryColumn({ type: 'varchar', length: 25 })
  tipo: TipoDocumentoLegal;

  @Column({ type: 'varchar', length: 20 })
  version: string;

  @Column({ type: 'varchar', length: 300 })
  url: string;
}

/** A card brand accepted by a payment method. */
@Entity('ecom_mercado_medio_marcas')
export class MercadoMedioMarca {
  @PrimaryColumn({ type: 'uuid' })
  medioId: string;

  @ManyToOne(() => MercadoMedioPago, (m) => m.marcas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'medioId' })
  medio?: Relation<MercadoMedioPago>;

  @PrimaryColumn({ type: 'varchar', length: 20 })
  marca: string;

  @Column({ type: 'int' })
  orden: number;
}

/** An instalment plan a payment method offers. */
@Entity('ecom_mercado_medio_cuotas')
export class MercadoMedioCuota {
  @PrimaryColumn({ type: 'uuid' })
  medioId: string;

  @ManyToOne(() => MercadoMedioPago, (m) => m.cuotas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'medioId' })
  medio?: Relation<MercadoMedioPago>;

  @PrimaryColumn({ type: 'int' })
  cuotas: number;
}

/** What a payment method may be used for: PASAJE (tickets) or ADICIONAL (ancillaries). */
@Entity('ecom_mercado_medio_productos')
export class MercadoMedioProducto {
  @PrimaryColumn({ type: 'uuid' })
  medioId: string;

  @ManyToOne(() => MercadoMedioPago, (m) => m.productos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'medioId' })
  medio?: Relation<MercadoMedioPago>;

  @PrimaryColumn({ type: 'varchar', length: 10 })
  producto: 'PASAJE' | 'ADICIONAL';
}

/** A payment method of the market (RF-PAY-002/010). */
@Entity('ecom_mercado_medios_pago')
@Unique('UQ_mercado_medio_tipo', ['mercadoCodigo', 'tipo'])
export class MercadoMedioPago {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 5 })
  mercadoCodigo: string;

  @ManyToOne(() => Mercado, (m) => m.mediosPagoRef, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mercadoCodigo' })
  mercado?: Relation<Mercado>;

  @Column({ type: 'varchar', length: 20 })
  tipo: 'TARJETA';

  @Column({ type: 'int' })
  orden: number;

  @OneToMany(() => MercadoMedioMarca, (m) => m.medio, { cascade: true })
  marcas?: MercadoMedioMarca[];

  @OneToMany(() => MercadoMedioCuota, (c) => c.medio, { cascade: true })
  cuotas?: MercadoMedioCuota[];

  @OneToMany(() => MercadoMedioProducto, (p) => p.medio, { cascade: true })
  productos?: MercadoMedioProducto[];
}

/** A fare family a regulatory rule applies to. */
@Entity('ecom_mercado_regla_familias')
export class MercadoReglaFamilia {
  @PrimaryColumn({ type: 'uuid' })
  reglaId: string;

  @ManyToOne(() => MercadoRegla, (r) => r.familias, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reglaId' })
  regla?: Relation<MercadoRegla>;

  @PrimaryColumn({ type: 'varchar', length: 20 })
  familia: string;

  @ManyToOne(() => FareFamily, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'familia', referencedColumnName: 'code' })
  familiaTarifaria?: Relation<FareFamily>;
}

export type TipoReglaRegulatoria = 'RETRACTO' | 'DESISTIMIENTO' | 'TRASPASO';

/**
 * A regulatory window of the market (RF-MKT-007, RN-02): configuration, never code. One row per kind of rule; the
 * columns a kind does not use stay empty (RETRACTO: diasHabiles; DESISTIMIENTO: retencionPorcentaje, horasAntesDelVuelo
 * and its families; TRASPASO: horasAntesDelVuelo, maximoPorPasaje, maximoPorAnio).
 */
@Entity('ecom_mercado_reglas')
@Unique('UQ_mercado_regla', ['mercadoCodigo', 'regla'])
@Index('IDX_mercado_regla_mercado', ['mercadoCodigo'])
export class MercadoRegla {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 5 })
  mercadoCodigo: string;

  @ManyToOne(() => Mercado, (m) => m.reglasRef, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mercadoCodigo' })
  mercado?: Relation<Mercado>;

  @Column({ type: 'varchar', length: 15 })
  regla: TipoReglaRegulatoria;

  @Column({ type: 'int', nullable: true })
  diasHabiles: number | null;

  @Column('numeric', { precision: 5, scale: 2, nullable: true, transformer: new ColumnNumericTransformer() })
  retencionPorcentaje: number | null;

  @Column({ type: 'int', nullable: true })
  horasAntesDelVuelo: number | null;

  @Column({ type: 'int', nullable: true })
  maximoPorPasaje: number | null;

  @Column({ type: 'int', nullable: true })
  maximoPorAnio: number | null;

  @OneToMany(() => MercadoReglaFamilia, (f) => f.regla, { cascade: true })
  familias?: MercadoReglaFamilia[];
}
