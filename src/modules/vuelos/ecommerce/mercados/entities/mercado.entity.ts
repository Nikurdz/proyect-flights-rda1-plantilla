import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { ColumnNumericTransformer } from '../../../../../common/transformers/column-numeric.transformer';

export interface MedioPagoConfig {
  tipo: 'TARJETA';
  /** RF-PAY-002: brands accepted in this market (Diners only where the SRS allows it, Hipercard/Elo only in Brazil). */
  marcas: string[];
  /** Instalment plans offered on tickets (RF-PAY-010); ancillaries are never financed (RN-16). */
  cuotasPermitidas: number[];
  productos: ('PASAJE' | 'ADICIONAL')[];
}

// RF-MKT-007: regulatory windows are configuration, never code (RN-02). Stored from R1 so the
// post-sale release (R2) reads them instead of hard-coding country rules.
export interface ReglasRegulatorias {
  retracto?: { diasHabiles: number };
  desistimiento?: { retencionPorcentaje: number; horasAntesDelVuelo: number; familias: string[] };
  traspaso?: { horasAntesDelVuelo: number; maximoPorPasaje: number; maximoPorAnio: number };
}

// RF-CHK-011: tax identification accepted for billing data, per market (regulatory => configuration).
export interface IdentificacionFiscalConfig {
  tipo: string;
  etiqueta: string;
  /** Regular expression the number must fully match. */
  patron: string;
}

export interface DocumentoLegal {
  version: string;
  url: string;
}

export interface TextosLegales {
  razonSocial: string;
  terminos: DocumentoLegal;
  privacidad: DocumentoLegal;
  condicionesTransporte: DocumentoLegal;
}

@Entity('ecom_mercados')
export class Mercado {
  // Lowercase market code used in portal routes (/ec/es, /co/es).
  @PrimaryColumn({ type: 'varchar', length: 5 })
  codigo: string;

  @Column({ type: 'char', length: 2 })
  pais: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'text', array: true })
  idiomas: string[];

  @Column({ type: 'varchar', length: 5 })
  idiomaPorDefecto: string;

  // RN-01: quote and charge currency of everything sold in this market.
  @Column({ type: 'char', length: 3 })
  moneda: string;

  // Units of `moneda` per 1 USD: the inventory is priced in USD (see common/moneda.util.ts).
  @Column('numeric', { precision: 14, scale: 6, transformer: new ColumnNumericTransformer() })
  tipoCambioDesdeUsd: number;

  // RF-MKT-005: which tabs the search box shows in this market.
  @Column({ type: 'text', array: true })
  productosBuscador: string[];

  @Column({ type: 'jsonb' })
  mediosPago: MedioPagoConfig[];

  @Column({ type: 'jsonb' })
  reglasRegulatorias: ReglasRegulatorias;

  @Column({ type: 'jsonb' })
  textosLegales: TextosLegales;

  @Column({ type: 'jsonb' })
  identificacionesFiscales: IdentificacionFiscalConfig[];

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  // Optimistic-concurrency token: an admin edit must name the version it was based on.
  @Column({ type: 'int', default: 1 })
  version: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadoEn: Date;
}
