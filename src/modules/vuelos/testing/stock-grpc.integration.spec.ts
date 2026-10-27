import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import request = require('supertest');
import { TokenService } from '../auth/token.service';
import { seedFlights } from '../seed/flights.seed';
import { StockPushService } from '../v2/stock-push.service';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(180_000);

interface Received {
  updates: { service_id: string; item_id: string; date: string; time_slot: string; available_units: number; correlation: string }[];
  changes: { service_id: string; item_id: string; delta: number; correlation: string }[];
}

const waitFor = async (condition: () => boolean, ms = 8000): Promise<void> => {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > ms) throw new Error('timed out waiting for the gRPC push');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

describeIntegration('gRPC stock push to Booking (contract v2, section 9)', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let server: grpc.Server;
  const received: Received = { updates: [], changes: [] };

  beforeAll(async () => {
    const definition = protoLoader.loadSync(join(__dirname, '..', '..', '..', 'proto', 'inventory.proto'), { keepCase: true, longs: Number, defaults: true });
    const proto = grpc.loadPackageDefinition(definition) as unknown as { inventory: { InventoryStockService: { service: grpc.ServiceDefinition } } };
    server = new grpc.Server();
    server.addService(proto.inventory.InventoryStockService.service, {
      PushStockUpdate: (call: grpc.ServerUnaryCall<Received['updates'][number], unknown>, callback: grpc.sendUnaryData<unknown>) => {
        received.updates.push({ ...call.request, correlation: String(call.metadata.get('x-correlation-id')[0]) });
        callback(null, { success: true, message: 'ok', processed_at: Date.now() });
      },
      StreamInventoryChanges: (call: grpc.ServerReadableStream<Received['changes'][number], unknown>, callback: grpc.sendUnaryData<unknown>) => {
        let total = 0;
        const correlation = String(call.metadata.get('x-correlation-id')[0]);
        call.on('data', (change: Received['changes'][number]) => {
          received.changes.push({ ...change, correlation });
          total += 1;
        });
        call.on('end', () => callback(null, { total_events_processed: total, is_synchronized: true, last_sync_hash: 'test' }));
      },
    });
    const port = await new Promise<number>((resolve, reject) => server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (error, bound) => (error ? reject(error) : resolve(bound))));

    ctx = await createIntegrationApp({ GRPC_STOCK_URL: `127.0.0.1:${port}`, NODE_ID: 'NODE_VUE_TEST' });
    app = ctx.app;
    await seedFlights(ctx.dataSource);
  });

  afterAll(async () => {
    await ctx?.close();
    await new Promise<void>((resolve) => server.tryShutdown(() => resolve()));
  });

  it('sends the absolute stock first and then one delta per hold and per release, with the correlation id in the metadata', async () => {
    const stock = app.get(StockPushService);
    expect(stock.enabled).toBe(true);
    await stock.sync();
    // the sync at boot ran before the flights were seeded; this one is the first full push
    await waitFor(() => received.updates.length > 0);
    const first = received.updates.find((u) => u.item_id.endsWith('-ECONOMY'))!;
    expect(first).toMatchObject({ service_id: 'NODE_VUE_TEST' });
    expect(first.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(first.time_slot).toMatch(/^\d{2}:\d{2}$/);
    expect(first.available_units).toBeGreaterThan(0);

    const tokens = app.get(TokenService);
    const auth = { Authorization: `Bearer ${tokens.sign({ ownerId: 'owner-grpc', kind: 'customer', roles: [] }).accessToken}` };
    const day = new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10);
    const search = await request(app.getHttpServer()).post('/api/v1/search').set('X-Device-Fingerprint', 'it').send({ itineraries: [{ origin: 'BOG', destination: 'SCL', departureDate: day }], passengers: { adults: 1 } }).expect(200);
    const offer = search.body.offers[0];
    const correlation = 'corr-grpc-hold-1';
    const hold = await request(app.getHttpServer())
      .post('/api/v1/offers/hold')
      .set(auth)
      .set('X-Correlation-Id', correlation)
      .set('Idempotency-Key', randomUUID())
      .send({ offerId: offer.offerId, itinerarySelections: offer.itineraries.map((i: { itineraryId: string }) => ({ itineraryId: i.itineraryId, cabinClass: 'ECONOMY', fareBrand: 'LIGHT' })), passengersBreakdown: { adults: 2 } })
      .expect(201);

    await waitFor(() => received.changes.length >= 1);
    expect(received.changes[received.changes.length - 1]).toMatchObject({ delta: -2, correlation });

    await request(app.getHttpServer()).delete(`/api/v1/offers/hold/${hold.body.holdId}`).set(auth).expect(204);
    await waitFor(() => received.changes.length >= 2);
    expect(received.changes[received.changes.length - 1]).toMatchObject({ delta: 2 });
    expect(received.changes[0].item_id).toBe(received.changes[1].item_id);
  });
});
