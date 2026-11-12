import { toZonedIso } from './date.util';
import { toZonedBody, toZonedBodySync } from './zoned-time';

describe('toZonedIso', () => {
  it('writes the real offset and keeps the instant', () => {
    const instant = '2026-11-12T13:30:15.123Z';
    expect(toZonedIso(instant, 'America/Guayaquil')).toBe('2026-11-12T08:30:15.123-05:00');
    expect(toZonedIso(new Date(instant), 'Pacific/Galapagos')).toBe('2026-11-12T07:30:15.123-06:00');
    for (const zone of ['America/Guayaquil', 'Pacific/Galapagos', 'Europe/Madrid', 'America/Santiago']) {
      expect(new Date(toZonedIso(instant, zone)).toISOString()).toBe(instant);
    }
  });

  it('uses the offset of that date in zones with daylight saving', () => {
    expect(toZonedIso('2026-01-15T12:00:00.000Z', 'Europe/Madrid')).toBe('2026-01-15T13:00:00.000+01:00');
    expect(toZonedIso('2026-07-15T12:00:00.000Z', 'Europe/Madrid')).toBe('2026-07-15T14:00:00.000+02:00');
    expect(toZonedIso('2026-01-15T12:00:00.000Z', 'America/Santiago')).toBe('2026-01-15T09:00:00.000-03:00'); // southern summer
    expect(toZonedIso('2026-07-15T12:00:00.000Z', 'America/Santiago')).toBe('2026-07-15T08:00:00.000-04:00');
  });

  it('crosses the day when the local time is on the other side of midnight', () => {
    expect(toZonedIso('2026-11-13T04:06:00.000Z', 'America/Guayaquil')).toBe('2026-11-12T23:06:00.000-05:00');
    expect(toZonedIso('2026-11-12T23:30:00.000Z', 'Europe/Madrid')).toBe('2026-11-13T00:30:00.000+01:00');
    expect(toZonedIso('2026-11-12T00:00:00.000Z', 'America/Guayaquil')).toBe('2026-11-11T19:00:00.000-05:00');
  });

  it('keeps the milliseconds and rejects an invalid instant', () => {
    expect(toZonedIso('2026-11-12T13:30:15.007Z', 'America/Guayaquil')).toBe('2026-11-12T08:30:15.007-05:00');
    expect(toZonedIso('2026-11-12T13:30:15.000Z', 'America/Guayaquil')).toBe('2026-11-12T08:30:15.000-05:00');
    expect(() => toZonedIso('nope', 'America/Guayaquil')).toThrow(RangeError);
  });
});

describe('toZonedBodySync', () => {
  const zones: Record<string, string> = { UIO: 'America/Guayaquil', SCY: 'Pacific/Galapagos', MAD: 'Europe/Madrid' };
  const zoneOf = (iata: string) => zones[iata] ?? 'America/Guayaquil';

  it('converts instants and leaves dates, times, ids and text alone', () => {
    const body = {
      id: '2026-11-12T13:30:00.000Z-not-an-instant',
      date: '2026-11-12',
      timeSlot: '13:30',
      detail: 'expired at 2026-11-12T13:30:00.000Z',
      expiresAt: '2026-11-12T13:30:00.000Z',
      already: '2026-11-12T08:30:00.000-05:00',
      list: [{ createdAt: '2026-11-12T13:30:00.000Z' }],
      count: 3,
      nothing: null,
    };
    expect(toZonedBodySync(body, zoneOf)).toEqual({ ...body, expiresAt: '2026-11-12T08:30:00.000-05:00', list: [{ createdAt: '2026-11-12T08:30:00.000-05:00' }] });
  });

  it('writes departure in the origin zone and arrival in the destination zone', () => {
    const segment = {
      departure: { iataCode: 'UIO', at: '2026-11-12T12:00:00.000Z' },
      arrival: { iataCode: 'SCY', at: '2026-11-12T15:20:00.000Z', estimatedAt: '2026-11-12T15:40:00.000Z' },
    };
    expect(toZonedBodySync(segment, zoneOf)).toEqual({
      departure: { iataCode: 'UIO', at: '2026-11-12T07:00:00.000-05:00' },
      arrival: { iataCode: 'SCY', at: '2026-11-12T09:20:00.000-06:00', estimatedAt: '2026-11-12T09:40:00.000-06:00' },
    });
    const ticketSegment = { departureIataCode: 'SCY', arrivalIataCode: 'MAD', departureAt: '2026-01-15T12:00:00.000Z', arrivalAt: '2026-01-15T22:00:00.000Z', issuedAt: '2026-01-15T12:00:00.000Z' };
    expect(toZonedBodySync(ticketSegment, zoneOf)).toMatchObject({ departureAt: '2026-01-15T06:00:00.000-06:00', arrivalAt: '2026-01-15T23:00:00.000+01:00', issuedAt: '2026-01-15T07:00:00.000-05:00' });
    expect(toZonedBodySync({ origin: 'MAD', departureAt: '2026-07-15T12:00:00.000Z', nextHoldExpiryAt: '2026-07-15T12:00:00.000Z' }, zoneOf)).toEqual({ origin: 'MAD', departureAt: '2026-07-15T14:00:00.000+02:00', nextHoldExpiryAt: '2026-07-15T07:00:00.000-05:00' });
  });

  it('an unknown airport falls back to America/Guayaquil', async () => {
    const zonesStub = { zoneOf: async (iata?: string) => (iata === 'SCY' ? 'Pacific/Galapagos' : 'America/Guayaquil') };
    const out = await toZonedBody({ departure: { iataCode: 'XXX', at: '2026-11-12T12:00:00.000Z' }, arrival: { iataCode: 'SCY', at: '2026-11-12T12:00:00.000Z' } }, zonesStub);
    expect(out.departure.at).toBe('2026-11-12T07:00:00.000-05:00');
    expect(out.arrival.at).toBe('2026-11-12T06:00:00.000-06:00');
  });

  it('does not modify its input', () => {
    const body = { expiresAt: '2026-11-12T13:30:00.000Z' };
    toZonedBodySync(body);
    expect(body.expiresAt).toBe('2026-11-12T13:30:00.000Z');
  });
});
