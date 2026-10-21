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
