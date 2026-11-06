import { randomUUID } from 'node:crypto';
import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { documentHashOf } from '../common/travellers';
import { signWebhookBodyV2 } from '../common/safe-http';
import { seedFlights } from '../seed/flights.seed';
import { WebhookDispatcherService } from '../services/webhook-dispatcher.service';
import { PartnerAuthService } from '../v2/auth/partner-auth.service';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(240_000);

/**
 * The automatic cases A-01..A-16 of Booking's "Plan de pruebas para aerolíneas" (04-nov), run against this API the way Booking
 * calls it: OAuth2 token of the Booking client, X-User-Id, Idempotency-Key on writes. UIO -> GYE is the route of the plan.
 */
const V2 = '/api/v2/vuelos';
const CLIENT = 'booking-prototipo';
const SECRET = 'a-partner-secret-of-24-chars!';
const WEBHOOK_SECRET = 'a-secret-of-sixteen-chars';
const CEDULA = '1710034065'; // a real check digit
const dayAhead = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

interface Seat {
  seatNumber: string;
  status: string;
  isAvailable: boolean;
}

describeIntegration('Booking test plan A-01..A-16 against a real Postgres', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let ds: DataSource;
  let server: http.Server;
  let hookUrl: string;
  const received: { headers: http.IncomingHttpHeaders; body: string }[] = [];
  let token: string;

  const api = () => request(app.getHttpServer());
  const bearer = (userId?: string) => ({ Authorization: `Bearer ${token}`, ...(userId ? { 'X-User-Id': userId, 'X-Correlation-Id': randomUUID() } : {}) });

  const pax = (id: string, overrides: Record<string, unknown> = {}) => ({
    passengerId: id,
    passengerType: 'ADULT',
    firstName: 'María José',
    lastName: 'Andrade Vera',
    documentType: 'NATIONAL_ID',
    documentNumber: CEDULA,
    nationality: 'EC',
    birthDate: '1990-05-05',
    gender: 'F',
    contact: { email: 'maria@example.com', phone: '+593999999999' },
    ...overrides,
  });

  async function search(itineraries: { origin: string; destination: string; departureDate: string }[]) {
    const res = await api().post(`${V2}/search`).set('X-Device-Fingerprint', 'plan-device').send({ itineraries, passengers: { adults: 1 } }).expect(200);
    return res.body.offers[0] as { offerId: string; itineraries: { itineraryId: string; segments: { segmentId: string }[] }[] };
  }

  async function hold(userId: string, itineraries: { origin: string; destination: string; departureDate: string }[], onlyFirst = false) {
    const offer = await search(itineraries);
    const legs = onlyFirst ? offer.itineraries.slice(0, 1) : offer.itineraries;
    const res = await api()
      .post(`${V2}/offers/hold`)
      .set(bearer(userId))
      .set('Idempotency-Key', randomUUID())
      .send({ offerId: offer.offerId, itinerarySelections: legs.map((i) => ({ itineraryId: i.itineraryId, cabinClass: 'ECONOMY', fareBrand: 'FULL' })), passengersBreakdown: { adults: 1 } });
    return { res, offer };
  }

  const oneWay = (day: number) => [{ origin: 'UIO', destination: 'GYE', departureDate: dayAhead(day) }];

  async function book(userId: string, held: { res: request.Response; offer: { itineraries: { segments: { segmentId: string }[] }[] } }, extra: { seat?: string; passenger?: Record<string, unknown>; partnerOrderId?: string; amount?: unknown } = {}) {
    const segmentId = held.offer.itineraries[0].segments[0].segmentId;
    return api()
      .post(`${V2}/bookings`)
      .set(bearer(userId))
      .set('Idempotency-Key', randomUUID())
      .send({
        holdId: held.res.body.holdId,
        passengers: [pax('a1', { ...(extra.seat ? { assignedSeats: [{ segmentId, seatNumber: extra.seat }] } : {}), ...(extra.passenger ?? {}) })],
        payment: { paymentReference: `PAY-BKP-${Date.now()}-${randomUUID().slice(0, 6)}`, amount: extra.amount ?? held.res.body.lockedPrice, provider: 'BOOKING_PROTOTIPO' },
        salesChannel: { partnerId: 'booking', partnerOrderId: extra.partnerOrderId ?? `ORD-BKP-${randomUUID().slice(0, 8)}`, packageId: null, promotionApplied: false },
      });
  }

  async function seatsOf(offerId: string, segmentId: string): Promise<Seat[]> {
    const map = await api().get(`${V2}/offers/${offerId}/seatmap`).query({ segmentId }).expect(200);
    return map.body.cabins.flatMap((c: { rows: { seats: Seat[] }[] }) => c.rows.flatMap((r) => r.seats));
  }

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let data = '';
      req.on('data', (c) => (data += c));
      req.on('end', () => {
        received.push({ headers: req.headers, body: data });
        res.statusCode = 202; // Booking answers 202 to a delivery
        res.end('accepted');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    hookUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;

    ctx = await createIntegrationApp({ WEBHOOKS_ALLOW_PRIVATE_HOSTS: 'true' });
    app = ctx.app;
    ds = ctx.dataSource;
    await seedFlights(ds);
    await app.get(PartnerAuthService).upsert(CLIENT, SECRET);
    // Booking registered its subscription on 04-nov (the cases below produce the events it listens to).
    const basic = `Basic ${Buffer.from(`${CLIENT}:${SECRET}`).toString('base64')}`;
    token = (await api().post('/api/v2/oauth2/token').set('Authorization', basic).type('form').send({ grant_type: 'client_credentials' }).expect(200)).body.access_token;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await ctx?.close();
  });

  it('A-01 · token with HTTP Basic: 200 with access_token and the scope flights:webhooks', async () => {
    const basic = `Basic ${Buffer.from(`${CLIENT}:${SECRET}`).toString('base64')}`;
    const res = await api().post('/api/v2/oauth2/token').set('Authorization', basic).type('form').send({ grant_type: 'client_credentials' }).expect(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.scope.split(' ')).toContain('flights:webhooks');
  });

  it('A-02 · search UIO -> GYE round trip: itineraryId, segments with time and zone, baseFare/taxes/total', async () => {
    const offer = await search([
      { origin: 'UIO', destination: 'GYE', departureDate: dayAhead(12) },
      { origin: 'GYE', destination: 'UIO', departureDate: dayAhead(14) },
    ]);
    expect(offer.itineraries).toHaveLength(2);
    offer.itineraries.forEach((i) => expect(i.itineraryId).toBeDefined());
    const text = JSON.stringify(offer);
    expect(text).toMatch(/"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z"/); // times with their zone (UTC)
    ['pricingOptions', 'baseFare', 'taxes', 'total'].forEach((field) => expect(text).toContain(`"${field}"`));
  });

  it('A-03 / A-04 · hold: one selection per itinerary (201, lockedPrice with its breakdown); a single itinerary of a round trip (422)', async () => {
    const trip = [
      { origin: 'UIO', destination: 'GYE', departureDate: dayAhead(12) },
      { origin: 'GYE', destination: 'UIO', departureDate: dayAhead(14) },
    ];
    const both = await hold('user-a03', trip);
    expect(both.res.status).toBe(201);
    const price = both.res.body.lockedPrice;
    expect(price).toMatchObject({ currency: 'USD', total: expect.stringMatching(/^\d+\.\d{2}$/), baseFare: expect.any(String), taxes: expect.any(String) });
    expect(Math.round((Number(price.baseFare) + Number(price.taxes)) * 100)).toBe(Math.round(Number(price.total) * 100));
    const single = await hold('user-a03', oneWay(12));
    expect(Number(price.total)).toBeGreaterThan(Number(single.res.body.lockedPrice.total)); // two legs cost more than one

    const incomplete = await hold('user-a04', trip, true);
    expect(incomplete.res.status).toBe(422);
  });

  it('A-05 .. A-12 · seatmap, booking with seat and amount, mismatch, taken seat, bad nationality, ownership, one traveller, quote and cancel', async () => {
    // A-06: the booking echoes partnerOrderId, shows the breakdown and takes the seat.
    const partnerOrderId = `ORD-BKP-${randomUUID().slice(0, 8)}`;
    const held = await hold('user-a06', oneWay(16));
    const segmentId = held.offer.itineraries[0].segments[0].segmentId;
    const before = await seatsOf(held.offer.offerId, segmentId); // A-05
    expect(before.length).toBeGreaterThan(0);
    expect(before.find((s) => s.seatNumber === '14C')).toMatchObject({ status: 'AVAILABLE', isAvailable: true });

    const booked = await book('user-a06', held, { seat: '14C', partnerOrderId });
    expect(booked.status).toBe(201);
    expect(booked.body.salesChannel.partnerOrderId).toBe(partnerOrderId);
    expect(booked.body.grandTotal).toMatchObject({ baseFare: expect.any(String), taxes: expect.any(String), total: held.res.body.lockedPrice.total });
    expect((await seatsOf(held.offer.offerId, segmentId)).find((s) => s.seatNumber === '14C')).toMatchObject({ isAvailable: false });
    const bookingId = booked.body.bookingId as string;

    // A-07: another amount than the hold.
    const heldB = await hold('user-a07', oneWay(16));
    const mismatch = await book('user-a07', heldB, { amount: { currency: 'USD', total: '1.00' } });
    expect(mismatch.status).toBe(422);
    expect(mismatch.body.code).toBe('AMOUNT_MISMATCH');

    // A-08: a seat that is already sold.
    const taken = await book('user-a07', heldB, { seat: '14C' });
    expect(taken.status).toBe(409);

    // A-09: nationality with three letters.
    const bad = await book('user-a07', heldB, { passenger: { nationality: 'ECU' } });
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body.invalidParams)).toContain('nationality');

    // A-10: another X-User-Id does not see the booking.
    expect((await api().get(`${V2}/bookings/${bookingId}`).set(bearer('another-user'))).status).toBe(404);
    await api().get(`${V2}/bookings/${bookingId}`).set(bearer('user-a06')).expect(200);

    // A-11: a second booking of the same person (same document) leaves one traveller with two passengers.
    const second = await book('user-a06', await hold('user-a06', oneWay(18)), { passenger: { passengerId: 'a2', documentNumber: CEDULA } });
    expect(second.status).toBe(201);
    const hash = documentHashOf({ documentType: 'NATIONAL_ID', nationality: 'EC', documentNumber: CEDULA });
    const travellers = await ds.query(`SELECT "travellerId" FROM "${ctx.schema}"."vuelos_travellers" WHERE "documentHash" = $1`, [hash]);
    expect(travellers).toHaveLength(1);
    const passengers = await ds.query(`SELECT count(*)::int AS n FROM "${ctx.schema}"."vuelos_passengers" WHERE "travellerId" = $1`, [travellers[0].travellerId]);
    expect(passengers[0].n).toBeGreaterThanOrEqual(2);

    // A-12: quote and cancel with the quote; the refund is calculated and the seat is free again.
    const quote = await api().get(`${V2}/bookings/${bookingId}/cancellation-quote`).set(bearer('user-a06')).expect(200);
    expect(quote.body.quoteId).toBeDefined();
    const cancelled = await api().post(`${V2}/bookings/${bookingId}/cancel`).set(bearer('user-a06')).set('Idempotency-Key', randomUUID()).send({ quoteId: quote.body.quoteId, reasonCode: 'CUSTOMER_REQUEST' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.refund.amount).toBeDefined();
    expect((await seatsOf(held.offer.offerId, segmentId)).find((s) => s.seatNumber === '14C')).toMatchObject({ status: 'AVAILABLE', isAvailable: true });
  });

  it('A-13 .. A-16 · check-in, the event feed, the listed subscription and the signed delivery', async () => {
    // The subscription Booking registered; it is made for one user and must still be seen (and heard) by the partner.
    const webhook = await api().post(`${V2}/webhooks`).set(bearer('registering-user')).send({ url: hookUrl, events: ['booking.confirmed', 'booking.cancelled', 'booking.checked_in'], secret: WEBHOOK_SECRET }).expect(201);
    received.length = 0;

    const partnerOrderId = `ORD-BKP-${randomUUID().slice(0, 8)}`;
    const held = await hold('user-a13', oneWay(1)); // tomorrow: inside the 48 h check-in window
    const booked = await book('user-a13', held, { partnerOrderId });
    expect(booked.status).toBe(201);
    const bookingId = booked.body.bookingId as string;

    // A-13
    const checkIn = await api().post(`${V2}/bookings/${bookingId}/check-in`).set(bearer('user-a13')).set('Idempotency-Key', randomUUID()).send({});
    expect(checkIn.status).toBe(200);

    const heldC = await hold('user-a13', oneWay(20));
    const bookedC = await book('user-a13', heldC);
    const quote = await api().get(`${V2}/bookings/${bookedC.body.bookingId}/cancellation-quote`).set(bearer('user-a13')).expect(200);
    const cancelled = await api().post(`${V2}/bookings/${bookedC.body.bookingId}/cancel`).set(bearer('user-a13')).set('Idempotency-Key', randomUUID()).send({ quoteId: quote.body.quoteId, reasonCode: 'CUSTOMER_REQUEST' });
    expect(cancelled.status).toBe(200);

    // A-14: events in order, not repeated, with bookingId, pnr and partnerOrderId; the cancellation carries the refund.
    const feed = await api().get(`${V2}/eventos`).query({ limit: 100 }).set(bearer()).expect(200);
    const events = feed.body.events as { id: string; type: string; time: string; data: Record<string, unknown> }[];
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
    expect(events.map((e) => e.time)).toEqual([...events.map((e) => e.time)].sort());
    const mine = (suffix: string, id: string) => events.find((e) => e.type.endsWith(suffix) && e.data.bookingId === id);
    expect(mine('booking.confirmed', bookingId)?.data).toMatchObject({ bookingId, pnr: expect.any(String), partnerOrderId });
    expect(mine('booking.checked_in', bookingId)?.data).toMatchObject({ bookingId, partnerOrderId });
    expect(mine('booking.cancelled', bookedC.body.bookingId)?.data).toMatchObject({ pnr: expect.any(String), refundAmount: expect.any(String) });
    const page = await api().get(`${V2}/eventos`).query({ limit: 2 }).set(bearer()).expect(200);
    expect(page.body.metadata.next_after).toBe(page.body.events[1].id); // the cursor is the id of the last event
    const next = await api().get(`${V2}/eventos`).query({ limit: 100, after: page.body.metadata.next_after }).set(bearer()).expect(200);
    expect(next.body.events.map((e: { id: string }) => e.id)).not.toContain(page.body.events[1].id);

    // A-15: the active subscription is listed, whichever user the partner asks for.
    for (const userId of [undefined, 'registering-user', 'someone-else']) {
      const listed = await api().get(`${V2}/webhooks`).set(bearer(userId)).expect(200);
      expect(listed.body.some((w: { id: string; active: boolean }) => w.id === webhook.body.id && w.active)).toBe(true);
    }

    // A-16: the delivery is a signed CloudEvent and Booking answers 202.
    for (let round = 0; round < 20 && !received.some((r) => r.body.includes(bookedC.body.bookingId) && r.headers['x-webhook-event'] === 'booking.cancelled'); round++) {
      await app.get(WebhookDispatcherService).process();
    }
    const hit = received.find((r) => r.headers['x-webhook-event'] === 'booking.cancelled' && r.body.includes(bookedC.body.bookingId));
    expect(hit).toBeDefined();
    expect(hit!.headers['content-type']).toBe('application/cloudevents+json');
    expect(hit!.headers['x-webhook-signature']).toBe(signWebhookBodyV2(WEBHOOK_SECRET, hit!.body));
    expect(JSON.parse(hit!.body).data.bookingId).toBe(bookedC.body.bookingId);
    const delivered = await ds.query(`SELECT status FROM "${ctx.schema}"."vuelos_webhook_deliveries" WHERE "subscriptionId" = $1 AND "eventType" = 'booking.cancelled'`, [webhook.body.id]);
    expect(delivered.some((d: { status: string }) => d.status === 'DELIVERED' || d.status === 'SENT' || d.status === 'DONE')).toBe(true);
  });
});
