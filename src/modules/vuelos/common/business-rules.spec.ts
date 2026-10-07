import {
  ageAt,
  assertChronology,
  assertGroupSize,
  assertInfantRatio,
  assertNoDuplicatePassengers,
  assertOriginDestinationDiffer,
  assertPassengerTypeMatchesAge,
} from './business-rules';

describe('business-rules', () => {
  describe('assertOriginDestinationDiffer (RN-01)', () => {
    it('passes when origin and destination differ', () => {
      expect(() =>
        assertOriginDestinationDiffer({ origin: 'BOG', destination: 'SCL', departureDate: '2027-01-01' }),
      ).not.toThrow();
    });

    it('throws when origin equals destination', () => {
      expect(() =>
        assertOriginDestinationDiffer({ origin: 'BOG', destination: 'BOG', departureDate: '2027-01-01' }),
      ).toThrow();
    });
  });

  describe('assertChronology (RN-02)', () => {
    it('passes for a future, ordered round trip', () => {
      expect(() =>
        assertChronology([
          { origin: 'BOG', destination: 'SCL', departureDate: '2027-01-01' },
          { origin: 'SCL', destination: 'BOG', departureDate: '2027-01-10' },
        ]),
      ).not.toThrow();
    });

    it('accepts a flight today (compared as dates, not instants)', () => {
      expect(() =>
        assertChronology([{ origin: 'BOG', destination: 'SCL', departureDate: '2026-10-04' }], '2026-10-04'),
      ).not.toThrow();
    });

    it('throws when a leg departs in the past', () => {
      expect(() =>
        assertChronology([{ origin: 'BOG', destination: 'SCL', departureDate: '2000-01-01' }]),
      ).toThrow();
      expect(() =>
        assertChronology([{ origin: 'BOG', destination: 'SCL', departureDate: '2026-10-03' }], '2026-10-04'),
      ).toThrow();
    });

    it('throws when the return leg is before the outbound leg', () => {
      expect(() =>
        assertChronology([
          { origin: 'BOG', destination: 'SCL', departureDate: '2027-01-10' },
          { origin: 'SCL', destination: 'BOG', departureDate: '2027-01-01' },
        ]),
      ).toThrow();
    });
  });

  describe('assertInfantRatio (RN-04)', () => {
    it('passes when infants do not exceed adults', () => {
      expect(() => assertInfantRatio({ adults: 2, youths: 0, children: 0, infants: 2 })).not.toThrow();
    });

    it('throws when infants exceed adults', () => {
      expect(() => assertInfantRatio({ adults: 1, youths: 0, children: 0, infants: 2 })).toThrow();
    });
  });

  describe('assertGroupSize (RN-05)', () => {
    it('counts every passenger type against the cap', () => {
      expect(() => assertGroupSize({ adults: 4, youths: 2, children: 2, infants: 1 }, 9)).not.toThrow();
      expect(() => assertGroupSize({ adults: 4, youths: 2, children: 2, infants: 2 }, 9)).toThrow();
    });

    it('rejects an empty party', () => {
      expect(() => assertGroupSize({ adults: 0, youths: 0, children: 0, infants: 0 }, 9)).toThrow();
    });
  });

  describe('ageAt', () => {
    it('is independent of the host timezone around a birthday', () => {
      expect(ageAt('2009-01-01', '2027-01-01T00:00:00.000Z')).toBe(18);
      expect(ageAt('2009-01-02', '2027-01-01T00:00:00.000Z')).toBe(17);
    });
  });

  describe('assertPassengerTypeMatchesAge (RN-06)', () => {
    it('passes when the declared type matches the computed age band', () => {
      expect(() => assertPassengerTypeMatchesAge('ADULT', '1990-01-01', '2027-01-01')).not.toThrow();
      expect(() => assertPassengerTypeMatchesAge('INFANT', '2026-06-01', '2027-01-01')).not.toThrow();
    });

    it('throws when a minor is declared as an adult', () => {
      expect(() => assertPassengerTypeMatchesAge('ADULT', '2020-01-01', '2027-01-01')).toThrow();
    });

    it('throws when someone who turns adult before the flight is still declared a child', () => {
      // Born 2009-01-01: turns 18 on 2027-01-01, the flight date itself.
      expect(() => assertPassengerTypeMatchesAge('CHILD', '2009-01-01', '2027-01-01')).toThrow();
    });
  });

  describe('assertNoDuplicatePassengers (RF-068)', () => {
    const base = { passengerId: 'p1', firstName: 'David', lastName: 'Tapia', birthDate: '1995-01-01', documentNumber: 'A123456' };

    it('accepts distinct passengers', () => {
      expect(() =>
        assertNoDuplicatePassengers([base, { ...base, passengerId: 'p2', firstName: 'Ana', documentNumber: 'B654321' }]),
      ).not.toThrow();
    });

    it('treats the same document written with spaces, dashes or other case as one (M9)', () => {
      const second = { ...base, passengerId: 'p2', firstName: 'Ana' };
      expect(() => assertNoDuplicatePassengers([{ ...base, documentNumber: 'AB123' }, { ...second, documentNumber: 'ab 123' }])).toThrow();
      expect(() => assertNoDuplicatePassengers([{ ...base, documentNumber: 'AB123' }, { ...second, documentNumber: 'A-B.123' }])).toThrow();
    });

    it('rejects a repeated document, client id, or person (ignoring accents and case)', () => {
      expect(() => assertNoDuplicatePassengers([base, { ...base, passengerId: 'p2', firstName: 'Ana' }])).toThrow();
      expect(() => assertNoDuplicatePassengers([base, { ...base, documentNumber: 'B654321', firstName: 'Ana' }])).toThrow();
      expect(() =>
        assertNoDuplicatePassengers([
          { ...base, firstName: 'José' },
          { ...base, passengerId: 'p2', firstName: 'JOSE', documentNumber: 'B654321' },
        ]),
      ).toThrow();
    });
  });
});
