import { HttpStatus } from '@nestjs/common';
import { ProblemDetailsException } from './problem-details.exception';

export interface ItineraryLeg {
  origin: string;
  destination: string;
  departureDate: string;
}

export interface PassengerBreakdown {
  adults: number;
  youths: number;
  children: number;
  infants: number;
}

export type PassengerTypeBand = 'ADULT' | 'YOUTH' | 'CHILD' | 'INFANT';

/** RN-01: origin and destination of a single leg must differ. */
export function assertOriginDestinationDiffer(leg: ItineraryLeg): void {
  if (leg.origin === leg.destination) {
    throw new ProblemDetailsException(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_FAILED',
      'Origin equals destination',
      `origin and destination must differ (got "${leg.origin}")`,
    );
  }
}

/**
 * RN-02: no leg may depart before "now" (no per-airport timezone modeling this phase —
 * a documented simplification), and each subsequent leg must not depart before the
 * previous one.
 */
export function assertChronology(legs: ItineraryLeg[]): void {
  const now = new Date();
  let previousDeparture: Date | null = null;

  for (const leg of legs) {
    const departure = new Date(leg.departureDate);
    if (departure < now) {
      throw new ProblemDetailsException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Departure date in the past',
        `departureDate ${leg.departureDate} is before the current date`,
      );
    }
    if (previousDeparture && departure < previousDeparture) {
      throw new ProblemDetailsException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Itinerary legs out of order',
        `departureDate ${leg.departureDate} is before a previous leg's departure date`,
      );
    }
    previousDeparture = departure;
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

// RN-06. Age-band thresholds per PassengerType are not defined by the SRS or the
// contract — this is a documented placeholder default pending a business decision, not
// a confirmed rule (see docs/architecture equivalent discussion in the flights SRS).
const AGE_BANDS: { type: PassengerTypeBand; minAge: number; maxAge: number }[] = [
  { type: 'INFANT', minAge: 0, maxAge: 1 },
  { type: 'CHILD', minAge: 2, maxAge: 11 },
  { type: 'YOUTH', minAge: 12, maxAge: 17 },
  { type: 'ADULT', minAge: 18, maxAge: 120 },
];

export function ageAt(birthDate: string, referenceDate: string): number {
  const birth = new Date(birthDate);
  const reference = new Date(referenceDate);
  let age = reference.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear =
    reference.getMonth() > birth.getMonth() ||
    (reference.getMonth() === birth.getMonth() && reference.getDate() >= birth.getDate());
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
