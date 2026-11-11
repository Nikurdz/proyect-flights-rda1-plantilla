import { describe, expect, it } from 'vitest';
import {
  ageAtDate,
  ageRangeMessage,
  birthDateRange,
  expectedTypeForAge,
  expiresAfterLastFlight,
  flightDay,
  isFutureDate,
  isInternationalTrip,
  isOlderThanMax,
  isRealCalendarDate,
  isValidEcuadorCedula,
  normalizeDocumentNumber,
} from '../../src/lib/passenger-rules';
import { addDaysToDate } from '../../src/lib/dates';

describe('ageAtDate and the bands', () => {
  it('counts whole years and a birthday on the reference day already counts', () => {
    expect(ageAtDate('2024-11-10', '2026-11-09')).toBe(1);
    expect(ageAtDate('2024-11-09', '2026-11-09')).toBe(2);
    expect(ageAtDate('2014-11-10', '2026-11-09')).toBe(11);
    expect(ageAtDate('2014-11-09', '2026-11-09')).toBe(12);
    expect(ageAtDate('2008-11-10', '2026-11-09')).toBe(17);
    expect(ageAtDate('2008-11-09', '2026-11-09')).toBe(18);
  });

  it('maps ages to types at the limits 1/2, 11/12, 17/18 and 120/121', () => {
    expect([0, 1].map(expectedTypeForAge)).toEqual(['INFANT', 'INFANT']);
    expect([2, 11].map(expectedTypeForAge)).toEqual(['CHILD', 'CHILD']);
    expect([12, 17].map(expectedTypeForAge)).toEqual(['YOUTH', 'YOUTH']);
    expect([18, 120].map(expectedTypeForAge)).toEqual(['ADULT', 'ADULT']);
    expect(expectedTypeForAge(121)).toBeUndefined();
    expect(expectedTypeForAge(-1)).toBeUndefined();
  });

  it('writes the range of each type in Spanish', () => {
    expect(ageRangeMessage('CHILD')).toBe('Niño: 2 a 11 años el día del primer vuelo');
    expect(ageRangeMessage('YOUTH')).toBe('Joven: 12 a 17 años el día del primer vuelo');
  });

  it('takes the UTC day of a flight', () => {
    expect(flightDay('2026-12-01T03:00:00.000Z')).toBe('2026-12-01');
    expect(flightDay('2026-12-01T23:30:00-05:00')).toBe('2026-12-02');
  });
});

describe('dates', () => {
  it('accepts only real calendar days', () => {
    expect(isRealCalendarDate('2026-02-28')).toBe(true);
    expect(isRealCalendarDate('2028-02-29')).toBe(true);
    expect(isRealCalendarDate('2026-02-29')).toBe(false);
    expect(isRealCalendarDate('2026-13-01')).toBe(false);
    expect(isRealCalendarDate('26-1-1')).toBe(false);
  });

  it('rejects future birth dates and people over 120', () => {
    expect(isFutureDate('2026-11-10', '2026-11-09')).toBe(true);
    expect(isFutureDate('2026-11-09', '2026-11-09')).toBe(false);
    expect(isOlderThanMax('1905-11-09', '2026-11-09')).toBe(true);
    expect(isOlderThanMax('1905-11-10', '2026-11-09')).toBe(false);
  });

  it('wants a document that expires after the day of the last flight, not on it', () => {
    expect(expiresAfterLastFlight('2026-12-01', '2026-12-01')).toBe(false);
    expect(expiresAfterLastFlight('2026-12-02', '2026-12-01')).toBe(true);
  });
});

describe('birthDateRange', () => {
  const ref = '2026-11-09';
  const today = '2026-11-09';

  it.each(['INFANT', 'CHILD', 'YOUTH', 'ADULT'] as const)('the limits of %s are exactly the ones of its band', (type) => {
    const { min, max } = birthDateRange(type, ref, today);
    expect(expectedTypeForAge(ageAtDate(min, ref))).toBe(type);
    expect(expectedTypeForAge(ageAtDate(max, ref))).toBe(type);
    expect(expectedTypeForAge(ageAtDate(addDaysToDate(min, -1), ref))).not.toBe(type);
    if (type !== 'ADULT') expect(expectedTypeForAge(ageAtDate(addDaysToDate(max, 1), ref))).not.toBe(type);
  });

  it('never allows a future birth, even for an infant on a far flight', () => {
    expect(birthDateRange('INFANT', '2027-06-01', today).max).toBe(today);
  });

  it('handles 29 February', () => {
    const { min, max } = birthDateRange('CHILD', '2028-02-29', '2028-02-29');
    expect(expectedTypeForAge(ageAtDate(min, '2028-02-29'))).toBe('CHILD');
    expect(expectedTypeForAge(ageAtDate(max, '2028-02-29'))).toBe('CHILD');
  });
});

describe('isValidEcuadorCedula', () => {
  it('accepts a real cédula and rejects the usual mistakes', () => {
    expect(isValidEcuadorCedula('1710034065')).toBe(true);
    expect(isValidEcuadorCedula('1710034066')).toBe(false);
    expect(isValidEcuadorCedula('171003406')).toBe(false);
    expect(isValidEcuadorCedula('9910034065')).toBe(false);
    expect(isValidEcuadorCedula('1760034065')).toBe(false);
    expect(isValidEcuadorCedula('17100340AB')).toBe(false);
  });
});

describe('documents and trips', () => {
  it('compares documents without signs or case', () => {
    expect(normalizeDocumentNumber('ab-123')).toBe(normalizeDocumentNumber('AB 123'));
  });

  it('is international when countries differ or an airport is unknown', () => {
    const countries = new Map([
      ['UIO', 'EC'],
      ['GYE', 'EC'],
      ['BOG', 'CO'],
    ]);
    expect(isInternationalTrip([{ origen: 'UIO', destino: 'GYE' }], countries)).toBe(false);
    expect(isInternationalTrip([{ origen: 'UIO', destino: 'BOG' }], countries)).toBe(true);
    expect(isInternationalTrip([{ origen: 'UIO', destino: 'XXX' }], countries)).toBe(true);
    expect(isInternationalTrip([{ origen: 'UIO', destino: 'GYE' }, { origen: 'GYE', destino: 'BOG' }], countries)).toBe(true);
  });
});
