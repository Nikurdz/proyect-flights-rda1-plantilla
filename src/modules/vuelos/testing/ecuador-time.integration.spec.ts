import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { seedEcommerce } from '../ecommerce/seed/ecommerce.seed';
import { seedFlights } from '../seed/flights.seed';
import { PartnerAuthService } from '../v2/auth/partner-auth.service';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(240_000);

const dayAhead = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const departures = (offers: unknown): string[] => [...JSON.stringify(offers).matchAll(/"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)"/g)].map((m) => m[1]);

/**
 * BOG -> MAD leaves at 21:00 Bogotá time = 02:00 UTC of the NEXT day. The web (v1) reads a date as an Ecuador calendar day and
 * lists it under the day it leaves in Ecuador; the partner API (v2) keeps UTC days, which Booking's stock and feed rely on.
 */
describeIntegration('Ecuador time: the web searches by Ecuador day, the partner API by UTC day', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  const api = () => request(app.getHttpServer());

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

  it('v1 lists a 21:00 Bogotá flight under its Ecuador day; v2 lists it under the next UTC day', async () => {
    const date = dayAhead(8);
    const v1 = await api().post('/api/v1/search').set('X-Device-Fingerprint', 'it').send({ itineraries: [{ origin: 'BOG', destination: 'MAD', departureDate: date }], passengers: { adults: 1 } }).expect(200);
    expect(v1.body.offers.length).toBeGreaterThan(0);
    const next = new Date(new Date(`${date}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
    expect(departures(v1.body.offers[0])[0].startsWith(`${next}T02:00`)).toBe(true); // Ecuador evening of `date` = 02:00 UTC of the next day

    const token = (await api().post('/api/v2/oauth2/token').type('form').send({ grant_type: 'client_credentials', client_id: 'booking-prototipo', client_secret: 'a-partner-secret-of-24-chars!' }).expect(200)).body.access_token;
    const v2 = await api().post('/api/v2/vuelos/search').set({ Authorization: `Bearer ${token}`, 'X-Device-Fingerprint': 'it' }).send({ itineraries: [{ origin: 'BOG', destination: 'MAD', departureDate: date }], passengers: { adults: 1 } }).expect(200);
    expect(v2.body.offers.length).toBeGreaterThan(0);
    expect(departures(v2.body.offers[0])[0].startsWith(`${date}T02:00`)).toBe(true); // the UTC day `date`: the previous evening's flight
  });

  it('the catalogue (web) also counts the day in Ecuador', async () => {
    const date = dayAhead(9);
    const res = await api().get('/api/v1/disponibilidad').query({ origin: 'BOG', destination: 'MAD', outbound: date, adt: 1 }).expect(200);
    expect(res.body.sinDisponibilidad).toBe(false);
    const next = new Date(new Date(`${date}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
    expect(JSON.stringify(res.body)).toContain(`${next}T02:00`); // the evening flight of the Ecuador day `date`
  });
});
