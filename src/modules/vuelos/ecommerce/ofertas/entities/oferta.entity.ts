import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, ValueTransformer } from 'typeorm';
import { encryptedJson } from '../../../common/cifrado';
import type { PassengerType } from '../../../common/pricing.util';

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

/** One quoted leg of the offer: what was chosen, as it was priced when the offer was built. */
export interface TrayectoOferta {
  /** Vuelo.id — the stable itinerary id the portal selected. */
  itinerarioId: string;
  /** The itineraryId the flight core issued for the same flight inside its own offer/hold. */
  gdsItinerarioId: string;
  familia: string;
  numeroVuelo: string;
  operadorCodigo: string;
  operadorNombre: string;
  origen: string;
  destino: string;
  salida: string;
  llegada: string;
  duracionMinutos: number;
  unitarios: Partial<Record<PassengerType, PrecioUnitarioSnapshot>>;
  totalMinor: number;
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

// bigint columns come back as strings from the driver; amounts here are well inside Number's safe range.
const bigintNumber: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null | undefined) => (value === null || value === undefined ? value : Number(value)),
};

@Entity('ecom_ofertas')
@Index('IDX_ecom_ofertas_owner', ['ownerId', 'creadaEn'])
@Index('IDX_ecom_ofertas_hold', ['holdId'])
export class Oferta {
  @PrimaryGeneratedColumn('uuid')
  ofertaId: string;

  @Column({ type: 'varchar', length: 5 })
  mercado: string;

  // RN-01: fixed when the offer is built and used for the quote and the charge alike.
  @Column({ type: 'char', length: 3 })
  moneda: string;

  // Verified `sub` of the visitor (customer or guest) that built the offer.
  @Column({ type: 'varchar', length: 100 })
  ownerId: string;

  @Column({ type: 'varchar', length: 20, default: 'ABIERTA' })
  estado: EstadoOferta;

  @Column({ type: 'jsonb' })
  trayectos: TrayectoOferta[];

  @Column({ type: 'jsonb' })
  composicion: Composicion;

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

  @Column({ type: 'timestamptz' })
  venceEn: Date;

  // Personal data is encrypted at rest (RNF-18); see common/cifrado.ts.
  @Column({ type: 'text', nullable: true, transformer: encryptedJson<DatosPasajeros>() })
  datosPasajeros: DatosPasajeros | null;

  @Column({ type: 'text', nullable: true, transformer: encryptedJson<Facturacion>() })
  facturacion: Facturacion | null;

  @Column({ type: 'jsonb', nullable: true })
  condicionesAceptadas: CondicionesAceptadas | null;

  @Column({ type: 'timestamptz', nullable: true })
  revalidadaEn: Date | null;

  // Set while a purchase is running; a stale value lets a retry take the purchase over.
  @Column({ type: 'timestamptz', nullable: true })
  enPagoDesde: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creadaEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadaEn: Date;
}
