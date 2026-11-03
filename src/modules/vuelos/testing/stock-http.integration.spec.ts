import { randomUUID } from 'node:crypto';
import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { MoreThan } from 'typeorm';
import { TokenService } from '../auth/token.service';
import { Vuelo } from '../entities/vuelo.entity';
import { seedFlights } from '../seed/flights.seed';
import { StockPushService } from '../v2/stock-push.service';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(180_000);

interface Received {
  contentType: string | undefined;
  correlation: string | undefined;
  body: Record<string, unknown>;
}

const waitFor = async (condition: () => boolean, ms = 30_000): Promise<void> => {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > ms) throw new Error('timed out waiting for the stock push');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

describeIntegration('HTTP stock push to Booking (POST /api/v2/inventory/stock)', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let server: http.Server;
  const received: Received[] = [];
  let mode: 'ok' | 'error' = 'ok';
  const refuse = new Set<string>(); // item_id@date that Booking answers success:false for

  const HORIZON_DAYS = 3;
  const api = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${app.get(TokenService).sign({ ownerId: 'owner-stock', kind: 'customer', roles: [] }).accessToken}` });
  const key = (b: Record<string, unknown>) => `${String(b.item_id)}@${String(b.date)}`;

  async function holdOne(date: string, origin = 'BOG', destination = 'SCL') {
    const search = await api().post('/api/v1/search').set('X-Device-Fingerprint', 'it').send({ itineraries: [{ origin, destination, departureDate: date }], passengers: { adults: 1 } }).expect(200);
    const offer = search.body.offers[0];
    await api()
      .post('/api/v1/offers/hold')
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .send({ offerId: offer.offerId, itinerarySelections: offer.itineraries.map((i: { itineraryId: string }) => ({ itineraryId: i.itineraryId, cabinClass: 'ECONOMY', fareBrand: 'LIGHT' })), passengersBreakdown: { adults: 1 } })
      .expect(201);
    const vuelo = await ctx.dataSource.getRepository(Vuelo).findOneByOrFail({ id: offer.itineraries[0].segments[0].segmentId });
    return { vuelo, item: `${vuelo.codigoVuelo}-ECONOMY@${new Date(vuelo.fechaSalida).toISOString().slice(0, 10)}` };
  }

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let data = '';
      req.on('data', (c) => (data += c));
      req.on('end', () => {
        const body = JSON.parse(data || '{}') as Record<string, unknown>;
        received.push({ contentType: req.headers['content-type'], correlation: req.headers['x-correlation-id'] as string | undefined, body });
        res.setHeader('Content-Type', 'application/json');
        if (mode === 'error') {
          res.statusCode = 503;
          res.end(JSON.stringify({ success: false, message: 'down' }));
        } else if (refuse.has(key(body))) {
          res.statusCode = 200;
          res.end(JSON.stringify({ success: false, message: 'item desconocido' }));
        } else {
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true }));
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v2/inventory/stock`;
    ctx = await createIntegrationApp({ BOOKING_STOCK_URL: url, WEBHOOKS_ALLOW_PRIVATE_HOSTS: 'true', NODE_ID: 'NODE_VUE_TEST', STOCK_PUSH_HORIZON_DAYS: String(HORIZON_DAYS) });
    app = ctx.app;
    await seedFlights(ctx.dataSource);
  });

  afterAll(async () => {
    await ctx?.close();
    await new Promise((resolve) => server.close(resolve));
  });

  it('sends every flight within the horizon once, with exactly the five fields Booking asks for', async () => {
    const stock = app.get(StockPushService);
    expect(stock.mode).toBe('http');
    await stock.flush(); // the round at boot ran before the flights were seeded; this is the first full push

    const horizon = Date.now() + HORIZON_DAYS * 86_400_000;
    const expected = (await ctx.dataSource.getRepository(Vuelo).find({ where: { fechaSalida: MoreThan(new Date()) } })).filter((v) => new Date(v.fechaSalida).getTime() <= horizon);
    const items = new Set(received.map((r) => key(r.body)));
    expect(items.size).toBe(expected.length);

    const sample = received[0];
    expect(sample.contentType).toContain('application/json');
    expect(sample.correlation).toBeDefined();
    expect(Object.keys(sample.body).sort()).toEqual(['available_units', 'date', 'item_id', 'service_id', 'time_slot']);
    expect(sample.body.service_id).toBe('NODE_VUE_TEST');
    expect(String(sample.body.item_id)).toMatch(/^[A-Z0-9]+-ECONOMY$/);
    expect(String(sample.body.date)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(String(sample.body.time_slot)).toMatch(/^\d{2}:\d{2}$/);
    expect(typeof sample.body.available_units).toBe('number');
    // Nothing beyond the horizon.
    const lastDay = new Date(horizon).toISOString().slice(0, 10);
    expect(received.every((r) => String(r.body.date) <= lastDay)).toBe(true);
  });

  it('after a hold sends that flight again with its new absolute count, and only that flight', async () => {
    const stock = app.get(StockPushService);
    await stock.flush();
    received.length = 0;
    const day = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    const { vuelo, item } = await holdOne(day);
    await waitFor(() => received.some((r) => key(r.body) === item));
    await stock.flush();
    const hits = received.filter((r) => key(r.body) === item);
    expect(hits[hits.length - 1].body.available_units).toBe(vuelo.asientosDisponibles);
    expect(new Set(received.map((r) => key(r.body)))).toEqual(new Set([item]));
  });

  it('does not count a refused flight as sent and waits before sending it again; a down endpoint stops the round and recovers', async () => {
    const stock = app.get(StockPushService);
    const day = new Date(Date.now() + 1 * 86_400_000).toISOString().slice(0, 10);

    // Refused (success:false): logged, not marked as sent, not retried at the next round.
    const first = await holdOne(day, 'UIO', 'GYE');
    refuse.add(first.item);
    await waitFor(() => received.some((r) => key(r.body) === first.item));
    await stock.flush();
    const refusedBefore = stock.counters.refused;
    expect(refusedBefore).toBeGreaterThan(0);
    received.length = 0;
    await holdOne(day, 'UIO', 'GYE'); // the same flight moves again
    await stock.flush();
    expect(received.filter((r) => key(r.body) === first.item)).toHaveLength(0);
    refuse.clear();

    // Down (503): the round fails and the change is sent once Booking is back.
    mode = 'error';
    const failuresBefore = stock.counters.failures;
    const second = await holdOne(day, 'BOG', 'MDE');
    await waitFor(() => stock.counters.failures > failuresBefore);
    mode = 'ok';
    received.length = 0;
    await stock.flush();
    await waitFor(() => received.some((r) => key(r.body) === second.item));
    const vuelo = await ctx.dataSource.getRepository(Vuelo).findOneByOrFail({ id: second.vuelo.id });
    expect(received.filter((r) => key(r.body) === second.item).pop()!.body.available_units).toBe(vuelo.asientosDisponibles);
  });
});
