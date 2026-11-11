import { Column, Entity, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { ColumnNumericTransformer } from '../../../../../common/transformers/column-numeric.transformer';
import {
  MercadoDocumentoLegal,
  MercadoIdentificacionFiscal,
  MercadoIdioma,
  MercadoMedioPago,
  MercadoProducto,
  MercadoRegla,
} from './mercado-config.entity';

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

/** Everything configurable about a market besides its own row, in the shape the API and the services use. */
export interface ConfiguracionMercado {
  idiomas: string[];
  productosBuscador: string[];
  mediosPago: MedioPagoConfig[];
  reglasRegulatorias: ReglasRegulatorias;
  textosLegales: TextosLegales;
  identificacionesFiscales: IdentificacionFiscalConfig[];
}

const porOrden = <T extends { orden: number }>(rows: T[] | undefined): T[] => [...(rows ?? [])].sort((a, b) => a.orden - b.orden);

/**
 * A sales market. Its configuration lives in child tables (`mercado-config.entity.ts`); load them with
 * `cargarMercado` (mercado-loader.ts) and read them through the getters below, which rebuild the shapes the rest of
 * the code and the API use.
 */
@Entity('ecom_mercados')
export class Mercado {
  // Lowercase market code used in portal routes (/ec/es, /co/es).
  @PrimaryColumn({ type: 'varchar', length: 5 })
  codigo: string;

  @Column({ type: 'char', length: 2 })
  pais: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 5 })
  idiomaPorDefecto: string;

  // RN-01: quote and charge currency of everything sold in this market.
  @Column({ type: 'char', length: 3 })
  moneda: string;

  // Units of `moneda` per 1 USD: the inventory is priced in USD (see common/moneda.util.ts).
  @Column('numeric', { precision: 14, scale: 6, transformer: new ColumnNumericTransformer() })
  tipoCambioDesdeUsd: number;

  // The legal entity that sells in this market (shown in the footer and the e-mails).
  @Column({ type: 'varchar', length: 200 })
  razonSocial: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  // Optimistic-concurrency token: an admin edit must name the version it was based on.
  @Column({ type: 'int', default: 1 })
  version: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadoEn: Date;

  @OneToMany(() => MercadoIdioma, (i) => i.mercado)
  idiomasRef?: MercadoIdioma[];

  @OneToMany(() => MercadoProducto, (p) => p.mercado)
  productosRef?: MercadoProducto[];

  @OneToMany(() => MercadoMedioPago, (m) => m.mercado)
  mediosPagoRef?: MercadoMedioPago[];

  @OneToMany(() => MercadoRegla, (r) => r.mercado)
  reglasRef?: MercadoRegla[];

  @OneToMany(() => MercadoDocumentoLegal, (d) => d.mercado)
  documentosRef?: MercadoDocumentoLegal[];

  @OneToMany(() => MercadoIdentificacionFiscal, (i) => i.mercado)
  identificacionesRef?: MercadoIdentificacionFiscal[];

  // ---- read model (needs the child rows loaded: use cargarMercado) ----

  private cargado<T>(rows: T[] | undefined, nombre: string): T[] {
    if (!rows) throw new Error(`Market ${this.codigo}: ${nombre} not loaded (use cargarMercado)`);
    return rows;
  }

  get idiomas(): string[] {
    return porOrden(this.cargado(this.idiomasRef, 'languages')).map((i) => i.idioma);
  }

  get productosBuscador(): string[] {
    return porOrden(this.cargado(this.productosRef, 'products')).map((p) => p.producto);
  }

  get mediosPago(): MedioPagoConfig[] {
    return porOrden(this.cargado(this.mediosPagoRef, 'payment methods')).map((m) => ({
      tipo: m.tipo,
      marcas: porOrden(m.marcas).map((x) => x.marca),
      cuotasPermitidas: [...(m.cuotas ?? [])].map((c) => c.cuotas).sort((a, b) => a - b),
      productos: (m.productos ?? []).map((p) => p.producto).sort(),
    }));
  }

  get reglasRegulatorias(): ReglasRegulatorias {
    const result: ReglasRegulatorias = {};
    for (const r of this.cargado(this.reglasRef, 'rules')) {
      if (r.regla === 'RETRACTO') result.retracto = { diasHabiles: r.diasHabiles };
      if (r.regla === 'DESISTIMIENTO') {
        result.desistimiento = { retencionPorcentaje: r.retencionPorcentaje, horasAntesDelVuelo: r.horasAntesDelVuelo, familias: (r.familias ?? []).map((f) => f.familia).sort() };
      }
      if (r.regla === 'TRASPASO') {
        result.traspaso = { horasAntesDelVuelo: r.horasAntesDelVuelo, maximoPorPasaje: r.maximoPorPasaje, maximoPorAnio: r.maximoPorAnio };
      }
    }
    return result;
  }

  get textosLegales(): TextosLegales {
    const documento = (tipo: string): DocumentoLegal => {
      const d = this.cargado(this.documentosRef, 'legal documents').find((x) => x.tipo === tipo);
      return d ? { version: d.version, url: d.url } : { version: '', url: '' };
    };
    return {
      razonSocial: this.razonSocial,
      terminos: documento('TERMINOS'),
      privacidad: documento('PRIVACIDAD'),
      condicionesTransporte: documento('CONDICIONES_TRANSPORTE'),
    };
  }

  get identificacionesFiscales(): IdentificacionFiscalConfig[] {
    return porOrden(this.cargado(this.identificacionesRef, 'tax ids')).map((i) => ({ tipo: i.tipo, etiqueta: i.etiqueta, patron: i.patron }));
  }
}
