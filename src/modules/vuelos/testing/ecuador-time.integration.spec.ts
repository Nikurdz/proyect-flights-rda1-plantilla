import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { dayInZone } from '../common/date.util';
import { seedEcommerce } from '../ecommerce/seed/ecommerce.seed';
import { Vuelo } from '../entities/vuelo.entity';
import { seedFlights } from '../seed/flights.seed';
import { PartnerAuthService } from '../v2/auth/partner-auth.service';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(240_000);

const DAY_MS = 86_400_000;
const dayAhead = (days: number): string => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
const dayAfter = (date: string): string => new Date(new Date(`${date}T00:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10);
/** Every instant of an answer as UTC ISO (v1 writes `…Z`, v2 writes the real offset: the instant is what is compared). */
const departures = (offers: unknown): string[] => [...JSON.stringify(offers).matchAll(/"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))"/g)].map((m) => new Date(m[1]).toISOString());

/** The next instant, strictly after now, at which the UTC clock reads `hh:mm`. */
const nextUtc = (hh: number, mm: number): Date => {
  const at = new Date();
  at.setUTCHours(hh, mm, 0, 0);
  return at.getTime() > Date.now() ? at : new Date(at.getTime() + DAY_MS);
};

/** Runs `fn` with `Date` frozen at `now`; every real timer keeps working, so HTTP and the database are untouched. */
async function withClock<T>(now: Date, fn: () => Promise<T>): Promise<T> {
  jest.useFakeTimers({
    now,
    doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
  });
  try {
    return await fn();
  } finally {
    jest.useRealTimers();
  }
}

/**
 * BOG -> MAD leaves at 21:00 Bogotá time = 02:00 UTC of the NEXT day. The web (v1) reads a date as an Ecuador calendar day; the
 * partner API (v2) reads it as a calendar day of the ORIGIN airport (its zone in the catalogue), so both list that flight under
 * the day it leaves locally. Instants in the answers stay in UTC.
 */
describeIntegration('Local days: the web searches by Ecuador day, the partner API by the day of the origin airport', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  const api = () => request(app.getHttpServer());
  const searchV2 = (origin: string, destination: string, departureDate: string) =>
    api().post('/api/v2/vuelos/search').set('X-Device-Fingerprint', 'it').send({ itineraries: [{ origin, destination, departureDate }], passengers: { adults: 1 } });
  const addFlight = (codigoVuelo: string, origenIATA: string, destinoIATA: string, fechaSalida: Date) =>
    ctx.dataSource.getRepository(Vuelo).save(
      ctx.dataSource.getRepository(Vuelo).create({ codigoAerolinea: 'LA', codigoVuelo, origenIATA, destinoIATA, fechaSalida, fechaLlegada: new Date(fechaSalida.getTime() + 3_600_000), precioBase: 80, asientosDisponibles: 50, capacidadTotal: 180, durationMinutes: 60 }),
    );

  beforeAll(async () => {
    ctx = await createIntegrationApp();
    app = ctx.app;
    await seedFlights(ctx.dataSource);
    await seedEcommerce(ctx.dataSource); // the market `ec` the catalogue sells in
    await app.get(PartnerAuthService).upsert('booking-prototipo', 'a-partner-secret-of-24-chars!');
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('v1 lists a 21:00 Bogotá flight under its Ecuador day; v2 lists it under its day at the origin (the same one)', async () => {
    const date = dayAhead(8);
    const v1 = await api().post('/api/v1/search').set('X-Device-Fingerprint', 'it').send({ itineraries: [{ origin: 'BOG', destination: 'MAD', departureDate: date }], passengers: { adults: 1 } }).expect(200);
    expect(v1.body.offers.length).toBeGreaterThan(0);
    const next = dayAfter(date);
    expect(departures(v1.body.offers[0])[0].startsWith(`${next}T02:00`)).toBe(true); // Ecuador evening of `date` = 02:00 UTC of the next day

    const token = (await api().post('/api/v2/oauth2/token').type('form').send({ grant_type: 'client_credentials', client_id: 'booking-prototipo', client_secret: 'a-partner-secret-of-24-chars!' }).expect(200)).body.access_token;
    const v2 = await searchV2('BOG', 'MAD', date).set({ Authorization: `Bearer ${token}` }).expect(200);
    expect(v2.body.offers.length).toBeGreaterThan(0);
    expect(departures(v2.body.offers[0])[0].startsWith(`${next}T02:00`)).toBe(true); // the evening flight of the local day `date`, no longer the previous evening's
    expect(departures(v2.body.offers).some((at) => at.startsWith(`${date}T02:00`))).toBe(false);
  });

  it('the catalogue (web) also counts the day in Ecuador', async () => {
    const date = dayAhead(9);
    const res = await api().get('/api/v1/disponibilidad').query({ origin: 'BOG', destination: 'MAD', outbound: date, adt: 1 }).expect(200);
    expect(res.body.sinDisponibilidad).toBe(false);
    const next = dayAfter(date);
    expect(JSON.stringify(res.body)).toContain(`${next}T02:00`); // the evening flight of the Ecuador day `date`
  });

  it('v2 at 19:30 in Ecuador: "today" is still bookable (200, not 400) and lists the 23:06 flight of tonight', async () => {
    const now = nextUtc(0, 30); // 19:30 in Ecuador; the UTC date is already tomorrow
    const today = dayInZone(now, 'America/Guayaquil');
    expect(today).not.toBe(now.toISOString().slice(0, 10));
    const tonight = await addFlight('LA9906', 'UIO', 'GYE', new Date(now.getTime() + (3 * 60 + 36) * 60_000)); // 23:06 in Ecuador = 04:06 UTC

    await withClock(now, async () => {
      const res = await searchV2('UIO', 'GYE', today).expect(200);
      expect(departures(res.body.offers)).toContain(tonight.fechaSalida.toISOString());

      // The UTC date (tomorrow in Ecuador) no longer shows tonight's flight, and yesterday is the past.
      const tomorrow = await searchV2('UIO', 'GYE', dayAfter(today)).expect(200);
      expect(departures(tomorrow.body.offers)).not.toContain(tonight.fechaSalida.toISOString());
      const yesterday = await searchV2('UIO', 'GYE', new Date(new Date(`${today}T00:00:00Z`).getTime() - DAY_MS).toISOString().slice(0, 10)).expect(400);
      expect(yesterday.body.detail).toContain('is before the current date');
    });
  });

  it('v2 from Galápagos (UTC-6): the day runs 06:00Z-06:00Z and "today" lasts one hour longer than on the mainland', async () => {
    const date = dayAhead(12);
    const lateNight = await addFlight('LA9930', 'GPS', 'SCY', new Date(`${dayAfter(date)}T05:30:00.000Z`)); // 23:30 in Galápagos on `date` (00:30 of the next day in Quito)

    const sameDay = await searchV2('GPS', 'SCY', date).expect(200);
    expect(departures(sameDay.body.offers)).toContain(lateNight.fechaSalida.toISOString());
    const nextDay = await searchV2('GPS', 'SCY', dayAfter(date)).expect(200);
    expect(departures(nextDay.body.offers)).not.toContain(lateNight.fechaSalida.toISOString());

    // 05:30Z: already the next day in Quito, still the previous one in Galápagos.
    const now = nextUtc(5, 30);
    const todayIslands = dayInZone(now, 'Pacific/Galapagos');
    expect(dayInZone(now, 'America/Guayaquil')).toBe(dayAfter(todayIslands));
    await withClock(now, async () => {
      await searchV2('GPS', 'SCY', todayIslands).expect(200);
      await searchV2('UIO', 'GYE', todayIslands).expect(400);
    });
  });
});
