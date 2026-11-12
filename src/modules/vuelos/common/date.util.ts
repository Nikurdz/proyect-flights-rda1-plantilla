const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written as YYYY-MM-DD (rejects 2026-02-31). */
export function isDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/**
 * Half-open [start, end) UTC range covering one UTC calendar day. Instants are stored in UTC
 * (RNF-28). Searches read a departureDate as a local day (`ecuadorDayRange` for the web,
 * `zonedDayRange` in the origin airport's zone for the partner API); the UTC day remains the
 * default for callers that pass no option.
 */
export function utcDayRange(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Ecuador is UTC-5 all year (no daylight saving). The web and the back office work in Ecuador time: the day a person
 * picks is an Ecuador calendar day. Instants stay in UTC (storage, API v2, stock sent to Booking); only this
 * interpretation of a calendar day changes, and only for the callers that ask for it.
 */
export const ECUADOR_UTC_OFFSET_HOURS = -5;

/** Half-open [start, end) UTC range covering one Ecuador calendar day (00:00 to 24:00 at UTC-5). */
export function ecuadorDayRange(date: string): { start: Date; end: Date } {
  const start = new Date(new Date(`${date}T00:00:00.000Z`).getTime() - ECUADOR_UTC_OFFSET_HOURS * 3_600_000);
  return { start, end: new Date(start.getTime() + 24 * 3_600_000) };
}

/** Today's date (YYYY-MM-DD) in Ecuador. */
export function todayEcuador(now: Date = new Date()): string {
  return new Date(now.getTime() + ECUADOR_UTC_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10);
}

/** An instant as "2026-11-08 21:30 (hora de Ecuador)", for messages people read. */
export function formatEcuador(iso: string): string {
  const local = new Date(new Date(iso).getTime() + ECUADOR_UTC_OFFSET_HOURS * 3_600_000).toISOString();
  return `${local.slice(0, 10)} ${local.slice(11, 16)} (hora de Ecuador)`;
}

const zoneFormatters = new Map<string, Intl.DateTimeFormat>();

/** The wall-clock fields of an instant in an IANA zone, read back as if they were UTC (throws RangeError for an unknown zone). */
function wallClockAsUtc(instant: number, timeZone: string): number {
  let formatter = zoneFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    zoneFormatters.set(timeZone, formatter);
  }
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(new Date(instant))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
}

/** The instant at which the calendar day `date` starts (local midnight) in an IANA zone. */
function zonedMidnight(date: string, timeZone: string): Date {
  const wall = new Date(`${date}T00:00:00.000Z`).getTime();
  const offsetAt = (instant: number) => wallClockAsUtc(instant, timeZone) - instant;
  // Two passes: the offset at the first guess, then at the corrected instant (matters only when the zone's offset changes near midnight).
  const guess = wall - offsetAt(wall);
  return new Date(wall - offsetAt(guess));
}

/**
 * Half-open [start, end) UTC range covering one calendar day of an IANA zone: local midnight of `date` to local midnight
 * of the next day (America/Guayaquil starts at 05:00Z, Pacific/Galapagos at 06:00Z). The partner API (v2) reads a
 * departureDate this way, in the zone of the origin airport.
 */
export function zonedDayRange(date: string, timeZone: string): { start: Date; end: Date } {
  const nextDay = new Date(new Date(`${date}T00:00:00.000Z`).getTime() + 24 * 3_600_000).toISOString().slice(0, 10);
  return { start: zonedMidnight(date, timeZone), end: zonedMidnight(nextDay, timeZone) };
}

/** The calendar date (YYYY-MM-DD) of an instant in an IANA zone. */
export function dayInZone(instant: Date | string, timeZone: string): string {
  const at = instant instanceof Date ? instant : new Date(instant);
  return new Date(wallClockAsUtc(at.getTime(), timeZone)).toISOString().slice(0, 10);
}

/** Today's date (YYYY-MM-DD) in an IANA zone. */
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  return dayInZone(now, timeZone);
}

/** TypeORM can hand back a Date or an ISO string depending on the column type/driver. */
export function toIso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

/**
 * An instant written with the real UTC offset of an IANA zone: `2026-11-12T08:30:00.000-05:00`. Same instant as
 * `toISOString()` (milliseconds kept), other writing; zones with daylight saving give the offset of that date.
 */
export function toZonedIso(instant: Date | string | number, timeZone: string): string {
  const at = instant instanceof Date ? instant : new Date(instant);
  const time = at.getTime();
  if (Number.isNaN(time)) throw new RangeError('Invalid instant');
  const offsetMinutes = Math.round((wallClockAsUtc(Math.floor(time / 1000) * 1000, timeZone) - Math.floor(time / 1000) * 1000) / 60_000);
  const local = new Date(time + offsetMinutes * 60_000).toISOString().slice(0, 23);
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  return `${local}${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}
