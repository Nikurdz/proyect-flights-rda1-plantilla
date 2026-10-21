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
  it('shows flight times in the local time of each airport', () => {
    // 13:00 UTC is 08:00 in Bogotá/Quito (UTC-5) and 14:00 in Madrid winter time... but 15:00 in summer; use fixed dates.
    expect(formatDateTime('2026-11-10T13:00:00.000Z', timeZoneOf('BOG'))).toContain('08:00');
    expect(formatDateTime('2026-11-10T13:00:00.000Z', timeZoneOf('UIO'))).toContain('08:00');
    expect(formatDateTime('2026-11-10T13:00:00.000Z', timeZoneOf('MAD'))).toContain('14:00');
  });

  it('falls back to UTC for an unknown airport', () => {
    expect(timeZoneOf('XXX')).toBe('UTC');
    expect(timeZoneOf(undefined)).toBe('UTC');
  });
});
