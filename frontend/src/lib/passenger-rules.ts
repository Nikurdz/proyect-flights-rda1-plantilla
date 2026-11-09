import { addDaysToDate } from './dates';

/**
 * Passenger rules of the checkout, mirroring the backend (`common/business-rules.ts`). The backend remains the
 * authority; these run first so the person finds out before sending.
 */

export type PassengerType = 'ADULT' | 'YOUTH' | 'CHILD' | 'INFANT';

export interface AgeBand {
  type: PassengerType;
  minAge: number;
  maxAge: number;
}

export const AGE_BANDS: readonly AgeBand[] = [
  { type: 'INFANT', minAge: 0, maxAge: 1 },
  { type: 'CHILD', minAge: 2, maxAge: 11 },
  { type: 'YOUTH', minAge: 12, maxAge: 17 },
  { type: 'ADULT', minAge: 18, maxAge: 120 },
];

/** Most passengers of one order (`MAX_PASSENGERS_PER_ORDER` in the backend). */
export const MAX_PASSENGERS = 9;
/** Oldest age a passenger can declare. */
export const MAX_AGE = 120;

const TYPE_NAMES: Record<PassengerType, string> = {
  INFANT: 'Infante',
  CHILD: 'Niño',
  YOUTH: 'Joven',
  ADULT: 'Adulto',
};

export const bandOfType = (type: PassengerType): AgeBand => AGE_BANDS.find((b) => b.type === type)!;

/** The UTC calendar day (YYYY-MM-DD) of a flight instant: what the backend measures ages against. */
export function flightDay(salida: string): string {
  return new Date(salida).toISOString().slice(0, 10);
}

/** Whole years between two YYYY-MM-DD dates, with UTC fields exactly like the backend `ageAt`. */
export function ageAtDate(birthDate: string, referenceDate: string): number {
  const birth = new Date(birthDate);
  const reference = new Date(referenceDate);
  let age = reference.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthday =
    reference.getUTCMonth() > birth.getUTCMonth() ||
    (reference.getUTCMonth() === birth.getUTCMonth() && reference.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthday) age -= 1;
  return age;
}

/** The passenger type an age belongs to, or undefined when it is out of every band. */
export function expectedTypeForAge(age: number): PassengerType | undefined {
  return AGE_BANDS.find((b) => age >= b.minAge && age <= b.maxAge)?.type;
}

/** "Niño: 2 a 11 años el día del primer vuelo" */
export function ageRangeMessage(type: PassengerType, when = 'el día del primer vuelo'): string {
  const { minAge, maxAge } = bandOfType(type);
  return `${TYPE_NAMES[type]}: ${minAge} a ${maxAge} años ${when}`;
}

/** A real calendar date written YYYY-MM-DD (rejects 2026-02-31). */
export function isRealCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Later than `today` (both YYYY-MM-DD; today is the Ecuador day). */
export const isFutureDate = (value: string, today: string): boolean => value > today;

/** More than 120 whole years old on `today`. */
export const isOlderThanMax = (birthDate: string, today: string): boolean => ageAtDate(birthDate, today) > MAX_AGE;

/** A date `years` earlier, clamping 29 Feb to 28 Feb when the target year is not a leap year. */
function shiftYears(date: string, years: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y + years, m - 1, d));
  if (target.getUTCMonth() !== m - 1) return new Date(Date.UTC(y + years, m - 1, 0)).toISOString().slice(0, 10);
  return target.toISOString().slice(0, 10);
}

/** Birth dates (inclusive) that make a person of `type` on `referenceDay`, never after `today` nor 120+ years old. */
export function birthDateRange(type: PassengerType, referenceDay: string, today: string): { min: string; max: string } {
  const { minAge, maxAge } = bandOfType(type);
  const latest = shiftYears(referenceDay, -minAge);
  const earliest = addDaysToDate(shiftYears(referenceDay, -(maxAge + 1)), 1);
  const oldest = addDaysToDate(shiftYears(today, -(MAX_AGE + 1)), 1);
  return { min: earliest > oldest ? earliest : oldest, max: latest < today ? latest : today };
}

/** Ecuadorian cédula (módulo 10), same as the backend `isValidEcuadorCedula`. */
export function isValidEcuadorCedula(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;
  const province = Number(value.slice(0, 2));
  if (!((province >= 1 && province <= 24) || province === 30)) return false;
  if (Number(value[2]) >= 6) return false;
  const sum = [...value.slice(0, 9)].reduce((total, digit, index) => {
    const product = Number(digit) * (index % 2 === 0 ? 2 : 1);
    return total + (product > 9 ? product - 9 : product);
  }, 0);
  return (10 - (sum % 10)) % 10 === Number(value[9]);
}

/** The document must expire strictly after the UTC day of the last flight. */
export const expiresAfterLastFlight = (expiry: string, lastFlightDay: string): boolean => expiry > lastFlightDay;

/** "AB 123", "ab-123" and "AB123" are the same document. */
export const normalizeDocumentNumber = (value: string): string => value.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase();

export const normalizePersonName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();

/**
 * Does any leg cross a border? Countries come from the airport catalogue; an airport missing from it counts as
 * international (the backend asks for the stricter data in that case).
 */
export function isInternationalTrip(legs: ReadonlyArray<{ origen: string; destino: string }>, countryOf: ReadonlyMap<string, string>): boolean {
  return legs.some((leg) => {
    const from = countryOf.get(leg.origen);
    const to = countryOf.get(leg.destino);
    return !from || !to || from !== to;
  });
}
