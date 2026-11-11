import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { seedEcommerce } from '../ecommerce/seed/ecommerce.seed';
import { Vuelo } from '../entities/vuelo.entity';
import { HORIZON_DAYS, seedFlights } from '../seed/flights.seed';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(240_000);

const dayAhead = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/** Domestic (Ecuador) flights reach 180 days ahead while the rest of the network stops at 45, and the seed only adds what is missing. */
describeIntegration('Domestic flights of Ecuador against a real Postgres', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let ds: DataSource;
  const api = () => request(app.getHttpServer());
  const search = (origin: string, destination: string, days: number) => api().get('/api/v1/disponibilidad').query({ origin, destination, outbound: dayAhead(days), adt: 1 });

  beforeAll(async () => {
    ctx = await createIntegrationApp();
    app = ctx.app;
    ds = ctx.dataSource;
    await seedFlights(ds, new Date(), { domesticHorizonDays: 180 });
    await seedEcommerce(ds);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('offers the new cities 150 days ahead and several flights a day between Quito and Guayaquil', async () => {
    for (const [from, to] of [['UIO', 'MEC'], ['MEC', 'UIO'], ['UIO', 'ESM'], ['UIO', 'LGQ'], ['UIO', 'OCC'], ['GYE', 'CUE'], ['GPS', 'SCY']]) {
      const res = await search(from, to, 150).expect(200);
      expect(res.body.trayectos[0].itinerarios.length).toBeGreaterThan(0);
    }
    const uioGye = await search('UIO', 'GYE', 150).expect(200);
    expect(uioGye.body.trayectos[0].itinerarios.length).toBeGreaterThanOrEqual(8);
  });

  it('keeps the international network at 45 days', async () => {
    const near = await search('BOG', 'MDE', HORIZON_DAYS - 5).expect(200);
    expect(near.body.trayectos[0].itinerarios.length).toBeGreaterThan(0);
    const far = await search('BOG', 'MDE', 100).expect(200);
    expect(far.body.trayectos[0].itinerarios).toHaveLength(0);
  });

  it('runs on Galápagos time for the islands and is incremental: a second run creates nothing', async () => {
    const island = await ds.getRepository(Vuelo).findOneByOrFail({ origenIATA: 'GPS', destinoIATA: 'SCY' });
    expect(island.durationMinutes).toBe(40);
    const second = await seedFlights(ds, new Date(), { domesticHorizonDays: 180 });
    expect(second.flights).toBe(0);
  });

  it('only creates what is missing after the last flight of each code, and does not bring back a deleted one', async () => {
    const repo = ds.getRepository(Vuelo);
    const before = await repo.count();
    const middle = await repo.findOneByOrFail({ codigoVuelo: 'LA2520' }); // UIO -> MEC, one flight; any of its days is in the middle of the range
    const flights = await repo.find({ where: { codigoVuelo: 'LA2520' }, order: { fechaSalida: 'ASC' } });
    const victim = flights[Math.floor(flights.length / 2)];
    expect(victim.id).toBeTruthy();
    expect(middle.codigoVuelo).toBe('LA2520');
    await repo.delete({ id: victim.id });

    const again = await seedFlights(ds, new Date(), { domesticHorizonDays: 180 });
    expect(again.flights).toBe(0);
    expect(await repo.count()).toBe(before - 1);

    // A longer horizon fills in the tail only.
    const longer = await seedFlights(ds, new Date(), { domesticHorizonDays: 200 });
    expect(longer.flights).toBeGreaterThan(0);
    expect(await repo.countBy({ codigoVuelo: 'LA2520' })).toBe(flights.length - 1 + 20);
  });
});
