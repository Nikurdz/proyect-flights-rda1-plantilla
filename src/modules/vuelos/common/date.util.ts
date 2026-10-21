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

/** TypeORM can hand back a Date or an ISO string depending on the column type/driver. */
export function toIso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}
