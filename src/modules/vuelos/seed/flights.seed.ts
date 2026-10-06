import { DataSource } from 'typeorm';
import { FareFamily } from '../entities/fare-family.entity';
import { Vuelo } from '../entities/vuelo.entity';

export const FARE_FAMILIES = [
  {
    code: 'BASIC',
    name: 'Basic',
    carryOnKg: 0,
    checkedBags: 0,
    changeable: false,
    refundable: false,
    seatSelectionIncluded: false,
    upgradeEligible: false,
    accrualFactor: 0.5, // RN-29: reduced accrual on the most restrictive economy family
    priceMultiplier: 1.0,
  },
  {
    code: 'LIGHT',
    name: 'Light',
    carryOnKg: 10,
    checkedBags: 0,
    changeable: false,
    refundable: false,
    seatSelectionIncluded: false,
    upgradeEligible: true,
    accrualFactor: 1.0,
    priceMultiplier: 1.15,
  },
  {
    code: 'FULL',
    name: 'Full',
    carryOnKg: 10,
    checkedBags: 1,
    changeable: true,
    refundable: true,
    seatSelectionIncluded: true,
    upgradeEligible: true,
    accrualFactor: 1.0,
    priceMultiplier: 1.35,
  },
];

interface ScheduleEntry {
  aerolinea: string;
  codigoAerolinea: string;
  codigoVuelo: string;
  origenIATA: string;
  destinoIATA: string;
  /** Departure hour, UTC. */
  hour: number;
  durationMinutes: number;
  precioBase: number;
  /** Seats open when the flight is first created (not reset on later runs). */
  initialAvailable: number;
  /** Seats of the aircraft (default 180). */
  capacity?: number;
  /** Vary the fare by weekday and the open seats by day (deterministically). */
  varied?: boolean;
}

// The core entries: the SRS's own evidence route (BOG-SCL and back) plus a few domestic/regional
// legs. Existing integration tests rely on them (LA1500 has only 5 seats; UIO<->GYE and BOG<->SCL
// are served by these entries alone), so they stay as they are.
export const SCHEDULE: ScheduleEntry[] = [
  { aerolinea: 'LATAM Airlines', codigoAerolinea: 'LA', codigoVuelo: 'LA800', origenIATA: 'BOG', destinoIATA: 'SCL', hour: 8, durationMinutes: 300, precioBase: 320, initialAvailable: 42 },
  { aerolinea: 'LATAM Airlines', codigoAerolinea: 'LA', codigoVuelo: 'LA1500', origenIATA: 'BOG', destinoIATA: 'SCL', hour: 16, durationMinutes: 300, precioBase: 298, initialAvailable: 5 },
  { aerolinea: 'LATAM Airlines', codigoAerolinea: 'LA', codigoVuelo: 'LA801', origenIATA: 'SCL', destinoIATA: 'BOG', hour: 9, durationMinutes: 300, precioBase: 335, initialAvailable: 38 },
  { aerolinea: 'LATAM Airlines', codigoAerolinea: 'LA', codigoVuelo: 'LA2402', origenIATA: 'UIO', destinoIATA: 'GYE', hour: 12, durationMinutes: 50, precioBase: 70, initialAvailable: 90 },
  { aerolinea: 'LATAM Airlines', codigoAerolinea: 'LA', codigoVuelo: 'LA2403', origenIATA: 'GYE', destinoIATA: 'UIO', hour: 18, durationMinutes: 50, precioBase: 72, initialAvailable: 90 },
  { aerolinea: 'LATAM Airlines', codigoAerolinea: 'LA', codigoVuelo: 'LA1411', origenIATA: 'UIO', destinoIATA: 'BOG', hour: 11, durationMinutes: 105, precioBase: 180, initialAvailable: 70 },
  { aerolinea: 'LATAM Airlines', codigoAerolinea: 'LA', codigoVuelo: 'LA1412', origenIATA: 'BOG', destinoIATA: 'UIO', hour: 15, durationMinutes: 105, precioBase: 185, initialAvailable: 70 },
  { aerolinea: 'Avianca', codigoAerolinea: 'AV', codigoVuelo: 'AV123', origenIATA: 'BOG', destinoIATA: 'MDE', hour: 10, durationMinutes: 55, precioBase: 95, initialAvailable: 60 },
  { aerolinea: 'Avianca', codigoAerolinea: 'AV', codigoVuelo: 'AV456', origenIATA: 'BOG', destinoIATA: 'LIM', hour: 14, durationMinutes: 150, precioBase: 210, initialAvailable: 50 },
];

// --- Wider network: direct routes with a return leg, several carriers and daily frequencies. ---
// Departure hours are LOCAL times converted to UTC with a fixed offset per airport (approximate:
// no daylight-saving changes). A deliberate, documented simplification, not a real timetable.
const UTC_OFFSET: Record<string, number> = {
  BOG: -5, MDE: -5, CLO: -5, CTG: -5, UIO: -5, GYE: -5, CUE: -5, GPS: -6, LIM: -5, CUZ: -5,
  PTY: -5, SCL: -3, EZE: -3, GRU: -3, MIA: -4, MAD: 1,
};

const CARRIERS: Record<string, string> = {
  LA: 'LATAM Airlines',
  AV: 'Avianca',
  CM: 'Copa Airlines',
  G3: 'Gol Linhas Aéreas',
  AR: 'Aerolíneas Argentinas',
  UX: 'Air Europa',
};

interface RoutePair {
  a: string;
  b: string;
  carrier: string;
  /** First flight number; A->B takes number + 2i, B->A number + 2i + 1. */
  number: number;
  durationMinutes: number;
  priceUsd: number;
  capacity: number;
  /** Local departure hours at A and at B (one flight per hour listed). */
  hoursA: number[];
  hoursB: number[];
}

// Bands (USD, base fare): domestic 60-100, regional 130-300, North America 280-390, Europe 780-830.
const ROUTES: RoutePair[] = [
  { a: 'BOG', b: 'MDE', carrier: 'AV', number: 130, durationMinutes: 55, priceUsd: 88, capacity: 180, hoursA: [7, 19], hoursB: [9, 21] },
  { a: 'BOG', b: 'CLO', carrier: 'AV', number: 140, durationMinutes: 70, priceUsd: 84, capacity: 180, hoursA: [6, 12, 18], hoursB: [8, 14, 20] },
  { a: 'BOG', b: 'CTG', carrier: 'AV', number: 150, durationMinutes: 75, priceUsd: 96, capacity: 180, hoursA: [7, 15], hoursB: [9, 17] },
  { a: 'UIO', b: 'CUE', carrier: 'LA', number: 2420, durationMinutes: 45, priceUsd: 62, capacity: 96, hoursA: [7, 16], hoursB: [9, 18] },
  { a: 'GYE', b: 'GPS', carrier: 'LA', number: 2430, durationMinutes: 105, priceUsd: 190, capacity: 150, hoursA: [8], hoursB: [13] },
  { a: 'UIO', b: 'GPS', carrier: 'LA', number: 2440, durationMinutes: 195, priceUsd: 235, capacity: 150, hoursA: [7], hoursB: [13] },
  { a: 'UIO', b: 'BOG', carrier: 'AV', number: 330, durationMinutes: 105, priceUsd: 176, capacity: 180, hoursA: [8, 17], hoursB: [10, 19] },
  { a: 'GYE', b: 'BOG', carrier: 'AV', number: 340, durationMinutes: 110, priceUsd: 178, capacity: 180, hoursA: [9, 18], hoursB: [11, 20] },
  { a: 'UIO', b: 'LIM', carrier: 'LA', number: 2450, durationMinutes: 120, priceUsd: 165, capacity: 180, hoursA: [9, 16], hoursB: [11, 18] },
  { a: 'GYE', b: 'LIM', carrier: 'LA', number: 2460, durationMinutes: 130, priceUsd: 170, capacity: 180, hoursA: [10], hoursB: [13] },
  { a: 'BOG', b: 'LIM', carrier: 'AV', number: 460, durationMinutes: 180, priceUsd: 205, capacity: 180, hoursA: [6, 16], hoursB: [8, 18] },
  { a: 'LIM', b: 'CUZ', carrier: 'LA', number: 2300, durationMinutes: 85, priceUsd: 76, capacity: 180, hoursA: [6, 10, 14], hoursB: [8, 12, 16] },
  { a: 'LIM', b: 'SCL', carrier: 'LA', number: 580, durationMinutes: 235, priceUsd: 232, capacity: 240, hoursA: [7, 15], hoursB: [10, 18] },
  { a: 'SCL', b: 'EZE', carrier: 'LA', number: 440, durationMinutes: 120, priceUsd: 138, capacity: 180, hoursA: [8, 17], hoursB: [10, 19] },
  { a: 'SCL', b: 'GRU', carrier: 'LA', number: 700, durationMinutes: 235, priceUsd: 262, capacity: 240, hoursA: [8, 18], hoursB: [10, 21] },
  { a: 'EZE', b: 'GRU', carrier: 'AR', number: 1230, durationMinutes: 170, priceUsd: 222, capacity: 180, hoursA: [9, 17], hoursB: [12, 20] },
  { a: 'BOG', b: 'PTY', carrier: 'CM', number: 200, durationMinutes: 105, priceUsd: 192, capacity: 150, hoursA: [8, 15], hoursB: [10, 17] },
  { a: 'PTY', b: 'MIA', carrier: 'CM', number: 300, durationMinutes: 215, priceUsd: 284, capacity: 150, hoursA: [7, 15], hoursB: [11, 19] },
  { a: 'BOG', b: 'MIA', carrier: 'AV', number: 20, durationMinutes: 215, priceUsd: 322, capacity: 240, hoursA: [6, 14], hoursB: [9, 17] },
  { a: 'GYE', b: 'MIA', carrier: 'LA', number: 600, durationMinutes: 225, priceUsd: 338, capacity: 240, hoursA: [11], hoursB: [14] },
  { a: 'UIO', b: 'MIA', carrier: 'LA', number: 610, durationMinutes: 230, priceUsd: 345, capacity: 240, hoursA: [10], hoursB: [13] },
  { a: 'MDE', b: 'MIA', carrier: 'AV', number: 30, durationMinutes: 200, priceUsd: 304, capacity: 240, hoursA: [9], hoursB: [12] },
  { a: 'LIM', b: 'MIA', carrier: 'LA', number: 620, durationMinutes: 300, priceUsd: 382, capacity: 240, hoursA: [8], hoursB: [14] },
  { a: 'BOG', b: 'MAD', carrier: 'UX', number: 100, durationMinutes: 600, priceUsd: 786, capacity: 300, hoursA: [21], hoursB: [12] },
  { a: 'UIO', b: 'MAD', carrier: 'UX', number: 110, durationMinutes: 610, priceUsd: 824, capacity: 300, hoursA: [20], hoursB: [12] },
  { a: 'BOG', b: 'EZE', carrier: 'AR', number: 1300, durationMinutes: 345, priceUsd: 334, capacity: 180, hoursA: [8], hoursB: [14] },
  { a: 'BOG', b: 'GRU', carrier: 'G3', number: 7300, durationMinutes: 380, priceUsd: 342, capacity: 180, hoursA: [9], hoursB: [15] },
  { a: 'LIM', b: 'GRU', carrier: 'G3', number: 7700, durationMinutes: 300, priceUsd: 301, capacity: 180, hoursA: [8], hoursB: [14] },
];

const localToUtcHour = (localHour: number, airport: string): number => (((localHour - UTC_OFFSET[airport]) % 24) + 24) % 24;

function expandRoutes(routes: RoutePair[]): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  for (const route of routes) {
    const legs: [string, string, number[]][] = [
      [route.a, route.b, route.hoursA],
      [route.b, route.a, route.hoursB],
    ];
    legs.forEach(([from, to, hours], direction) => {
      hours.forEach((localHour, index) => {
        entries.push({
          aerolinea: CARRIERS[route.carrier],
          codigoAerolinea: route.carrier,
          codigoVuelo: `${route.carrier}${route.number + index * 2 + direction}`,
          origenIATA: from,
          destinoIATA: to,
          hour: localToUtcHour(localHour, from),
          durationMinutes: route.durationMinutes,
          precioBase: route.priceUsd,
          initialAvailable: route.capacity,
          capacity: route.capacity,
          varied: true,
        });
      });
    });
  }
  return entries;
}

export const NETWORK: ScheduleEntry[] = [...SCHEDULE, ...expandRoutes(ROUTES)];

/** Fare multiplier by weekday (UTC), Sunday first: dearer Friday-Sunday, cheaper Tuesday-Wednesday. */
const WEEKDAY_FACTOR = [1.1, 1.0, 0.92, 0.92, 1.0, 1.12, 1.05];

/** Deterministic 0..1 value from a string, so re-running the seed gives the same load. */
function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

export const HORIZON_DAYS = 45;
const CAPACITY = 180;
const INSERT_BATCH = 500;

function utcDateAtHour(daysAhead: number, hour: number, now: Date): Date {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysAhead, hour, 0, 0, 0));
  return date;
}

/**
 * Idempotent: fare families are upserted by code; flights are keyed by (codigoVuelo, fechaSalida)
 * and inserted only when missing, so re-running never duplicates a flight and never resets the
 * inventory of one that already has bookings. Each run extends the schedule HORIZON_DAYS ahead.
 */
export async function seedFlights(dataSource: DataSource, now: Date = new Date()): Promise<{ families: number; flights: number }> {
  await dataSource.getRepository(FareFamily).upsert(FARE_FAMILIES, ['code']);

  const rows: Partial<Vuelo>[] = [];
  for (let day = 1; day <= HORIZON_DAYS; day++) {
    for (const entry of NETWORK) {
      const departure = utcDateAtHour(day, entry.hour, now);
      const capacity = entry.capacity ?? CAPACITY;
      let price = entry.precioBase;
      let open = entry.initialAvailable;
      if (entry.varied) {
        price = Math.round(entry.precioBase * WEEKDAY_FACTOR[departure.getUTCDay()]);
        open = Math.max(6, Math.round(capacity * (0.45 + 0.5 * hash01(`${entry.codigoVuelo}:${day}`))));
      }
      rows.push({
        aerolinea: entry.aerolinea,
        codigoAerolinea: entry.codigoAerolinea,
        codigoVuelo: entry.codigoVuelo,
        origenIATA: entry.origenIATA,
        destinoIATA: entry.destinoIATA,
        fechaSalida: departure,
        fechaLlegada: new Date(departure.getTime() + entry.durationMinutes * 60_000),
        precioBase: price,
        asientosDisponibles: open,
        capacidadTotal: capacity,
        durationMinutes: entry.durationMinutes,
      });
    }
  }

  // Batches keep each INSERT well under PostgreSQL's 65,535 bind-parameter limit.
  let created = 0;
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const result = await dataSource
      .createQueryBuilder()
      .insert()
      .into(Vuelo)
      .values(rows.slice(i, i + INSERT_BATCH))
      .orIgnore() // ON CONFLICT DO NOTHING on UQ_vuelos_codigo_salida
      .returning('"id"')
      .execute();
    created += Array.isArray(result.raw) ? result.raw.length : 0;
  }

  return { families: FARE_FAMILIES.length, flights: created };
}
