import type { components } from './schema';

export type Schemas = components['schemas'];

export type MercadoViewDto = Schemas['MercadoViewDto'];
export type LocalidadViewDto = Schemas['LocalidadViewDto'];
export type DisponibilidadViewDto = Schemas['DisponibilidadViewDto'];
export type TrayectoDisponibleDto = Schemas['TrayectoDisponibleDto'];
export type ItinerarioDto = Schemas['ItinerarioDto'];
export type FechaAlternativaDto = Schemas['FechaAlternativaDto'];
export type MontoDto = Schemas['MontoDto'];
export type TarifasViewDto = Schemas['TarifasViewDto'];
export type SeleccionTrayectoDto = Schemas['SeleccionTrayectoDto'];

export interface CondicionesFamiliaDto {
  equipajeMano: { incluido: boolean; kg: number };
  equipajeBodega: { piezas: number };
  cambio: { permitido: boolean };
  devolucion: { permitida: boolean };
  seleccionAsiento: { incluida: boolean };
  upgrade?: { elegible: boolean };
  factorAcumulacion: number;
}

export type FamiliaTarifariaDto = Omit<Schemas['FamiliaTarifariaDto'], 'condiciones'> & {
  condiciones: CondicionesFamiliaDto;
};

export type OfertaViewDto = Schemas['OfertaViewDto'];
export type ArmarOfertaDto = Schemas['ArmarOfertaDto'];
export type RegistrarPasajerosDto = Schemas['RegistrarPasajerosDto'];
export type PasajeroDto = Schemas['PasajeroDto'];
export type AsientoElegidoDto = Schemas['AsientoElegidoDto'];

/** One seat of a leg's seat map (GET /ofertas/{id}/asientos). */
export interface AsientoMapaDto {
  seatNumber: string;
  isAvailable: boolean;
  characteristics: string[];
}

export interface MapaAsientosViewDto {
  trayectoId: string;
  numeroVuelo: string;
  filas: { rowNumber: number; seats: AsientoMapaDto[] }[];
}
export type ContactoDto = Schemas['ContactoDto'];
export type FacturacionDto = Schemas['FacturacionDto'];
export type AceptarCondicionesDto = Schemas['AceptarCondicionesDto'];
export type AceptarPrecioDto = Schemas['AceptarPrecioDto'];
export type RevalidacionViewDto = Schemas['RevalidacionViewDto'];
export type MedioPagoViewDto = Schemas['MedioPagoViewDto'];
export type CompraDto = Schemas['CompraDto'];
export type MedioCompraDto = Schemas['MedioCompraDto'];
export type OrdenViewDto = Schemas['OrdenViewDto'];

/** GET /tickets/verificar: whether a QR code is an authentic, issued ticket (no personal data). */
export interface VerificacionBilleteViewDto {
  valido: boolean;
  estado?: string;
  pnr?: string;
  itinerarios?: { numeroVuelo: string; origen: string; destino: string; salida: string }[];
}
export type OrdenesPaginaViewDto = Schemas['OrdenesPaginaViewDto'];
export type TokenViewDto = Schemas['TokenViewDto'];
export type LoginDto = Schemas['LoginDto'];
export type RegistroClienteDto = Schemas['RegistroClienteDto'];
export type ClienteViewDto = Schemas['ClienteViewDto'];
export type PreferenciasDto = Schemas['PreferenciasDto'];

export type Ordenamiento =
  | 'RECOMENDADO'
  | 'MAS_BARATOS'
  | 'MAS_RAPIDOS'
  | 'SALIDA_TEMPRANO'
  | 'SALIDA_TARDE'
  | 'LLEGADA_TEMPRANO'
  | 'LLEGADA_TARDE';

export interface SearchParams {
  origin?: string;
  destination?: string;
  outbound?: string;
  inbound?: string;
  adt?: number;
  chd?: number;
  inf?: number;
  trip?: 'RT' | 'OW';
  sort?: Ordenamiento;
  mercado?: string;
}

// ---------------------------------------------------------------------------------------------
// Providers, invoices, audit and experiences. `schema.d.ts` is generated from a deployed server and
// does not include these routes yet, so the types are declared by hand from the backend DTOs.
// ---------------------------------------------------------------------------------------------

export type TipoServicio = 'ATRACCIONES' | 'AUTOS' | 'ALOJAMIENTOS';
export type EstadoSalud = 'UP' | 'DEGRADADO' | 'DOWN' | 'SIN_DATOS' | 'APAGADO';
export type EstadoCircuito = 'CERRADO' | 'ABIERTO' | 'SEMIABIERTO';

/** One health check (`salud` of a provider, `POST .../ping` and each item of `GET .../salud`). */
export interface SaludView {
  estado: EstadoSalud;
  latenciaMs: number | null;
  detalle: string | null;
  comprobadoEn: string | null;
}

export interface ProveedorView {
  id: string;
  nombre: string;
  equipo: string;
  baseUrl: string;
  tipoServicio: TipoServicio;
  activo: boolean;
  salud: SaludView;
  circuito: EstadoCircuito;
  productos: number;
}

export interface RegistrarProveedorInput {
  nombre: string;
  equipo: string;
  baseUrl: string;
  tipoServicio: TipoServicio;
}

export interface ActualizarProveedorInput {
  nombre?: string;
  equipo?: string;
  baseUrl?: string;
  activo?: boolean;
}

export interface SincronizacionView {
  importados: number;
  nuevos: number;
  actualizados: number;
  desactivados: number;
}

export type EstadoFactura = 'EMITIDA' | 'ANULADA';
export type OrigenFactura = 'ORDEN' | 'EXPERIENCIA';

export interface FacturaDetalleAdmin {
  linea: number;
  tipo: string;
  concepto: string;
  cantidad: number;
  precioUnitario: MontoDto;
  iva: MontoDto;
  total: MontoDto;
}

export interface FacturaAdmin {
  numeroFactura: string;
  estado: EstadoFactura;
  emitidaEn: string;
  origen: OrigenFactura;
  referencia: string;
  subtotal: MontoDto;
  iva: MontoDto;
  total: MontoDto;
  detalles?: FacturaDetalleAdmin[];
}

export interface FacturasPaginaAdmin {
  items: FacturaAdmin[];
  totalEmitido: MontoDto;
}

export type EstadoSaga = 'EN_CURSO' | 'COMPLETADA' | 'COMPENSADA' | 'FALLIDA';

export interface AuditoriaTransaccion {
  id: string;
  eventoId: string;
  tipo: string;
  agregadoId: string;
  propietarioId: string | null;
  correlationId: string;
  resumen: string;
  ocurridoEn: string;
}

export interface SagaPaso {
  secuencia: number;
  nombre: string;
  estado: string;
  detalle: string | null;
  duracionMs: number;
}

export interface AuditoriaSaga {
  sagaId: string;
  tipo: string;
  referencia: string;
  correlationId: string;
  estado: string;
  error: string | null;
  iniciadaEn: string;
  finalizadaEn: string | null;
  pasos: SagaPaso[];
}

export interface ExperienciaView {
  id: string;
  proveedor: string;
  tipo: string;
  nombre: string;
  descripcion: string;
  duracion: string | null;
  precio: MontoDto;
  imagenUrl: string | null;
  cancelacionGratis: boolean;
  categorias: string[];
}

export interface ExperienciasPagina {
  items: ExperienciaView[];
  total: number;
}

export type EstadoReservaExterna = 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'FALLIDA_COMPENSADA';

export interface ReservaExternaView {
  id: string;
  estado: EstadoReservaExterna;
  experiencia: { id: string; nombre: string; proveedor: string };
  fecha: string;
  hora: string | null;
  cantidad: number;
  total: MontoDto;
  referenciaProveedor: string | null;
  factura: string | null;
  motivo: string | null;
  /** True when the partner lets the customer cancel for free (refund of the payment). */
  cancelacionGratis: boolean;
  creadaEn: string;
}

export interface ReservarExperienciaInput {
  fecha: string;
  hora?: string;
  cantidad: number;
  nombre: string;
  correo: string;
  facturacion: FacturacionDto;
  medio: { tipo: 'TARJETA'; token: string; marca: string };
}
