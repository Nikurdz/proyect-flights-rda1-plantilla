import { buildSearchPath } from './search';
import { formatTimeInTimeZone } from './dates';
import { passengerTypeLabel } from './labels';
import type { OfertaViewDto } from '../api/types';

export type CheckoutStep = 'pasajeros' | 'facturacion' | 'condiciones' | 'pago';

/** The four steps of the purchase: short name for the stepper, full title for the page heading. */
export const CHECKOUT_STEPS: { id: CheckoutStep; label: string; title: string }[] = [
  { id: 'pasajeros', label: 'Pasajeros', title: 'Pasajeros y contacto' },
  { id: 'facturacion', label: 'Facturación', title: 'Datos de facturación' },
  { id: 'condiciones', label: 'Condiciones', title: 'Condiciones del viaje' },
  { id: 'pago', label: 'Pago', title: 'Pago' },
];

/** The calendar day (YYYY-MM-DD) of an instant in Ecuador, the way the search form writes dates. */
export function ecuadorDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

/**
 * The results URL that repeats the search this offer came from, rebuilt from the offer itself, so
 * going back never loses the origin, the dates or the passengers.
 */
export function resultsPathFromOffer(oferta?: OfertaViewDto | null): string {
  const legs = oferta?.trayectos ?? [];
  if (legs.length === 0) return '/';
  const counts = (oferta?.pasajeros ?? {}) as Record<string, number | undefined>;
  return buildSearchPath({
    origin: legs[0].origen,
    destination: legs[0].destino,
    outbound: ecuadorDay(legs[0].salida),
    inbound: legs.length > 1 ? ecuadorDay(legs[legs.length - 1].salida) : undefined,
    trip: legs.length > 1 ? 'RT' : 'OW',
    passengers: { adt: counts.adultos || 1, yth: counts.jovenes || 0, chd: counts.ninos || 0, inf: counts.infantes || 0 },
  });
}

/** "Pasajero 2 · Niño": what the traveller sees instead of the ids the API uses. */
export function passengerTitle(ordinal: number, tipo: string): string {
  return `Pasajero ${ordinal} · ${passengerTypeLabel(tipo)}`;
}

/** "14:35": the time (Ecuador) until which the seats are held. Empty when the offer carries no deadline. */
export function holdUntil(oferta?: Pick<OfertaViewDto, 'venceEn'> | null): string {
  return oferta?.venceEn ? formatTimeInTimeZone(oferta.venceEn) : '';
}

/** A hold exists while the offer is neither expired, cancelled nor paid. */
export function hasActiveHold(oferta?: Pick<OfertaViewDto, 'estado'> | null): boolean {
  return Boolean(oferta) && !['VENCIDA', 'CANCELADA', 'PAGADA'].includes(oferta!.estado);
}

/** The test cards (approved and failing) are only offered when the build says so (`VITE_SHOW_TEST_CARDS=true`). */
export const showTestCards = (): boolean => import.meta.env.VITE_SHOW_TEST_CARDS === 'true';

/** "Ecuador" from "EC", in Spanish; the code itself when the browser cannot name it. */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** The traveller whose data can be reused as the buyer: kept in memory by the checkout, never stored. */
export interface Titular {
  nombres: string;
  apellidos: string;
  documento?: { tipo: 'PASSPORT' | 'NATIONAL_ID'; numero: string };
}
