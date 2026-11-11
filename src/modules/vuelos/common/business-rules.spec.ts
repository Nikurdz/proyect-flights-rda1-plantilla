import {
  ageAt,
  assertChronology,
  assertGroupSize,
  assertInfantRatio,
  assertNoDuplicatePassengers,
  assertOriginDestinationDiffer,
  assertPassengerTypeMatchesAge,
  assertValidNationalIds,
  isValidEcuadorCedula,
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

    it('takes "today" per leg: each leg is judged against the date at its own origin', () => {
      // 05:30Z on 11 November: already the 11th in Quito (UTC-5), still the 10th in Galápagos (UTC-6).
      const todayAt = (leg: { origin: string }) => (leg.origin === 'GPS' ? '2026-11-10' : '2026-11-11');
      expect(() => assertChronology([{ origin: 'GPS', destination: 'UIO', departureDate: '2026-11-10' }], todayAt)).not.toThrow();
      expect(() => assertChronology([{ origin: 'UIO', destination: 'GPS', departureDate: '2026-11-10' }], todayAt)).toThrow();
      expect(() =>
        assertChronology(
          [
            { origin: 'GPS', destination: 'UIO', departureDate: '2026-11-10' },
            { origin: 'UIO', destination: 'GPS', departureDate: '2026-11-11' },
          ],
          todayAt,
        ),
      ).not.toThrow();
      // The order between legs is still checked.
      expect(() =>
        assertChronology(
          [
            { origin: 'UIO', destination: 'GPS', departureDate: '2026-11-12' },
            { origin: 'GPS', destination: 'UIO', departureDate: '2026-11-11' },
          ],
          todayAt,
        ),
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

    it('names the field of the request that fails', () => {
      try {
        assertPassengerTypeMatchesAge('ADULT', '2020-01-01', '2027-01-01', { field: 'pasajeros.fechaNacimiento' });
        fail('expected an error');
      } catch (error) {
        expect(JSON.stringify((error as { getResponse: () => unknown }).getResponse())).toContain('pasajeros.fechaNacimiento');
      }
    });

    it('rejects a birth date in the future explicitly', () => {
      expect(() => assertPassengerTypeMatchesAge('INFANT', '2999-01-01', '3000-01-01')).toThrow();
    });

    it('also checks the last flight: an infant who turns 2 before the return is refused', () => {
      // Born 2025-03-01: 1 year old on 2026-11-01, 2 years old on the return of 2027-04-01.
      expect(() => assertPassengerTypeMatchesAge('INFANT', '2025-03-01', '2026-11-01')).not.toThrow();
      expect(() => assertPassengerTypeMatchesAge('INFANT', '2025-03-01', '2026-11-01', { lastFlightDate: '2027-04-01' })).toThrow();
      expect(() => assertPassengerTypeMatchesAge('INFANT', '2025-03-01', '2026-11-01', { lastFlightDate: '2027-02-01' })).not.toThrow();
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
  describe('Ecuadorian cédula', () => {
    it('accepts a cédula with a correct check digit', () => {
      expect(isValidEcuadorCedula('1710034065')).toBe(true);
      expect(isValidEcuadorCedula('0926687856')).toBe(true);
    });

    it('rejects a wrong check digit, a wrong length, letters, a bad province or a bad third digit', () => {
      expect(isValidEcuadorCedula('1710034066')).toBe(false);
      expect(isValidEcuadorCedula('171003406')).toBe(false);
      expect(isValidEcuadorCedula('17100340A5')).toBe(false);
      expect(isValidEcuadorCedula('2510034065')).toBe(false);
      expect(isValidEcuadorCedula('1760034065')).toBe(false);
    });

    it('judges only a NATIONAL_ID of an Ecuadorian passenger', () => {
      expect(() => assertValidNationalIds([{ documentType: 'PASSPORT', documentNumber: 'AB1234', nationality: 'EC' }])).not.toThrow();
      expect(() => assertValidNationalIds([{ documentType: 'NATIONAL_ID', documentNumber: '12345678', nationality: 'CO' }])).not.toThrow();
      expect(() => assertValidNationalIds([{ documentType: 'NATIONAL_ID', documentNumber: '1710034065', nationality: 'EC' }])).not.toThrow();
      expect(() => assertValidNationalIds([{ documentType: 'NATIONAL_ID', documentNumber: '1710034066', nationality: 'EC' }])).toThrow();
    });
  });
});
