import { ECUADOR, NETWORK, isDomestic } from './flights.seed';

describe('the flight network of the seed', () => {
  it('has no flight code twice (the key is code + departure, so a repeat would be ignored silently)', () => {
    const codes = NETWORK.map((e) => e.codigoVuelo);
    expect(codes.filter((c, i) => codes.indexOf(c) !== i)).toEqual([]);
  });

  it('gives every domestic route both directions, in USD fares of the domestic and Galápagos bands', () => {
    const domestic = NETWORK.filter(isDomestic);
    expect(domestic.length).toBeGreaterThan(40);
    const pairs = new Set(domestic.map((e) => `${e.origenIATA}-${e.destinoIATA}`));
    for (const pair of pairs) {
      const [from, to] = pair.split('-');
      expect(pairs.has(`${to}-${from}`)).toBe(true);
    }
    for (const entry of domestic) {
      expect(entry.precioBase).toBeGreaterThanOrEqual(55);
      expect(entry.precioBase).toBeLessThanOrEqual(240);
      expect(entry.durationMinutes).toBeGreaterThan(0);
    }
  });

  it('serves the main domestic cities with several flights a day', () => {
    const perDay = (from: string, to: string) => NETWORK.filter((e) => e.origenIATA === from && e.destinoIATA === to).length;
    expect(perDay('UIO', 'GYE')).toBeGreaterThanOrEqual(8);
    for (const city of ['CUE', 'MEC', 'ESM', 'LGQ', 'OCC', 'SCY']) expect(perDay('UIO', city) + perDay('GYE', city)).toBeGreaterThanOrEqual(1);
    expect(ECUADOR.has('SCY')).toBe(true);
  });

  it('does not treat an international flight as domestic', () => {
    expect(isDomestic({ origenIATA: 'UIO', destinoIATA: 'BOG' })).toBe(false);
    expect(isDomestic({ origenIATA: 'GYE', destinoIATA: 'MIA' })).toBe(false);
  });
});
