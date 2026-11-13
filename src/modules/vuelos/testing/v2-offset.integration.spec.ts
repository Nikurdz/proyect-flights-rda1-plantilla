import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { seedFlights } from '../seed/flights.seed';
import { PartnerAuthService } from '../v2/auth/partner-auth.service';
import { ContractV2Validator } from './contract-v2-validator';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(180_000);

const V2 = '/api/v2/vuelos';
const CLIENT = 'booking-prototipo';
const SECRET = 'a-partner-secret-of-24-chars!';
const dayAhead = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const ECUADOR = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}-05:00$/;
const GALAPAGOS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}-06:00$/;
const UTC_Z = /\d{2}:\d{2}:\d{2}(\.\d+)?Z"/;

describeIntegration('Contract v2: instants with their real offset', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let ds: DataSource;
  let contract: ContractV2Validator;
  let token: string;

  const api = () => request(app.getHttpServer());
  const bearer = () => ({ Authorization: `Bearer ${token}`, 'X-User-Id': 'offset-user' });

  const search = (origin: string, destination: string, date: string) =>
    api().post(`${V2}/search`).set('X-Device-Fingerprint', 'it-device').send({ itineraries: [{ origin, destination, departureDate: date }], passengers: { adults: 1 } });

  async function holdFor(origin: string, destination: string, date: string) {
    const res = await search(origin, destination, date).expect(200);
    const offer = res.body.offers[0];
    return api()
      .post(`${V2}/offers/hold`)
      .set(bearer())
      .set('Idempotency-Key', randomUUID())
      .send({
        offerId: offer.offerId,
        itinerarySelections: offer.itineraries.map((i: { itineraryId: string }) => ({ itineraryId: i.itineraryId, cabinClass: 'ECONOMY', fareBrand: 'FULL' })),
        passengersBreakdown: { adults: 1 },
      });
  }

  beforeAll(async () => {
    contract = await ContractV2Validator.load();
    ctx = await createIntegrationApp();
    app = ctx.app;
    ds = ctx.dataSource;
    await seedFlights(ds);
    await app.get(PartnerAuthService).upsert(CLIENT, SECRET);
    token = (await api().post('/api/v2/oauth2/token').type('form').send({ grant_type: 'client_credentials', client_id: CLIENT, client_secret: SECRET }).expect(200)).body.access_token;
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('search UIO -> GYE: departure and arrival at -05:00, the same instants as in v1', async () => {
    const date = dayAhead(6);
    const res = await search('UIO', 'GYE', date).expect(200);
    contract.check('post', '/vuelos/search', 200, res.body);
    const segment = res.body.offers[0].itineraries[0].segments[0];
    expect(segment.departure.at).toMatch(ECUADOR);
    expect(segment.arrival.at).toMatch(ECUADOR);
    expect(JSON.stringify(res.body)).not.toMatch(UTC_Z);

    // v1 keeps `Z`, and the instant is the same one.
    const v1 = await api().post('/api/v1/search').set('X-Device-Fingerprint', 'it').send({ itineraries: [{ origin: 'UIO', destination: 'GYE', departureDate: date }], passengers: { adults: 1 } }).expect(200);
    expect(JSON.stringify(v1.body)).toMatch(UTC_Z);
    expect(JSON.stringify(v1.body)).not.toMatch(/-05:00"/);
    const v1Segments = v1.body.offers.flatMap((o: { itineraries: { segments: { segmentId: string; departure: { at: string } }[] }[] }) => o.itineraries.flatMap((i) => i.segments));
    const same = v1Segments.find((s: { segmentId: string }) => s.segmentId === segment.segmentId);
    expect(new Date(segment.departure.at).getTime()).toBe(new Date(same.departure.at).getTime());
  });

  it('search to Galapagos: the arrival is written at -06:00 and the departure at -05:00', async () => {
    for (const [origin, destination] of [
      ['GYE', 'SCY'],
      ['UIO', 'SCY'],
    ]) {
      const res = await search(origin, destination, dayAhead(6)).expect(200);
      expect(res.body.offers.length).toBeGreaterThan(0);
      const segment = res.body.offers[0].itineraries[0].segments[0];
      expect(segment.departure.at).toMatch(ECUADOR);
      expect(segment.arrival.at).toMatch(GALAPAGOS);
    }
    const back = await search('SCY', 'GYE', dayAhead(6)).expect(200);
    const segment = back.body.offers[0].itineraries[0].segments[0];
    expect(segment.departure.at).toMatch(GALAPAGOS);
    expect(segment.arrival.at).toMatch(ECUADOR);
  });

  it('hold, booking and tickets: expiresAt and createdAt at -05:00; each coupon with the zone of its airports', async () => {
    const held = await holdFor('UIO', 'SCY', dayAhead(7));
    expect(held.status).toBe(201);
    expect(held.body.expiresAt).toMatch(ECUADOR);
    contract.check('post', '/vuelos/offers/hold', 201, held.body);

    const booked = await api()
      .post(`${V2}/bookings`)
      .set(bearer())
      .set('Idempotency-Key', randomUUID())
      .send({
        holdId: held.body.holdId,
        passengers: [{ passengerId: 'o1', passengerType: 'ADULT', firstName: 'Ana', lastName: 'Tapia', documentType: 'PASSPORT', documentNumber: 'DOCO11234', nationality: 'EC', birthDate: '1990-05-05', gender: 'F', contact: { email: 'o1@example.com', phone: '+593999999999' } }],
        payment: { paymentReference: `pay_${randomUUID().slice(0, 12)}` },
      });
    expect(booked.status).toBe(201);
    expect(booked.body.createdAt).toMatch(ECUADOR);
    expect(booked.body.updatedAt).toMatch(ECUADOR);
    contract.check('post', '/vuelos/bookings', 201, booked.body);
    const detail = await api().get(`${V2}/bookings/${booked.body.bookingId}`).set(bearer()).expect(200);
    expect(detail.body.createdAt).toMatch(ECUADOR);

    const tickets = await api().get(`${V2}/bookings/${booked.body.bookingId}/tickets`).set(bearer()).expect(200);
    const list = (Array.isArray(tickets.body) ? tickets.body : tickets.body.tickets) as { issuedAt: string; segments: { departureAt: string; arrivalAt: string }[] }[];
    expect(list[0].issuedAt).toMatch(ECUADOR);
    expect(list[0].segments[0].departureAt).toMatch(ECUADOR);
    expect(list[0].segments[0].arrivalAt).toMatch(GALAPAGOS);
  });

  it('/eventos: the time of every event carries the offset; the stored CloudEvent stays in UTC', async () => {
    const feed = await api().get(`${V2}/eventos`).query({ limit: 100 }).set(bearer()).expect(200);
    expect(feed.body.events.length).toBeGreaterThan(0);
    for (const event of feed.body.events as { time: string; data: Record<string, unknown> }[]) {
      expect(event.time).toMatch(ECUADOR);
      if (typeof event.data.expiresAt === 'string') expect(event.data.expiresAt).toMatch(ECUADOR);
    }
    expect(feed.body.metadata.timestamp).toMatch(ECUADOR);
    contract.check('get', '/vuelos/eventos', 200, feed.body);

    const stored = await ds.query(`SELECT "cloudEvent" FROM "${ctx.schema}"."vuelos_outbox" LIMIT 1`);
    expect(stored[0].cloudEvent.time).toMatch(/Z$/);
  });

  it('a v2 problem+json carries its timestamp at -05:00', async () => {
    const res = await api().get(`${V2}/bookings`);
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.timestamp).toMatch(ECUADOR);
    contract.check('get', '/vuelos/bookings', 401, res.body, res.headers['content-type']);
  });
});
