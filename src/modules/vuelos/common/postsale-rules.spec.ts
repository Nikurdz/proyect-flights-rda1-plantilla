import { boardingGroupFor, cancellationAmounts, changePricing, checkInWindow, firstFreeSeat, hasDeparted, isBeforeCutoff } from './postsale-rules';
import { priceForParty, priceForPartyParts } from './pricing.util';

const at = (iso: string) => new Date(iso);
const DEPARTURE = at('2027-03-10T12:00:00.000Z');

describe('cutoff and departure', () => {
  it('allows changes strictly more than the cutoff before departure', () => {
    expect(isBeforeCutoff(DEPARTURE, at('2027-03-10T08:59:59.000Z'), 3)).toBe(true);
    expect(isBeforeCutoff(DEPARTURE, at('2027-03-10T09:00:00.000Z'), 3)).toBe(false); // exactly 3 h: closed
    expect(isBeforeCutoff(DEPARTURE, at('2027-03-10T11:00:00.000Z'), 3)).toBe(false);
  });

  it('knows when a flight has left', () => {
    expect(hasDeparted(DEPARTURE, at('2027-03-10T12:00:00.000Z'))).toBe(true);
    expect(hasDeparted(DEPARTURE, at('2027-03-10T11:59:59.000Z'))).toBe(false);
  });
});

describe('checkInWindow', () => {
  it('opens 48 h and closes 1 h before departure', () => {
    expect(checkInWindow(DEPARTURE, at('2027-03-08T11:59:00.000Z'), 48, 1)).toBe('NOT_YET');
    expect(checkInWindow(DEPARTURE, at('2027-03-08T12:00:00.000Z'), 48, 1)).toBe('OPEN');
    expect(checkInWindow(DEPARTURE, at('2027-03-10T10:59:00.000Z'), 48, 1)).toBe('OPEN');
    expect(checkInWindow(DEPARTURE, at('2027-03-10T11:01:00.000Z'), 48, 1)).toBe('CLOSED');
    expect(checkInWindow(DEPARTURE, at('2027-03-10T13:00:00.000Z'), 48, 1)).toBe('CLOSED');
  });
});

describe('cancellationAmounts', () => {
  it('keeps a percentage of a refundable fare and refunds the rest', () => {
    expect(cancellationAmounts({ fareTotalMinor: 100_000, taxesMinor: 13_043, baggageMinor: 0, refundable: true, penaltyPercent: 10 })).toEqual({
      isRefundable: true,
      refundMinor: 90_000,
      penaltyMinor: 10_000,
    });
  });

  it('returns only the taxes of a non-refundable fare', () => {
    expect(cancellationAmounts({ fareTotalMinor: 100_000, taxesMinor: 13_043, baggageMinor: 0, refundable: false, penaltyPercent: 10 })).toEqual({
      isRefundable: false,
      refundMinor: 13_043,
      penaltyMinor: 86_957,
    });
  });

  it('refunds extra baggage in full on top, whichever the fare', () => {
    const full = cancellationAmounts({ fareTotalMinor: 100_000, taxesMinor: 13_043, baggageMinor: 8_000, refundable: true, penaltyPercent: 10 });
    expect(full.refundMinor).toBe(98_000);
    const basic = cancellationAmounts({ fareTotalMinor: 100_000, taxesMinor: 13_043, baggageMinor: 8_000, refundable: false, penaltyPercent: 10 });
    expect(basic.refundMinor).toBe(21_043);
  });

  it('returns everything when the airline cancels (no penalty)', () => {
    expect(cancellationAmounts({ fareTotalMinor: 100_000, taxesMinor: 13_043, baggageMinor: 4_000, refundable: true, penaltyPercent: 0 })).toEqual({
      isRefundable: true,
      refundMinor: 104_000,
      penaltyMinor: 0,
    });
  });

  it('never refunds more taxes than were paid', () => {
    expect(cancellationAmounts({ fareTotalMinor: 5_000, taxesMinor: 9_999, baggageMinor: 0, refundable: false, penaltyPercent: 10 }).refundMinor).toBe(5_000);
  });
});

describe('changePricing', () => {
  const parts = (baseFare: number, taxes: number) => ({ baseFare, taxes, total: baseFare + taxes });

  it('charges the difference plus the fee', () => {
    expect(changePricing(parts(100_000, 15_000), parts(120_000, 18_000), 3_000)).toEqual({
      fareDifferenceMinor: 20_000,
      taxDifferenceMinor: 3_000,
      changeFeeMinor: 3_000,
      totalToPayMinor: 26_000,
    });
  });

  it('never refunds a cheaper flight: only the fee is due', () => {
    const result = changePricing(parts(100_000, 15_000), parts(80_000, 12_000), 3_000);
    expect(result.fareDifferenceMinor).toBe(-20_000);
    expect(result.totalToPayMinor).toBe(3_000);
  });
});

describe('priceForPartyParts', () => {
  it('splits the party price into fare and taxes that add up to the same total', () => {
    const breakdown = { adults: 2, youths: 0, children: 1, infants: 1 };
    const parts = priceForPartyParts(32_000, 1.3, breakdown, 0.15);
    expect(parts.total).toBe(parts.baseFare + parts.taxes);
    expect(parts.total).toBe(priceForParty(32_000, 1.3, breakdown, 0.15));
    expect(parts.taxes).toBeGreaterThan(0);
  });
});

describe('boarding order and seats', () => {
  it('boards flexible fares first', () => {
    expect(['FULL', 'LIGHT', 'BASIC', 'OTHER'].map(boardingGroupFor)).toEqual(['A', 'B', 'C', 'C']);
  });

  it('picks the lowest free seat, or none when the cabin is full', () => {
    const cabin = ['1A', '1B', '1C'];
    expect(firstFreeSeat(cabin, new Set(['1A']))).toBe('1B');
    expect(firstFreeSeat(cabin, new Set(cabin))).toBeNull();
  });
});
