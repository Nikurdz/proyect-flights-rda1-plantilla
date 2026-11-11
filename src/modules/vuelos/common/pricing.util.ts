import { scaleMinorUnits } from './money.util';

export type PassengerType = 'ADULT' | 'YOUTH' | 'CHILD' | 'INFANT';

export interface PassengerBreakdown {
  adults: number;
  youths: number;
  children: number;
  infants: number;
}

export interface PriceMinor {
  baseFare: number;
  taxes: number;
  total: number;
}

// The SRS fixes neither per-type discounts nor a tariff table. These factors are a
// documented placeholder (youths pay the adult fare, children 75%, lap infants 10%) that
// a real tariff engine would replace; they live here so search and hold price identically.
export const PASSENGER_FARE_FACTORS: Record<PassengerType, number> = {
  ADULT: 1,
  YOUTH: 1,
  CHILD: 0.75,
  INFANT: 0.1,
};

export const PASSENGER_TYPES: PassengerType[] = ['ADULT', 'YOUTH', 'CHILD', 'INFANT'];

export function countFor(breakdown: PassengerBreakdown, type: PassengerType): number {
  switch (type) {
    case 'ADULT':
      return breakdown.adults;
    case 'YOUTH':
      return breakdown.youths;
    case 'CHILD':
      return breakdown.children;
    case 'INFANT':
      return breakdown.infants;
  }
}

/** Passengers that occupy a seat. Lap infants (RN-04/RN-05) do not. */
export function seatsRequired(breakdown: PassengerBreakdown): number {
  return breakdown.adults + breakdown.youths + breakdown.children;
}

export function totalPassengers(breakdown: PassengerBreakdown): number {
  return seatsRequired(breakdown) + breakdown.infants;
}

// RN-07: every quoted price includes taxes. taxRate is a flat configurable percentage,
// and priceMultiplier stands in for fare-family pricing rules.
export function priceForPassengerType(
  basePriceMinor: number,
  familyMultiplier: number,
  type: PassengerType,
  taxRate: number,
): PriceMinor {
  const baseFare = scaleMinorUnits(basePriceMinor, familyMultiplier * PASSENGER_FARE_FACTORS[type]);
  const taxes = scaleMinorUnits(baseFare, taxRate);
  return { baseFare, taxes, total: baseFare + taxes };
}

export interface PartyPrice {
  baseFare: number;
  taxes: number;
  total: number;
}

/** Same as priceForParty but keeps the fare and tax parts apart (refunds and fare differences need them). */
export function priceForPartyParts(
  basePriceMinor: number,
  familyMultiplier: number,
  breakdown: PassengerBreakdown,
  taxRate: number,
): PartyPrice {
  return PASSENGER_TYPES.reduce<PartyPrice>(
    (sum, type) => {
      const count = countFor(breakdown, type);
      if (count === 0) return sum;
      const unit = priceForPassengerType(basePriceMinor, familyMultiplier, type, taxRate);
      return { baseFare: sum.baseFare + unit.baseFare * count, taxes: sum.taxes + unit.taxes * count, total: sum.total + unit.total * count };
    },
    { baseFare: 0, taxes: 0, total: 0 },
  );
}

/** Total for the whole party on one flight/fare: sum of (unit price x head count) per type. */
export function priceForParty(
  basePriceMinor: number,
  familyMultiplier: number,
  breakdown: PassengerBreakdown,
  taxRate: number,
): number {
  return PASSENGER_TYPES.reduce((sum, type) => {
    const count = countFor(breakdown, type);
    if (count === 0) return sum;
    return sum + priceForPassengerType(basePriceMinor, familyMultiplier, type, taxRate).total * count;
  }, 0);
}
