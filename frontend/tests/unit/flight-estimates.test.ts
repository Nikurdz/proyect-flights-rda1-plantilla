import { describe, expect, it } from 'vitest';
import {
  AIRPORT_COORDS,
  estimateDurationMinutes,
  estimatePriceUsd,
  formatDuration,
  haversineKm,
  suggestDuration,
  suggestPrice,
} from '../../src/lib/flight-estimates';

describe('flight-estimates', () => {
  it('computes the distance between airports', () => {
    expect(haversineKm(AIRPORT_COORDS.UIO, AIRPORT_COORDS.UIO)).toBe(0);
    const uioGye = haversineKm(AIRPORT_COORDS.UIO, AIRPORT_COORDS.GYE);
    expect(uioGye).toBeGreaterThan(250);
    expect(uioGye).toBeLessThan(290);
  });

  it('estimates the duration by distance, rounded to 5 minutes', () => {
    const short = estimateDurationMinutes('UIO', 'GYE') as number;
    expect(short).toBeGreaterThanOrEqual(50);
    expect(short).toBeLessThanOrEqual(70);
    expect(short % 5).toBe(0);
    const long = estimateDurationMinutes('uio', 'MAD') as number;
    expect(long).toBeGreaterThanOrEqual(600);
    expect(long).toBeLessThanOrEqual(720);
  });

  it('returns null for an unknown airport or the same airport', () => {
    expect(estimateDurationMinutes('UIO', 'XXX')).toBeNull();
    expect(estimatePriceUsd('XXX', 'UIO')).toBeNull();
    expect(estimateDurationMinutes('UIO', 'UIO')).toBeNull();
    expect(suggestDuration('UIO', 'XXX')).toBeNull();
    expect(suggestPrice('UIO', 'XXX')).toBeNull();
  });

  it('prices by distance with a floor, calibrated against the seed', () => {
    expect(estimatePriceUsd('UIO', 'GYE')).toBe(55);
    const mad = estimatePriceUsd('UIO', 'MAD') as number;
    expect(mad).toBeGreaterThan(650);
    expect(mad).toBeLessThan(900);
  });

  it('prefers the flights of the same route and gives their range', () => {
    const existing = [
      { origen: 'UIO', destino: 'GYE', duracionMinutos: 50, precioBaseUsd: 74 },
      { origen: 'UIO', destino: 'GYE', duracionMinutos: 55, precioBaseUsd: 78 },
      { origen: 'UIO', destino: 'GYE', duracionMinutos: 50, precioBaseUsd: 90 },
      { origen: 'GYE', destino: 'UIO', duracionMinutos: 99, precioBaseUsd: 999 },
    ];
    expect(suggestPrice('UIO', 'GYE', existing)).toEqual({ amount: 78, range: { min: 74, max: 90 }, source: 'ruta' });
    expect(suggestDuration('UIO', 'GYE', existing)).toEqual({ minutes: 50, source: 'ruta' });
    expect(suggestPrice('UIO', 'GYE', [])?.source).toBe('distancia');
  });

  it('formats durations', () => {
    expect(formatDuration(110)).toBe('1 h 50 min');
    expect(formatDuration(120)).toBe('2 h');
    expect(formatDuration(45)).toBe('45 min');
  });
});
