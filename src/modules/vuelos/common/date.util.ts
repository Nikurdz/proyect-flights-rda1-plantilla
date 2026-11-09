const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written as YYYY-MM-DD (rejects 2026-02-31). */
export function isDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/**
 * Half-open [start, end) UTC range covering one calendar day. Instants are stored in UTC
 * (RNF-28); until an airport timezone catalog is wired into search, a requested
 * departureDate is interpreted as a UTC calendar day, and this is the only place that
 * assumption lives.
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

/** TypeORM can hand back a Date or an ISO string depending on the column type/driver. */
export function toIso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}
