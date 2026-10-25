import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bigintNumber } from '../../../common/bigint.transformer';
import { encryptedJson } from '../../../common/cifrado';
import { toIso } from '../../../common/date.util';
import type { PassengerType } from '../../../common/pricing.util';
import { FlightHold } from '../../../entities/flight-hold.entity';
import { DatosFacturacion } from '../../facturacion/entities/datos-facturacion.entity';
import { Mercado } from '../../mercados/entities/mercado.entity';
import { AceptacionCondiciones } from './aceptacion-condiciones.entity';
import { OfertaPasajero } from './oferta-pasajero.entity';
import { OfertaTrayecto } from './oferta-trayecto.entity';

export type EstadoOferta = 'ABIERTA' | 'EN_REVISION_PRECIO' | 'EN_PAGO' | 'PAGADA' | 'VENCIDA' | 'CANCELADA';

export interface Composicion {
  adultos: number;
  jovenes: number;
  ninos: number;
  infantes: number;
}

export interface PrecioUnitarioSnapshot {
  baseMinor: number;
  tasasMinor: number;
  totalMinor: number;
}

/** A leg as it was quoted: the shape the pricing code produces (it becomes an `OfertaTrayecto` row plus its prices). */
export interface TrayectoCotizado {
  /** Vuelo.id: the stable itinerary id the portal selected. */
  itinerarioId: string;
  /** The itineraryId the flight core issued for the same flight inside its own offer/hold. */
  gdsItinerarioId: string;
  familia: string;
  unitarios: Partial<Record<PassengerType, PrecioUnitarioSnapshot>>;
  totalMinor: number;
}

/** A seat the passenger picked on one leg; `trayectoId` is the leg's Vuelo.id. */
export interface AsientoElegido {
  trayectoId: string;
  asiento: string;
}

export interface PasajeroDatos {
  id: string;
  tipo: PassengerType;
  asociadoA?: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  genero: 'M' | 'F' | 'X';
  nacionalidad: string;
  documento: { tipo: 'PASSPORT' | 'NATIONAL_ID'; numero: string; vencimiento?: string };
  numeroSocio?: string;
  necesidades?: string[];
  asientos?: AsientoElegido[];
}

export interface Contacto {
  correo: string;
  telefono: string;
}

export interface DatosPasajeros {
  pasajeros: PasajeroDatos[];
  contacto: Contacto;
}

export interface Facturacion {
  tipoIdentificacion: string;
  numeroIdentificacion: string;
  razonSocial: string;
  direccion: string;
  pais: string;
}

export interface CondicionesAceptadas {
  terminos: string;
  condicionesTransporte: string;
  aceptadoEn: string;
}

@Entity('ecom_ofertas')
@Index('IDX_ecom_ofertas_owner', ['ownerId', 'creadaEn'])
@Index('IDX_ecom_ofertas_hold', ['holdId'])
@Index('IDX_ecom_ofertas_creada', ['creadaEn'])
export class Oferta {
  @PrimaryGeneratedColumn('uuid')
  ofertaId: string;

  @Column({ type: 'varchar', length: 5 })
  mercado: string;

  @ManyToOne(() => Mercado, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'mercado' })
  mercadoRef?: Mercado;

  // RN-01: fixed when the offer is built and used for the quote and the charge alike.
  @Column({ type: 'char', length: 3 })
  moneda: string;

  // Verified `sub` of the visitor (customer or guest) that built the offer. A guest is not a row: no foreign key.
  @Column({ type: 'varchar', length: 100 })
  ownerId: string;

  @Column({ type: 'varchar', length: 20, default: 'ABIERTA' })
  estado: EstadoOferta;

  // The party that was priced and held.
  @Column({ type: 'int' })
  adultos: number;

  @Column({ type: 'int', default: 0 })
  jovenes: number;

  @Column({ type: 'int', default: 0 })
  ninos: number;

  @Column({ type: 'int', default: 0 })
  infantes: number;

  @Column({ type: 'bigint', transformer: bigintNumber })
  totalMinor: number;

  // A re-quote that differs from totalMinor waits here until the customer accepts it (RN-12).
  @Column({ type: 'bigint', nullable: true, transformer: bigintNumber })
  totalPropuestoMinor: number | null;

  @Column({ type: 'uuid' })
  gdsOfferId: string;

  // The inventory hold backing this offer in the flight core; releasing the offer releases it.
  @Column({ type: 'uuid' })
  holdId: string;

  @ManyToOne(() => FlightHold, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'holdId' })
  hold?: FlightHold;

  @Column({ type: 'timestamptz' })
  venceEn: Date;

  // Contact data is personal data: encrypted at rest (RNF-18).
  @Column({ type: 'text', nullable: true, transformer: encryptedJson<string>() })
  contactoCorreo: string | null;

  @Column({ type: 'text', nullable: true, transformer: encryptedJson<string>() })
  contactoTelefono: string | null;

  // Billing identity, stored once (see DatosFacturacion); the order points at the same row.
  @Column({ type: 'uuid', nullable: true })
  datosFacturacionId: string | null;

  @ManyToOne(() => DatosFacturacion, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'datosFacturacionId' })
  datosFacturacion?: DatosFacturacion | null;

  @OneToOne(() => AceptacionCondiciones, (a) => a.oferta, { cascade: true })
  aceptacion?: AceptacionCondiciones | null;

  @OneToMany(() => OfertaTrayecto, (trayecto) => trayecto.oferta, { cascade: true })
  trayectos: OfertaTrayecto[];

  @OneToMany(() => OfertaPasajero, (pasajero) => pasajero.oferta, { cascade: true })
  pasajeros?: OfertaPasajero[];

  @Column({ type: 'timestamptz', nullable: true })
  revalidadaEn: Date | null;

  // Set while a purchase is running; a stale value lets a retry take the purchase over.
  @Column({ type: 'timestamptz', nullable: true })
  enPagoDesde: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creadaEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadaEn: Date;

  // ---- read model: the shapes the services already work with, built from the rows (use cargarOferta) ----

  get composicion(): Composicion {
    return { adultos: this.adultos, jovenes: this.jovenes, ninos: this.ninos, infantes: this.infantes };
  }

  /** The passengers and the contact the buyer entered, or null while there are none. */
  get datosPasajeros(): DatosPasajeros | null {
    if (!this.pasajeros || this.pasajeros.length === 0 || this.contactoCorreo === null || this.contactoTelefono === null) return null;
    const ordenados = [...this.pasajeros].sort((a, b) => a.orden - b.orden);
    return {
      pasajeros: ordenados.map((p) => ({
        id: p.idCliente,
        tipo: p.tipo,
        ...(p.asociadoA ? { asociadoA: p.asociadoA } : {}),
        nombres: p.nombres,
        apellidos: p.apellidos,
        fechaNacimiento: p.fechaNacimiento,
        genero: p.genero,
        nacionalidad: p.nacionalidad,
        documento: { tipo: p.documentoTipo, numero: p.documentoNumero, ...(p.documentoVencimiento ? { vencimiento: p.documentoVencimiento } : {}) },
        ...(p.numeroSocio ? { numeroSocio: p.numeroSocio } : {}),
        ...(p.necesidades?.length ? { necesidades: p.necesidades.map((n) => n.necesidad) } : {}),
        ...(p.asientos?.length ? { asientos: p.asientos.map((a) => ({ trayectoId: a.vueloId, asiento: a.asiento })) } : {}),
      })),
      contacto: { correo: this.contactoCorreo, telefono: this.contactoTelefono },
    };
  }

  get facturacion(): Facturacion | null {
    const d = this.datosFacturacion;
    return d
      ? { tipoIdentificacion: d.tipoIdentificacion, numeroIdentificacion: d.numeroIdentificacion, razonSocial: d.razonSocial, direccion: d.direccion, pais: d.pais }
      : null;
  }

  get condicionesAceptadas(): CondicionesAceptadas | null {
    const a = this.aceptacion;
    return a ? { terminos: a.terminos, condicionesTransporte: a.condicionesTransporte, aceptadoEn: toIso(a.aceptadoEn) } : null;
  }
}
