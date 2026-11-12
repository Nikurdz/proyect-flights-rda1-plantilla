import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { Ticket } from '../entities/ticket.entity';
import { seedFlights } from '../seed/flights.seed';
import { PartnerAuthService } from '../v2/auth/partner-auth.service';
import { HealthV2Service } from '../v2/health-v2.service';
import { ContractV2Validator } from './contract-v2-validator';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(180_000);

const V2 = '/api/v2/vuelos';
const dayAhead = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const CLIENT = 'booking-prototipo';
const SECRET = 'a-partner-secret-of-24-chars!';

type Seat = { seatNumber: string; status: string; isAvailable: boolean; characteristics: string[] };
const seatsOf = (body: { cabins: { rows: { seats: Seat[] }[] }[] }): Seat[] => body.cabins[0].rows.flatMap((r) => r.seats);

/** Counts every statement that reaches the database (TypeORM logs each one) while `work` runs. */
async function countQueries<T>(ds: DataSource, work: () => Promise<T>): Promise<{ result: T; queries: string[] }> {
  const queries: string[] = [];
  const target = ds as unknown as { logger: unknown };
  const original = target.logger;
  target.logger = { logQuery: (q: string) => queries.push(q), logQueryError: () => undefined, logQuerySlow: () => undefined, logSchemaBuild: () => undefined, logMigration: () => undefined, log: () => undefined };
  try {
    return { result: await work(), queries };
  } finally {
    target.logger = original;
  }
}

describeIntegration('Rendimiento v2: pocas consultas, salud en memoria y feed de eventos en una consulta', () => {
  let ctx: IntegrationApp;
  let contract: ContractV2Validator;
  let app: INestApplication;
  let ds: DataSource;
  let day = 3;

  const api = () => request(app.getHttpServer());
  const bearer = (token: string, userId?: string) => ({ Authorization: `Bearer ${token}`, ...(userId ? { 'X-User-Id': userId } : {}) });
  async function tokenFor(): Promise<string> {
    const res = await api().post('/api/v2/oauth2/token').type('form').send({ grant_type: 'client_credentials', client_id: CLIENT, client_secret: SECRET }).expect(200);
    return res.body.access_token as string;
  }
  const searchBody = (date: string) => ({ itineraries: [{ origin: 'BOG', destination: 'SCL', departureDate: date }], passengers: { adults: 1 } });
  const search = (date: string) => api().post(`${V2}/search`).set('X-Device-Fingerprint', 'it-device').send(searchBody(date));

  beforeAll(async () => {
    contract = await ContractV2Validator.load();
    ctx = await createIntegrationApp();
    app = ctx.app;
    ds = ctx.dataSource;
    await seedFlights(ds);
    await app.get(PartnerAuthService).upsert(CLIENT, SECRET);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  describe('búsqueda', () => {
    it('una búsqueda de un tramo hace pocas consultas (también la primera, en frío) y su respuesta valida contra el contrato v2', async () => {
      const cold = await countQueries(ds, () => search(dayAhead(day++)));
      expect(cold.result.status).toBe(200);
      expect(cold.queries.length).toBeLessThanOrEqual(8);

      const warm = await countQueries(ds, () => search(dayAhead(day++)));
      expect(warm.result.status).toBe(200);
      console.info(`búsqueda v2 de un tramo: ${cold.queries.length} consultas en frío, ${warm.queries.length} en caliente`);
      expect(warm.queries.length).toBeLessThanOrEqual(8);
      expect(warm.result.body.totalOffers).toBeGreaterThan(0);
      contract.check('post', '/vuelos/search', 200, warm.result.body);
    });

    it('guarda cada oferta con sus itinerarios (INSERT multifila): el mapa de asientos de cada oferta responde', async () => {
      const res = await search(dayAhead(day++)).expect(200);
      expect(res.body.offers.length).toBeGreaterThan(1);
      for (const offer of res.body.offers as { offerId: string; itineraries: { itineraryId: string; segments: { segmentId: string }[] }[] }[]) {
        const rows = await ds.query(`SELECT "orden", "itineraryId", "vueloId" FROM "${ctx.schema}"."vuelos_flight_offer_itineraries" WHERE "offerId" = $1 ORDER BY "orden"`, [offer.offerId]);
        expect(rows).toEqual(offer.itineraries.map((it, i) => ({ orden: i, itineraryId: it.itineraryId, vueloId: it.segments[0].segmentId })));
      }
      const [stored] = await ds.query(`SELECT "grandTotalMinor", "currency", "adults", "youths", "children", "infants" FROM "${ctx.schema}"."vuelos_flight_offers" WHERE "offerId" = $1`, [res.body.offers[0].offerId]);
      expect(stored).toMatchObject({ currency: 'USD', adults: 1, youths: 0, children: 0, infants: 0 });
      expect(Number(stored.grandTotalMinor)).toBe(Math.round(Number(res.body.offers[0].grandTotal.total) * 100));
    });
  });

  describe('mapa de asientos', () => {
    it('v1 conserva su forma; v2 añade el estado BOOKED / TICKETED / HELD con pocas consultas', async () => {
      const token = await tokenFor();
      const date = dayAhead(day++);
      const offer = (await search(date).expect(200)).body.offers[0] as { offerId: string; itineraries: { itineraryId: string }[] };
      const segmentId = (await api().get(`${V2}/offers/${offer.offerId}/seatmap`).expect(200)).body.segmentId as string;
      const selections = offer.itineraries.map((i) => ({ itineraryId: i.itineraryId, cabinClass: 'ECONOMY', fareBrand: 'FULL' }));
      const pax = (id: string) => ({ passengerId: id, passengerType: 'ADULT', firstName: `Name${id}`, lastName: 'Tapia', documentType: 'PASSPORT', documentNumber: `DOC${id.toUpperCase()}1234`, nationality: 'EC', birthDate: '1990-05-05', gender: 'M', contact: { email: `${id}@example.com`, phone: '+593999999999' } });

      // Two sold seats (one then marked as not ticketed) and one seat set aside by a hold.
      const sell = async (userId: string, passengerId: string, seatNumber: string) => {
        const offerN = (await search(date).expect(200)).body.offers[0] as typeof offer;
        const held = await api().post(`${V2}/offers/hold`).set(bearer(token, userId)).set('Idempotency-Key', randomUUID()).send({ offerId: offerN.offerId, itinerarySelections: offerN.itineraries.map((i) => ({ itineraryId: i.itineraryId, cabinClass: 'ECONOMY', fareBrand: 'FULL' })), passengersBreakdown: { adults: 1 } }).expect(201);
        const booked = await api().post(`${V2}/bookings`).set(bearer(token, userId)).set('Idempotency-Key', randomUUID()).send({ holdId: held.body.holdId, passengers: [pax(passengerId)], payment: { paymentReference: `pay_${randomUUID().slice(0, 12)}` } }).expect(201);
        await api().put(`${V2}/bookings/${booked.body.bookingId}/seats`).set(bearer(token, userId)).set('Idempotency-Key', randomUUID()).send({ seats: [{ passengerId, segmentId, seatNumber }] }).expect(200);
        return booked.body.bookingId as string;
      };
      await sell('perf-u1', 'p1', '20A');
      const secondBooking = await sell('perf-u2', 'p2', '20B');
      await ds.getRepository(Ticket).update({ bookingId: secondBooking }, { status: 'PENDING' }); // seat sold, ticket not issued: BOOKED
      await api().post(`${V2}/offers/hold`).set(bearer(token, 'perf-u3')).set('Idempotency-Key', randomUUID()).send({ offerId: offer.offerId, itinerarySelections: selections, passengersBreakdown: { adults: 1 }, assignedSeats: [{ segmentId, seatNumber: '20C' }] }).expect(201);

      const v1Count = await countQueries(ds, () => api().get(`/api/v1/offers/${offer.offerId}/seatmap`).query({ segmentId }));
      const v1 = v1Count.result;
      expect(v1.status).toBe(200);
      const v1Seats = seatsOf(v1.body);
      expect(Object.keys(v1Seats[0]).sort()).toEqual(['characteristics', 'isAvailable', 'seatNumber']); // no `status` in v1
      for (const seatNumber of ['20A', '20B', '20C']) expect(v1Seats.find((s) => s.seatNumber === seatNumber)!.isAvailable).toBe(false);
      expect(v1Seats.find((s) => s.seatNumber === '20D')!.isAvailable).toBe(true);

      const v2Count = await countQueries(ds, () => api().get(`${V2}/offers/${offer.offerId}/seatmap`).query({ segmentId }));
      const v2 = v2Count.result;
      expect(v2.status).toBe(200);
      contract.check('get', '/vuelos/offers/{offerId}/seatmap', 200, v2.body);
      const v2Seats = seatsOf(v2.body);
      const statusOf = (n: string) => v2Seats.find((s) => s.seatNumber === n)!.status;
      expect([statusOf('20A'), statusOf('20B'), statusOf('20C'), statusOf('20D')]).toEqual(['TICKETED', 'BOOKED', 'HELD', 'AVAILABLE']);
      // The same seats, in the same order, with the same availability as v1.
      expect(v2Seats.map((s) => [s.seatNumber, s.isAvailable])).toEqual(v1Seats.map((s) => [s.seatNumber, s.isAvailable]));

      console.info(`mapa de asientos: v1 ${v1Count.queries.length} consultas, v2 ${v2Count.queries.length} consultas`);
      expect(v1Count.queries.length).toBeLessThanOrEqual(4);
      expect(v2Count.queries.length).toBeLessThanOrEqual(6);
    });
  });

  describe('/health', () => {
    it('no consulta la base en la petición y conserva su forma', async () => {
      await api().get(`${V2}/health`).expect(200); // warms the snapshot
      const { result, queries } = await countQueries(ds, async () => [await api().get(`${V2}/health`), await api().get(`${V2}/health`)]);
      expect(queries).toEqual([]);
      for (const res of result) {
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ status: 'HEALTHY', vertical: 'VUELOS', circuit_breaker_estado: 'CLOSED' });
        expect(Object.keys(res.body).sort()).toEqual(
          ['circuit_breaker_estado', 'dependencias', 'holds_activos_count', 'latencia_ms', 'nodo_id', 'nombre_proveedor', 'status', 'timestamp', 'uptime_seconds', 'version', 'vertical', 'vuelos_programados_hoy'],
        );
        expect(res.body.dependencias[0]).toMatchObject({ nombre: 'postgresql', status: 'UP' });
        contract.check('get', '/vuelos/health', 200, res.body);
      }
    });

    it('con la foto vencida la refresca una sola vez aunque lleguen varias peticiones a la vez', async () => {
      const health = app.get(HealthV2Service) as unknown as { snapshot?: { takenAt: number } };
      health.snapshot = { ...health.snapshot!, takenAt: Date.now() - 5 * 60_000 };
      const { result, queries } = await countQueries(ds, () => Promise.all([api().get(`${V2}/health`), api().get(`${V2}/health`), api().get(`${V2}/health`)]));
      expect(result.map((r) => r.status)).toEqual([200, 200, 200]);
      expect(queries.filter((q) => q.trim().toUpperCase().startsWith('SELECT 1'))).toHaveLength(1);
    });
  });

  describe('feed /eventos', () => {
    it('pagina por uuid y por evt-vue-N con una sola consulta, filtra por tipo y rechaza un cursor desconocido', async () => {
      const token = await tokenFor();
      for (let i = 0; i < 3; i++) {
        const offer = (await search(dayAhead(day++)).expect(200)).body.offers[0] as { offerId: string; itineraries: { itineraryId: string }[] };
        await api().post(`${V2}/offers/hold`).set(bearer(token, `feed-u${i}`)).set('Idempotency-Key', randomUUID()).send({ offerId: offer.offerId, itinerarySelections: offer.itineraries.map((it) => ({ itineraryId: it.itineraryId, cabinClass: 'ECONOMY', fareBrand: 'FULL' })), passengersBreakdown: { adults: 1 } }).expect(201);
      }
      const all = (await api().get(`${V2}/eventos`).query({ limit: 100 }).set(bearer(token)).expect(200)).body;
      expect(all.events.length).toBeGreaterThanOrEqual(3);
      contract.check('get', '/vuelos/eventos', 200, all);
      const ids = all.events.map((e: { id: string }) => e.id);

      const page1 = (await api().get(`${V2}/eventos`).query({ limit: 2 }).set(bearer(token)).expect(200)).body;
      expect(page1.events.map((e: { id: string }) => e.id)).toEqual(ids.slice(0, 2));
      expect(page1.metadata.next_after).toBe(ids[1]);

      const counted = await countQueries(ds, () => api().get(`${V2}/eventos`).query({ limit: 100, after: page1.metadata.next_after }).set(bearer(token)));
      expect(counted.result.status).toBe(200);
      expect(counted.result.body.events.map((e: { id: string }) => e.id)).toEqual(ids.slice(2)); // no gaps, no repeats
      expect(counted.queries.filter((q) => /vuelos_outbox/.test(q))).toHaveLength(1);

      const rows = await ds.getRepository(OutboxEvent).find({ order: { seq: 'ASC' }, take: 3 });
      const legacy = (await api().get(`${V2}/eventos`).query({ limit: 100, after: `evt-vue-${String(rows[0].seq).padStart(6, '0')}` }).set(bearer(token)).expect(200)).body;
      expect(legacy.events.map((e: { id: string }) => e.id)).toEqual(ids.slice(1));

      const filtered = (await api().get(`${V2}/eventos`).query({ type: 'hold.created', after: ids[0], limit: 100 }).set(bearer(token)).expect(200)).body;
      expect(filtered.events.every((e: { type: string }) => e.type.endsWith('hold.created'))).toBe(true);

      const nothingNew = (await api().get(`${V2}/eventos`).query({ after: ids[ids.length - 1] }).set(bearer(token)).expect(200)).body;
      expect(nothingNew.events).toEqual([]);
      expect(nothingNew.metadata.next_after).toBe(ids[ids.length - 1]);

      const unknown = await api().get(`${V2}/eventos`).query({ after: randomUUID() }).set(bearer(token));
      expect(unknown.status).toBe(400);
      expect(unknown.body.code).toBe('VALIDATION_FAILED');
      expect((await api().get(`${V2}/eventos`).query({ after: 'evt-nope' }).set(bearer(token))).status).toBe(400);
    });
  });

  describe('feed /eventos con espera de 2 s para commits tardíos', () => {
    it('una fila recién escrita espera su turno y aparece pasada la espera, sin saltarse ninguna', async () => {
      const slow = await createIntegrationApp({ OUTBOX_FEED_DELAY_MS: '1500' });
      try {
        await seedFlights(slow.dataSource);
        await slow.app.get(PartnerAuthService).upsert(CLIENT, SECRET);
        const token = (await request(slow.app.getHttpServer()).post('/api/v2/oauth2/token').type('form').send({ grant_type: 'client_credentials', client_id: CLIENT, client_secret: SECRET }).expect(200)).body.access_token as string;
        const feed = (query: Record<string, string> = {}) => request(slow.app.getHttpServer()).get(`${V2}/eventos`).query(query).set(bearer(token)).expect(200);
        const insert = (id: string) =>
          slow.dataSource.getRepository(OutboxEvent).insert({ eventoId: id, type: 'hold.created', subject: id, correlationId: 'c', occurredAt: new Date(), cloudEvent: { id, type: 'ec.ram.vuelos.hold.created' } });

        const first = randomUUID();
        await insert(first);
        expect((await feed()).body.events).toEqual([]); // too recent
        await new Promise((resolve) => setTimeout(resolve, 1700));
        const second = randomUUID();
        await insert(second);
        const page = (await feed({ limit: '10' })).body;
        expect(page.events.map((e: { id: string }) => e.id)).toEqual([first]); // the second one waits its turn
        await new Promise((resolve) => setTimeout(resolve, 1700));
        const next = (await feed({ after: page.metadata.next_after })).body;
        expect(next.events.map((e: { id: string }) => e.id)).toEqual([second]);
      } finally {
        await slow.close();
      }
    });
  });
});
