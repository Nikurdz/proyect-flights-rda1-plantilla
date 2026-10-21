import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatTimeInTimeZone,
  getValidSearchDateString,
  getTomorrowDateString,
  addDaysToDate,
} from '../../src/lib/dates';

describe('dates utilities', () => {
  it('formats duration in minutes accurately', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(135)).toBe('2 h 15 min');
    expect(formatDuration(0)).toBe('0 min');
  });

  it('formats UTC ISO time according to airport timezone', () => {
    // 2026-10-15T15:30:00.000Z in America/Bogota (UTC-5) is 10:30
    const formattedBogota = formatTimeInTimeZone('2026-10-15T15:30:00.000Z', 'America/Bogota');
    expect(formattedBogota).toBe('10:30');

    // 2026-10-15T15:30:00.000Z in UTC is 15:30
    const formattedUtc = formatTimeInTimeZone('2026-10-15T15:30:00.000Z', 'UTC');
    expect(formattedUtc).toBe('15:30');
  });

  it('calculates UTC-aligned valid dates and additions correctly', () => {
    const validToday = getValidSearchDateString();
    expect(validToday).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const tomorrow = getTomorrowDateString();
    expect(tomorrow).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(tomorrow > validToday).toBe(true);

    const plusFive = addDaysToDate('2026-10-05', 5);
    expect(plusFive).toBe('2026-10-10');

    // Month boundary addition
    const monthBoundary = addDaysToDate('2026-10-30', 3);
    expect(monthBoundary).toBe('2026-11-02');
  });
});
