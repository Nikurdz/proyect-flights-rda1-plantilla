import { describe, expect, it } from 'vitest';
import { airportTimeZoneOf, registerTimeZones, timeZoneOf } from '../../src/lib/airports';

describe('airport time zones', () => {
  it('knows the Ecuador airports', () => {
    for (const c of ['LOH', 'MEC', 'ESM', 'TPN', 'JIP']) expect(airportTimeZoneOf(c)).toBe('America/Guayaquil');
    expect(airportTimeZoneOf('GPS')).toBe('Pacific/Galapagos');
    expect(airportTimeZoneOf('scy')).toBe('Pacific/Galapagos');
  });

  it('completes the map from the catalogue, ignoring invalid zones and known entries', () => {
    expect(airportTimeZoneOf('XYZ')).toBe('UTC');
    registerTimeZones([
      { iata: 'XYZ', zonaHoraria: 'Asia/Tokyo' },
      { iata: 'BAD', zonaHoraria: 'Mars/Olympus' },
      { iata: 'UIO', zonaHoraria: 'Asia/Tokyo' },
    ]);
    expect(airportTimeZoneOf('XYZ')).toBe('Asia/Tokyo');
    expect(airportTimeZoneOf('BAD')).toBe('UTC');
    expect(airportTimeZoneOf('UIO')).toBe('America/Guayaquil');
  });

  it('shows every airport in Ecuador time (the whole system works in Ecuador time)', () => {
    for (const c of ['UIO', 'GPS', 'MAD', 'SCL', 'XYZ', undefined]) expect(timeZoneOf(c)).toBe('America/Guayaquil');
  });
});
