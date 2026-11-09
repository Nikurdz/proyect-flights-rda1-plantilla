import { describe, expect, it } from 'vitest';
import { registerTimeZones, timeZoneOf } from '../../src/lib/airports';

describe('airport time zones', () => {
  it('knows the Ecuador airports', () => {
    for (const c of ['LOH', 'MEC', 'ESM', 'TPN', 'JIP']) expect(timeZoneOf(c)).toBe('America/Guayaquil');
    expect(timeZoneOf('GPS')).toBe('Pacific/Galapagos');
    expect(timeZoneOf('scy')).toBe('Pacific/Galapagos');
  });

  it('completes the map from the catalogue, ignoring invalid zones and known entries', () => {
    expect(timeZoneOf('XYZ')).toBe('UTC');
    registerTimeZones([
      { iata: 'XYZ', zonaHoraria: 'Asia/Tokyo' },
      { iata: 'BAD', zonaHoraria: 'Mars/Olympus' },
      { iata: 'UIO', zonaHoraria: 'Asia/Tokyo' },
    ]);
    expect(timeZoneOf('XYZ')).toBe('Asia/Tokyo');
    expect(timeZoneOf('BAD')).toBe('UTC');
    expect(timeZoneOf('UIO')).toBe('America/Guayaquil');
  });
});
