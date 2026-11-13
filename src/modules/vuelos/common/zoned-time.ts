import { DEFAULT_AIRPORT_ZONE } from './airport-zones';
import { toZonedIso } from './date.util';

/** Zone of every instant that is not a departure or an arrival (America/Guayaquil, UTC-5). */
export const SYSTEM_ZONE = 'America/Guayaquil';

/**
 * How the partner API v2 writes its instants: the departure of a flight in the zone of its ORIGIN airport, the arrival in
 * the zone of its DESTINATION airport and everything else in `SYSTEM_ZONE`. The airport is found in the same object:
 *  - `airportKeys`: the key that carries the IATA code of the airport;
 *  - `instantKeys`: the keys, in that same object, whose instants belong to that airport.
 * `departure`/`arrival` of the flight segment and of the flight status are objects `{ iataCode, at | scheduledAt | estimatedAt | actualAt }`;
 * tickets carry `departureIataCode/arrivalIataCode` next to `departureAt/arrivalAt`; operations carry `origin` next to `departureAt`;
 * the flight events carry `destination` next to `estimatedArrivalAt`.
 */
export const AIRPORT_TIME_RULES: readonly { airportKeys: readonly string[]; instantKeys: readonly string[] }[] = [
  { airportKeys: ['iataCode'], instantKeys: ['at', 'scheduledAt', 'estimatedAt', 'actualAt'] },
  { airportKeys: ['departureIataCode', 'origin'], instantKeys: ['departureAt', 'estimatedDepartureAt'] },
  { airportKeys: ['arrivalIataCode', 'destination'], instantKeys: ['arrivalAt', 'estimatedArrivalAt'] },
];

/** A complete UTC instant as `toISOString()` writes it (the only strings that are converted). */
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;
const IATA = /^[A-Z]{3}$/;

type Json = unknown;

function airportOf(object: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = object[key];
    if (typeof value === 'string' && IATA.test(value)) return value;
  }
  return undefined;
}

/** The IATA codes a body mentions next to a departure/arrival instant: the zones to load before converting. */
export function airportCodesIn(body: Json): Set<string> {
  const codes = new Set<string>();
  const visit = (value: Json): void => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object' || value instanceof Date) return;
    const object = value as Record<string, unknown>;
    for (const rule of AIRPORT_TIME_RULES) {
      const code = airportOf(object, rule.airportKeys);
      if (code) codes.add(code);
    }
    Object.values(object).forEach(visit);
  };
  visit(body);
  return codes;
}

/**
 * A copy of a response body with every full UTC instant rewritten with its real offset (same instant). Dates (`YYYY-MM-DD`),
 * times (`HH:mm`), ids and text are left as they are. `zoneOf` returns the zone of an airport (already loaded).
 */
export function toZonedBodySync<T>(body: T, zoneOf: (iata: string) => string = () => DEFAULT_AIRPORT_ZONE): T {
  const convert = (value: Json, zone: string): Json => {
    if (typeof value === 'string') return UTC_INSTANT.test(value) ? toZonedIso(value, zone) : value;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? value : toZonedIso(value, zone);
    if (Array.isArray(value)) return value.map((item) => convert(item, SYSTEM_ZONE));
    if (!value || typeof value !== 'object') return value;
    const object = value as Record<string, unknown>;
    const airportZone = new Map<string, string>();
    for (const rule of AIRPORT_TIME_RULES) {
      const code = airportOf(object, rule.airportKeys);
      if (code) for (const key of rule.instantKeys) airportZone.set(key, zoneOf(code));
    }
    return Object.fromEntries(Object.entries(object).map(([key, item]) => [key, convert(item, airportZone.get(key) ?? SYSTEM_ZONE)]));
  };
  return convert(body, SYSTEM_ZONE) as T;
}

/** Same as `toZonedBodySync`, loading the zone of each airport the body mentions first (`AirportZones.zoneOf`). */
export async function toZonedBody<T>(body: T, zones: { zoneOf(iata: string | undefined): Promise<string> }): Promise<T> {
  const loaded = new Map<string, string>();
  await Promise.all([...airportCodesIn(body)].map(async (code) => loaded.set(code, await zones.zoneOf(code))));
  return toZonedBodySync(body, (code) => loaded.get(code) ?? DEFAULT_AIRPORT_ZONE);
}
