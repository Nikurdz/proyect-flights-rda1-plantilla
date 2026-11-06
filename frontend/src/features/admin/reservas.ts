import type { AdminReserva, AdminReservasFilters, CanalReserva, ReservaPasajero, TipoDocumento } from '../../api/endpoints/admin';

export const CANAL_LABEL: Record<CanalReserva, string> = { SOCIO: 'Socio (Booking)', DIRECTO: 'Directo (web)' };
export const DOCUMENT_TYPE_LABEL: Record<string, string> = { NATIONAL_ID: 'Cédula', PASSPORT: 'Pasaporte' };

export const canalLabel = (canal: string): string => CANAL_LABEL[canal as CanalReserva] ?? canal;
export const documentTypeLabel = (type: string): string => DOCUMENT_TYPE_LABEL[type] ?? type;

/** Defensive: the API already masks the document, but a full number must never reach the screen. */
export function maskDocument(value: string): string {
  if (!value) return '—';
  if (value.includes('*')) return value;
  return value.length <= 3 ? '***' : `${'*'.repeat(value.length - 3)}${value.slice(-3)}`;
}

/** Form values of the search box -> filters sent to the API (empty values are dropped, the document brings its type). */
export interface ReservasSearchForm {
  pnr: string;
  partnerOrderId: string;
  paymentReference: string;
  canal: CanalReserva | '';
  documento: string;
  tipoDocumento: TipoDocumento;
  nacionalidad: string;
}

export const EMPTY_SEARCH: ReservasSearchForm = {
  pnr: '',
  partnerOrderId: '',
  paymentReference: '',
  canal: '',
  documento: '',
  tipoDocumento: 'NATIONAL_ID',
  nacionalidad: 'EC',
};

export function toReservasFilters(form: ReservasSearchForm): AdminReservasFilters {
  const filters: AdminReservasFilters = {};
  const pnr = form.pnr.trim().toUpperCase();
  if (pnr) filters.pnr = pnr;
  if (form.partnerOrderId.trim()) filters.partnerOrderId = form.partnerOrderId.trim();
  if (form.paymentReference.trim()) filters.paymentReference = form.paymentReference.trim();
  if (form.canal) filters.canal = form.canal;
  if (form.documento.trim()) {
    filters.documento = form.documento.trim();
    filters.tipoDocumento = form.tipoDocumento;
    filters.nacionalidad = (form.nacionalidad.trim() || 'EC').toUpperCase();
  }
  return filters;
}

export interface SharedTraveller {
  travellerId: string;
  nombre: string;
  documento: string;
  tipoDocumento: string;
  bookingIds: string[];
  pnrs: string[];
}

/** Travellers that appear in more than one booking of the list: the same person, one `travellerId`. */
export function sharedTravellers(items: AdminReserva[]): SharedTraveller[] {
  const byId = new Map<string, SharedTraveller>();
  for (const booking of items) {
    for (const p of booking.pasajeros) {
      const entry = byId.get(p.travellerId) ?? { travellerId: p.travellerId, nombre: p.nombre, documento: p.documento, tipoDocumento: p.tipoDocumento, bookingIds: [], pnrs: [] };
      if (!entry.bookingIds.includes(booking.bookingId)) {
        entry.bookingIds.push(booking.bookingId);
        entry.pnrs.push(booking.pnr);
      }
      byId.set(p.travellerId, entry);
    }
  }
  return [...byId.values()].filter((t) => t.bookingIds.length > 1);
}

/** For a booking, the ids of its travellers that also travel in other bookings of the list. */
export function sharedIdsOf(booking: AdminReserva, shared: SharedTraveller[]): Set<string> {
  const ids = new Set(shared.map((s) => s.travellerId));
  return new Set(booking.pasajeros.filter((p) => ids.has(p.travellerId)).map((p) => p.travellerId));
}

export function seatsText(p: ReservaPasajero, flightCodes: Map<string, string>): string {
  if (p.asientos.length === 0) return 'Sin asiento';
  return p.asientos.map((s) => `${flightCodes.get(s.vueloId) ?? 'Vuelo'} · ${s.asiento}`).join('  ');
}

export type CheckInState = 'COMPLETO' | 'PARCIAL' | 'PENDIENTE';

export function checkInState(booking: Pick<AdminReserva, 'pasajeros'>): CheckInState {
  const done = booking.pasajeros.filter((p) => p.checkIn).length;
  if (booking.pasajeros.length > 0 && done === booking.pasajeros.length) return 'COMPLETO';
  return done > 0 ? 'PARCIAL' : 'PENDIENTE';
}

export const CHECK_IN_LABEL: Record<CheckInState, string> = { COMPLETO: 'Check-in hecho', PARCIAL: 'Check-in parcial', PENDIENTE: 'Sin check-in' };

export const isCancelled = (booking: Pick<AdminReserva, 'status'>): boolean => booking.status === 'CANCELLED';

export function flightCodesOf(booking: Pick<AdminReserva, 'vuelos'>): Map<string, string> {
  return new Map(booking.vuelos.map((v) => [v.vueloId, v.codigoVuelo]));
}
