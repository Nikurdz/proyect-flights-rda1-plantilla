import { scaleMinorUnits } from './money.util';
import { PartyPrice } from './pricing.util';

const HOUR_MS = 3_600_000;

/** Whether the booking can still be altered: strictly more than `cutoffHours` before departure. */
export function isBeforeCutoff(departure: Date, now: Date, cutoffHours: number): boolean {
  return departure.getTime() - now.getTime() > cutoffHours * HOUR_MS;
}

export function hasDeparted(departure: Date, now: Date): boolean {
  return departure.getTime() <= now.getTime();
}

export type CheckInWindow = 'NOT_YET' | 'OPEN' | 'CLOSED';

/** Check-in opens `opensHours` before departure and closes `closesHours` before it. */
export function checkInWindow(departure: Date, now: Date, opensHours: number, closesHours: number): CheckInWindow {
  const untilDeparture = departure.getTime() - now.getTime();
  if (untilDeparture > opensHours * HOUR_MS) return 'NOT_YET';
  if (untilDeparture < closesHours * HOUR_MS) return 'CLOSED';
  return 'OPEN';
}

export interface CancellationAmounts {
  isRefundable: boolean;
  refundMinor: number;
  penaltyMinor: number;
}

/**
 * What cancelling returns. A refundable fare gives back the total minus a percentage penalty; a non-refundable
 * one gives back only the taxes (the fare is kept). Extra baggage is refunded in full on top of either, because
 * an unused add-on is not part of the fare (RF-ANC-009). The airline cancelling a flight (`penaltyPercent` 0 with
 * `refundable` true) returns everything.
 */
export function cancellationAmounts(input: {
  fareTotalMinor: number;
  taxesMinor: number;
  baggageMinor: number;
  refundable: boolean;
  penaltyPercent: number;
}): CancellationAmounts {
  const { fareTotalMinor, taxesMinor, baggageMinor, refundable, penaltyPercent } = input;
  if (refundable) {
    const penaltyMinor = scaleMinorUnits(fareTotalMinor, penaltyPercent / 100);
    return { isRefundable: true, refundMinor: fareTotalMinor - penaltyMinor + baggageMinor, penaltyMinor };
  }
  const refundFare = Math.min(taxesMinor, fareTotalMinor);
  return { isRefundable: false, refundMinor: refundFare + baggageMinor, penaltyMinor: fareTotalMinor - refundFare };
}

export interface ChangePricing {
  fareDifferenceMinor: number;
  taxDifferenceMinor: number;
  changeFeeMinor: number;
  totalToPayMinor: number;
}

/**
 * Moving a leg to another flight costs the fare and tax difference plus the flat fee. A cheaper flight gives a
 * negative difference, but it is never refunded: the amount to pay is at least the fee.
 */
export function changePricing(oldParts: PartyPrice, newParts: PartyPrice, changeFeeMinor: number): ChangePricing {
  const fareDifferenceMinor = newParts.baseFare - oldParts.baseFare;
  const taxDifferenceMinor = newParts.taxes - oldParts.taxes;
  return {
    fareDifferenceMinor,
    taxDifferenceMinor,
    changeFeeMinor,
    totalToPayMinor: Math.max(0, fareDifferenceMinor + taxDifferenceMinor) + changeFeeMinor,
  };
}

/** Boarding group by fare family: the more flexible the fare, the earlier it boards. */
export function boardingGroupFor(fareBrand: string): 'A' | 'B' | 'C' {
  if (fareBrand === 'FULL') return 'A';
  if (fareBrand === 'LIGHT') return 'B';
  return 'C';
}

/** Lowest free seat of the cabin in row-then-column order; null when the cabin is full. */
export function firstFreeSeat(seats: string[], taken: Set<string>): string | null {
  return seats.find((seat) => !taken.has(seat)) ?? null;
}
