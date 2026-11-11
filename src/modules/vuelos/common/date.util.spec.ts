import { dayInZone, ecuadorDayRange, formatEcuador, todayEcuador, todayInZone, utcDayRange, zonedDayRange } from './date.util';

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

describe('calendar days of an airport zone (IANA)', () => {
  it('a day of mainland Ecuador starts at 05:00 UTC, a day of Galápagos at 06:00 UTC', () => {
    expect(zonedDayRange('2026-11-10', 'America/Guayaquil')).toEqual({ start: new Date('2026-11-10T05:00:00.000Z'), end: new Date('2026-11-11T05:00:00.000Z') });
    expect(zonedDayRange('2026-11-10', 'Pacific/Galapagos')).toEqual({ start: new Date('2026-11-10T06:00:00.000Z'), end: new Date('2026-11-11T06:00:00.000Z') });
    expect(zonedDayRange('2026-11-10', 'America/Guayaquil')).toEqual(ecuadorDayRange('2026-11-10')); // same day the web uses
    expect(zonedDayRange('2026-11-10', 'UTC')).toEqual(utcDayRange('2026-11-10'));
  });

  it('crosses a month and a year end', () => {
    expect(zonedDayRange('2026-12-31', 'America/Guayaquil')).toEqual({ start: new Date('2026-12-31T05:00:00.000Z'), end: new Date('2027-01-01T05:00:00.000Z') });
  });

  it('follows daylight saving where the zone has it (a 23-hour and a 25-hour day)', () => {
    expect(zonedDayRange('2026-03-29', 'Europe/Madrid')).toEqual({ start: new Date('2026-03-28T23:00:00.000Z'), end: new Date('2026-03-29T22:00:00.000Z') });
    expect(zonedDayRange('2026-10-25', 'Europe/Madrid')).toEqual({ start: new Date('2026-10-24T22:00:00.000Z'), end: new Date('2026-10-25T23:00:00.000Z') });
  });

  it('today in the zone changes at its own midnight: 05:00Z in Guayaquil, 06:00Z in Galápagos', () => {
    expect(todayInZone('America/Guayaquil', new Date('2026-11-11T00:30:00Z'))).toBe('2026-11-10'); // 19:30 in Ecuador: the UTC date is already the 11th
    expect(todayInZone('America/Guayaquil', new Date('2026-11-11T04:59:59Z'))).toBe('2026-11-10');
    expect(todayInZone('America/Guayaquil', new Date('2026-11-11T05:00:00Z'))).toBe('2026-11-11');
    expect(todayInZone('Pacific/Galapagos', new Date('2026-11-11T05:00:00Z'))).toBe('2026-11-10'); // 23:00 in Galápagos
    expect(todayInZone('Pacific/Galapagos', new Date('2026-11-11T05:59:59Z'))).toBe('2026-11-10');
    expect(todayInZone('Pacific/Galapagos', new Date('2026-11-11T06:00:00Z'))).toBe('2026-11-11');
  });

  it('gives the local date of an instant (a 23:06 Ecuador departure belongs to that Ecuador day)', () => {
    expect(dayInZone('2026-11-11T04:06:00.000Z', 'America/Guayaquil')).toBe('2026-11-10');
    expect(dayInZone(new Date('2026-11-11T04:06:00.000Z'), 'UTC')).toBe('2026-11-11');
    expect(dayInZone('2026-11-11T00:00:00.000Z', 'America/Guayaquil')).toBe('2026-11-10'); // local midnight renders as hour 0, not 24
    expect(dayInZone('2026-11-10T05:00:00.000Z', 'America/Guayaquil')).toBe('2026-11-10');
  });

  it('an unknown zone is an error, never a silent UTC', () => {
    expect(() => zonedDayRange('2026-11-10', 'Not/AZone')).toThrow(RangeError);
  });
});
