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
}

// A curated recurring daily schedule: the SRS's own evidence route (BOG-SCL and back) plus a
// few domestic/regional legs. A deliberate, documented reduction — not a real timetable.
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

export const HORIZON_DAYS = 45;
const CAPACITY = 180;

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
    for (const entry of SCHEDULE) {
      const departure = utcDateAtHour(day, entry.hour, now);
      rows.push({
        aerolinea: entry.aerolinea,
        codigoAerolinea: entry.codigoAerolinea,
        codigoVuelo: entry.codigoVuelo,
        origenIATA: entry.origenIATA,
        destinoIATA: entry.destinoIATA,
        fechaSalida: departure,
        fechaLlegada: new Date(departure.getTime() + entry.durationMinutes * 60_000),
        precioBase: entry.precioBase,
        asientosDisponibles: entry.initialAvailable,
        capacidadTotal: CAPACITY,
        durationMinutes: entry.durationMinutes,
      });
    }
  }

  const result = await dataSource
    .createQueryBuilder()
    .insert()
    .into(Vuelo)
    .values(rows)
    .orIgnore() // ON CONFLICT DO NOTHING on UQ_vuelos_codigo_salida
    .returning('"id"')
    .execute();

  return { families: FARE_FAMILIES.length, flights: Array.isArray(result.raw) ? result.raw.length : 0 };
}
