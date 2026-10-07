import { HttpStatus } from '@nestjs/common';
import { todayUtc } from './date.util';
import { ProblemDetailsException } from './problem-details.exception';
import { PassengerBreakdown, PassengerType, totalPassengers } from './pricing.util';

export type { PassengerBreakdown };
export type PassengerTypeBand = PassengerType;

export interface ItineraryLeg {
  origin: string;
  destination: string;
  departureDate: string;
}

/** RN-01: origin and destination of a single leg must differ. */
export function assertOriginDestinationDiffer(leg: ItineraryLeg): void {
  if (leg.origin === leg.destination) {
    throw new ProblemDetailsException(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_FAILED',
      'Origin equals destination',
      `origin and destination must differ (got "${leg.origin}")`,
      [{ name: 'itineraries.destination', reason: 'must differ from origin' }],
    );
  }
}

/**
 * RN-02: no leg may depart before today and each subsequent leg must not depart before
 * the previous one. Compared as calendar dates (not instants) so a flight later today is
 * still bookable; per-airport timezones are not modelled yet, so "today" is the UTC date.
 */
export function assertChronology(legs: ItineraryLeg[], today: string = todayUtc()): void {
  let previous: string | null = null;

  for (const leg of legs) {
    if (leg.departureDate < today) {
      throw new ProblemDetailsException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Departure date in the past',
        `departureDate ${leg.departureDate} is before the current date`,
        [{ name: 'itineraries.departureDate', reason: 'must not be in the past' }],
      );
    }
    if (previous && leg.departureDate < previous) {
      throw new ProblemDetailsException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Itinerary legs out of order',
        `departureDate ${leg.departureDate} is before a previous leg's departure date`,
        [{ name: 'itineraries.departureDate', reason: 'legs must be in chronological order' }],
      );
    }
    previous = leg.departureDate;
  }
}

/** RN-04: infants without a seat cannot outnumber the accompanying adults. */
export function assertInfantRatio(passengers: PassengerBreakdown): void {
  if (passengers.infants > passengers.adults) {
    throw new ProblemDetailsException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'INFANT_SEAT_NOT_ALLOWED',
      'Too many infants',
      `${passengers.infants} infant(s) cannot exceed ${passengers.adults} adult(s)`,
    );
  }
}

/** RN-05: the party size is capped per order; larger groups go through group sales. */
export function assertGroupSize(passengers: PassengerBreakdown, maxPassengers: number): void {
  const total = totalPassengers(passengers);
  if (total < 1) {
    throw new ProblemDetailsException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'VALIDATION_FAILED',
      'No passengers',
      'At least one passenger is required.',
    );
  }
  if (total > maxPassengers) {
    throw new ProblemDetailsException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'VALIDATION_FAILED',
      'Group too large',
      `${total} passengers exceed the maximum of ${maxPassengers} per order; use group sales.`,
    );
  }
}

// RN-06. Age-band thresholds per PassengerType are not defined by the SRS or the
// contract — this is a documented placeholder default pending a business decision, not
// a confirmed rule (see docs/architecture equivalent discussion in the flights SRS).
const AGE_BANDS: { type: PassengerTypeBand; minAge: number; maxAge: number }[] = [
  { type: 'INFANT', minAge: 0, maxAge: 1 },
  { type: 'CHILD', minAge: 2, maxAge: 11 },
  { type: 'YOUTH', minAge: 12, maxAge: 17 },
  { type: 'ADULT', minAge: 18, maxAge: 120 },
];

/** Whole years between two dates, using UTC fields so the host timezone cannot shift a birthday. */
export function ageAt(birthDate: string, referenceDate: string): number {
  const birth = new Date(birthDate);
  const reference = new Date(referenceDate);
  let age = reference.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthdayThisYear =
    reference.getUTCMonth() > birth.getUTCMonth() ||
    (reference.getUTCMonth() === birth.getUTCMonth() && reference.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthdayThisYear) {
    age -= 1;
  }
  return age;
}

/** RN-06: passenger type must match age at the itinerary's first departure date. */
export function assertPassengerTypeMatchesAge(
  declaredType: PassengerTypeBand,
  birthDate: string,
  firstFlightDate: string,
): void {
  const age = ageAt(birthDate, firstFlightDate);
  const band = AGE_BANDS.find((b) => age >= b.minAge && age <= b.maxAge);
  if (!band || band.type !== declaredType) {
    throw new ProblemDetailsException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'VALIDATION_FAILED',
      'Passenger type does not match age',
      `Passenger born ${birthDate} is ${age} year(s) old at the first flight date and cannot be declared as ${declaredType}`,
    );
  }
}

export interface PassengerIdentity {
  passengerId: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  documentNumber: string;
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

/** RF-068: the same person (or the same document / client passengerId) cannot appear twice. */
export function assertNoDuplicatePassengers(passengers: PassengerIdentity[]): void {
  const seen = new Set<string>();
  for (const p of passengers) {
    const keys = [
      `id:${p.passengerId}`,
      // "AB 123", "ab-123" and "AB123" are the same document.
      `doc:${p.documentNumber.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase()}`,
      `person:${normalizeName(p.firstName)}|${normalizeName(p.lastName)}|${p.birthDate}`,
    ];
    for (const key of keys) {
      if (seen.has(key)) {
        throw new ProblemDetailsException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'VALIDATION_FAILED',
          'Duplicate passenger',
          `Passenger ${p.firstName} ${p.lastName} appears more than once in the booking.`,
          [{ name: 'passengers', reason: 'duplicate passenger' }],
        );
      }
      seen.add(key);
    }
  }
}

/** Each infant travels with exactly one adult of the same booking, and an adult holds at most one infant. */
export function assertInfantAssociations(passengers: { passengerId: string; passengerType: string; associatedAdultId?: string }[]): void {
  const adults = new Set(passengers.filter((p) => p.passengerType === 'ADULT').map((p) => p.passengerId));
  const infantsPerAdult = new Map<string, number>();

  for (const infant of passengers.filter((p) => p.passengerType === 'INFANT')) {
    if (!infant.associatedAdultId || !adults.has(infant.associatedAdultId)) {
      throw new ProblemDetailsException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INFANT_SEAT_NOT_ALLOWED',
        'Infant without an accompanying adult',
        `Infant ${infant.passengerId} must reference an adult of this booking in associatedAdultId.`,
        [{ name: 'passengers.associatedAdultId', reason: 'must reference an adult of the booking' }],
      );
    }
    const count = (infantsPerAdult.get(infant.associatedAdultId) ?? 0) + 1;
    infantsPerAdult.set(infant.associatedAdultId, count);
    if (count > 1) {
      throw new ProblemDetailsException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INFANT_SEAT_NOT_ALLOWED',
        'Too many infants for one adult',
        `Adult ${infant.associatedAdultId} cannot carry more than one infant.`,
      );
    }
  }
}
