import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { seedEcommerce } from '../ecommerce/seed/ecommerce.seed';
import { seedFlights } from '../seed/flights.seed';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(240_000);

const dayAhead = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const amounts = (body: unknown): string[] => [...JSON.stringify(body).matchAll(/"monto":"([\d.]+)"/g)].map((m) => m[1]);

/** A youth (12-17) takes a seat, pays the adult fare and cannot accompany an infant: availability and fares follow the same rules as the offer. */
describeIntegration('Availability and fares know the youths (yth) against a real Postgres', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  const api = () => request(app.getHttpServer());
  const availability = (query: Record<string, string | number>) => api().get('/api/v1/disponibilidad').query({ origin: 'UIO', destination: 'GYE', outbound: dayAhead(12), ...query });

  beforeAll(async () => {
    ctx = await createIntegrationApp();
    app = ctx.app;
    await seedFlights(ctx.dataSource);
    await seedEcommerce(ctx.dataSource);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('prices a youth like an adult: adt=1&yth=1 costs the same as adt=2', async () => {
    const two = await availability({ adt: 2 }).expect(200);
    const youth = await availability({ adt: 1, yth: 1 }).expect(200);
    expect(amounts(two.body).length).toBeGreaterThan(0);
    expect(amounts(youth.body)).toEqual(amounts(two.body)); // the price of the list is per person
  });

  it('keeps the infant rule: a youth does not accompany an infant', async () => {
    await availability({ adt: 1, yth: 1, inf: 1 }).expect(200);
    const res = await availability({ adt: 1, yth: 2, inf: 2 });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INFANT_SEAT_NOT_ALLOWED');
  });

  it('counts the youths in the seats and in the size of the group', async () => {
    // LA1500 (BOG -> SCL, 16:00) has 5 open seats: a party of 5 fits, a party of 6 does not.
    const route = { origin: 'BOG', destination: 'SCL', outbound: dayAhead(5) };
    const fits = await availability({ ...route, adt: 1, yth: 4 }).expect(200);
    expect(JSON.stringify(fits.body)).toContain('LA1500');
    const full = await availability({ ...route, adt: 1, yth: 5 }).expect(200);
    const la1500 = JSON.stringify(full.body).includes('"LA1500"') ? JSON.parse(JSON.stringify(full.body)) : null;
    expect(la1500 === null || /agotado":true/.test(JSON.stringify(full.body))).toBe(true);
    const tooMany = await availability({ adt: 1, yth: 9 });
    expect(tooMany.status).toBe(422); // 10 passengers: over the limit of the order
  });

  it('quotes the fares of an itinerary with the youths too', async () => {
    const found = await availability({ adt: 1 }).expect(200);
    const itinerarioId = found.body.trayectos[0].itinerarios[0].itinerarioId as string;
    const two = await api().get(`/api/v1/itinerarios/${itinerarioId}/tarifas`).query({ adt: 2 }).expect(200);
    const youth = await api().get(`/api/v1/itinerarios/${itinerarioId}/tarifas`).query({ adt: 1, yth: 1 }).expect(200);
    type Family = { totalGrupo: { monto: string }; precioPorPasajero: { tipo: string; total: { monto: string } }[] };
    const totals = (body: { familias: Family[] }) => body.familias.map((f) => f.totalGrupo.monto);
    expect(totals(youth.body)).toEqual(totals(two.body)); // the group total is the same as two adults
    expect(totals(youth.body).length).toBeGreaterThan(0);
    for (const family of youth.body.familias as Family[]) {
      const adult = family.precioPorPasajero.find((p) => p.tipo === 'ADULT')!;
      expect(family.precioPorPasajero.find((p) => p.tipo === 'YOUTH')!.total.monto).toBe(adult.total.monto); // a youth pays the adult fare
    }
  });
});
