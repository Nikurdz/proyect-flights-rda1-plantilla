import { describe, expect, it } from 'vitest';
import { groupTotalFromAdultPrice, lowestTotalIndex, onlyFlaggedIndex, uniqueMinIndex } from '../../src/lib/best-value';

describe('lowestTotalIndex', () => {
  it('points at the lowest total, whatever its position', () => {
    expect(lowestTotalIndex(['120.00', '86.50', '99.00'])).toBe(1);
    expect(lowestTotalIndex([40, '90.00', '55'])).toBe(0);
  });

  it('points at nothing when there is nothing to compare', () => {
    expect(lowestTotalIndex([])).toBe(-1);
    expect(lowestTotalIndex(['86.00'])).toBe(-1);
    expect(lowestTotalIndex(['86.00', '86.00'])).toBe(-1);
    expect(lowestTotalIndex([undefined, '86.00'])).toBe(-1);
  });
});

describe('uniqueMinIndex', () => {
  it('points at the single fastest option', () => {
    expect(uniqueMinIndex([90, 60, 75])).toBe(1);
  });

  it('points at nothing on a tie or with nothing to compare', () => {
    expect(uniqueMinIndex([60, 60, 75])).toBe(-1);
    expect(uniqueMinIndex([60, 60, 60])).toBe(-1);
    expect(uniqueMinIndex([60])).toBe(-1);
    expect(uniqueMinIndex([])).toBe(-1);
  });
});

describe('onlyFlaggedIndex', () => {
  it('returns the flagged position only when exactly one is flagged', () => {
    expect(onlyFlaggedIndex([false, true, false])).toBe(1);
    expect(onlyFlaggedIndex([true, true, false])).toBe(-1);
    expect(onlyFlaggedIndex([false, false])).toBe(-1);
  });
});

describe('groupTotalFromAdultPrice', () => {
  it('multiplies by adults and youths, who pay the adult fare', () => {
    expect(groupTotalFromAdultPrice('86.25', { adt: 2, yth: 1, chd: 0, inf: 0 })).toBe(258.75);
  });

  it('is unknown when children or infants travel (their fare differs)', () => {
    expect(groupTotalFromAdultPrice('86.25', { adt: 2, yth: 0, chd: 1, inf: 0 })).toBeNull();
    expect(groupTotalFromAdultPrice('86.25', { adt: 1, yth: 0, chd: 0, inf: 1 })).toBeNull();
    expect(groupTotalFromAdultPrice(undefined, { adt: 1, yth: 0, chd: 0, inf: 0 })).toBeNull();
  });
});
