import { describe, it, expect } from 'vitest';
import { timeZoneOf } from '../../src/lib/airports';
import { fareFamilyLabel, formatDateTime, orderStatusLabel, passengerTypeLabel } from '../../src/lib/labels';

describe('labels', () => {
  it('translates order statuses and passenger types, with a neutral fallback', () => {
    expect(orderStatusLabel('EMITIDA')).toBe('Confirmada');
    expect(orderStatusLabel('FALLIDA_COMPENSADA')).toContain('sin cobro');
    expect(orderStatusLabel('NUEVO_ESTADO')).toBe('En proceso');
    expect(passengerTypeLabel('CHILD')).toBe('Niño');
    expect(fareFamilyLabel('FULL')).toBe('Full');
  });
});

describe('airport time zones', () => {
  it('shows every flight time in Ecuador time, whatever the airport', () => {
    // 13:00 UTC is 08:00 in Ecuador (UTC-5, no daylight saving), also for a flight to Madrid or Santiago.
    for (const iata of ['BOG', 'UIO', 'MAD', 'SCL', 'XXX', undefined]) expect(formatDateTime('2026-11-10T13:00:00.000Z', timeZoneOf(iata))).toContain('08:00');
  });

  it('formats an instant in Ecuador time by default', () => {
    expect(formatDateTime('2026-11-10T13:00:00.000Z')).toContain('08:00');
    expect(formatDateTime('2026-11-10T02:30:00.000Z')).toContain('9 nov'); // 9:30 PM of the 9th in Ecuador
  });
});
