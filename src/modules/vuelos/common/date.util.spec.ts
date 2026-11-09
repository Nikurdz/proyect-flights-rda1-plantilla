import { ecuadorDayRange, formatEcuador, todayEcuador, utcDayRange } from './date.util';

describe('Ecuador time (UTC-5, no daylight saving)', () => {
  it('an Ecuador calendar day starts at 05:00 UTC', () => {
    expect(ecuadorDayRange('2026-11-08')).toEqual({ start: new Date('2026-11-08T05:00:00.000Z'), end: new Date('2026-11-09T05:00:00.000Z') });
    expect(utcDayRange('2026-11-08').start.toISOString()).toBe('2026-11-08T00:00:00.000Z'); // the partner API keeps UTC days
  });

  it('today in Ecuador is still yesterday for the first five hours of the UTC day', () => {
    expect(todayEcuador(new Date('2026-11-09T00:32:00Z'))).toBe('2026-11-08'); // 7:32 PM in Ecuador
    expect(todayEcuador(new Date('2026-11-09T04:59:59Z'))).toBe('2026-11-08');
    expect(todayEcuador(new Date('2026-11-09T05:00:00Z'))).toBe('2026-11-09');
  });

  it('formats an instant for people in Ecuador time', () => {
    expect(formatEcuador('2026-11-09T02:30:00.000Z')).toBe('2026-11-08 21:30 (hora de Ecuador)');
    expect(formatEcuador('2026-11-08T14:00:00Z')).toBe('2026-11-08 09:00 (hora de Ecuador)');
  });
});
