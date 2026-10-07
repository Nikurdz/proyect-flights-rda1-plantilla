import { randomUUID } from 'node:crypto';
import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DataSource, In } from 'typeorm';
import { TokenService } from '../auth/token.service';
import { signWebhookBody } from '../common/safe-http';
import { Booking } from '../entities/booking.entity';
import { CancellationQuote } from '../entities/cancellation-quote.entity';
import { CheckIn } from '../entities/check-in.entity';
import { DateChangeOffer } from '../entities/date-change-offer.entity';
import { Ticket } from '../entities/ticket.entity';
import { Vuelo } from '../entities/vuelo.entity';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { WebhookSubscription } from '../entities/webhook-subscription.entity';
import { seedFlights } from '../seed/flights.seed';
import { WebhookDispatcherService } from '../services/webhook-dispatcher.service';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(180_000);

const dayAhead = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

describeIntegration('After-sale (baggage, date change, cancellation, check-in) against a real Postgres', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let ds: DataSource;
  let tokens: TokenService;
  let day = 3; // each booking gets its own flight day so seat counts never interfere

  const api = () => request(app.getHttpServer());
  const auth = (ownerId: string) => ({ Authorization: `Bearer ${tokens.sign({ ownerId, kind: 'customer', roles: [] }).accessToken}` });
  const vuelo = (id: string) => ds.getRepository(Vuelo).findOneByOrFail({ id });

  async function searchOffer(date: string) {
    const res = await api()
      .post('/api/v1/search')
      .set('X-Device-Fingerprint', 'it-device')
      .send({ itineraries: [{ origin: 'BOG', destination: 'SCL', departureDate: date }], passengers: { adults: 1 } })
      .expect(200);
    return res.body.offers[0] as { offerId: string; itineraries: { itineraryId: string }[] };
  }

  const pax = (id: string, overrides: Record<string, unknown> = {}) => ({
    passengerId: id,
    passengerType: 'ADULT',
    firstName: `Name${id}`,
    lastName: 'Tapia',
    documentType: 'PASSPORT',
    documentNumber: `DOC${id.toUpperCase()}1234`,
    nationality: 'EC',
    birthDate: '1990-05-05',
    gender: 'M',
    contact: { email: `${id}@example.com`, phone: '+593999999999' },
    ...overrides,
  });

  /** search -> hold -> booking for one adult on a fresh day. FULL is the changeable, refundable fare. */
  async function book(owner: string, fareBrand = 'FULL') {
    const date = dayAhead(day++);
    const offer = await searchOffer(date);
    const hold = await api()
      .post('/api/v1/offers/hold')
      .set(auth(owner))
      .set('Idempotency-Key', randomUUID())
      .send({
        offerId: offer.offerId,
        itinerarySelections: offer.itineraries.map((i) => ({ itineraryId: i.itineraryId, cabinClass: 'ECONOMY', fareBrand })),
        passengersBreakdown: { adults: 1 },
      })
      .expect(201);
    const booking = await api()
      .post('/api/v1/bookings')
      .set(auth(owner))
      .set('Idempotency-Key', randomUUID())
      .send({ holdId: hold.body.holdId, passengers: [pax('a1')], payment: { paymentReference: `pay_${randomUUID().slice(0, 12)}` } })
      .expect(201);
    const row = await ds.getRepository(Booking).findOneByOrFail({ bookingId: booking.body.bookingId });
    return { date, offer, bookingId: booking.body.bookingId as string, itineraryId: offer.itineraries[0].itineraryId, vueloId: hold.body.itineraries?.[0]?.vueloId as string | undefined, row };
  }

  /** The leg's flight id, read from the hold behind the booking. */
  async function legFlightId(bookingId: string): Promise<string> {
    const rows = await ds.query(
      `SELECT h.inventory FROM "${ctx.schema}"."vuelos_flight_holds" h JOIN "${ctx.schema}"."vuelos_bookings" b ON b."holdId" = h."holdId" WHERE b."bookingId" = $1`,
      [bookingId],
    );
    return rows[0].inventory[0].vueloId;
  }

  const payRef = () => `pay_${randomUUID().slice(0, 12)}`;

  beforeAll(async () => {
    ctx = await createIntegrationApp();
    app = ctx.app;
    ds = ctx.dataSource;
    tokens = app.get(TokenService);
    await seedFlights(ds);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  describe('access control', () => {
    it('answers 401 without a token and 403 to somebody else on every booking route', async () => {
      const { bookingId } = await book('owner-ac');
      const routes: [string, string, object?][] = [
        ['get', `/api/v1/bookings/${bookingId}/baggage-options`],
        ['post', `/api/v1/bookings/${bookingId}/date-change/search`, { changes: [{ itineraryId: randomUUID(), newDepartureDate: dayAhead(30) }] }],
        ['get', `/api/v1/bookings/${bookingId}/cancellation-quote`],
        ['post', `/api/v1/bookings/${bookingId}/check-in`],
        ['get', `/api/v1/bookings/${bookingId}/boarding-passes`],
      ];
      for (const [method, path, body] of routes) {
        const anonymous = await (api() as any)[method](path).send(body);
        expect(anonymous.status).toBe(401);
        const stranger = await (api() as any)[method](path).set(auth('somebody-else')).send(body);
        expect(stranger.status).toBe(403);
        expect(stranger.headers['content-type']).toContain('application/problem+json');
      }
    });
  });

  describe('extra baggage', () => {
    it('lists the options, adds bags within the limit, replays idempotently and refuses a reused payment reference', async () => {
      const owner = 'owner-bag';
      const { bookingId, itineraryId } = await book(owner);

      const options = await api().get(`/api/v1/bookings/${bookingId}/baggage-options`).set(auth(owner)).expect(200);
      expect(options.body[0]).toMatchObject({ passengerId: 'a1', itineraryId, maxAllowed: 2, alreadyPurchased: 0 });
      expect(options.body[0].price).toMatchObject({ total: '40.00', currency: 'USD' });

      const key = randomUUID();
      const reference = payRef();
      const add = (k: string, quantity: number, paymentReference: string) =>
        api().post(`/api/v1/bookings/${bookingId}/baggage`).set(auth(owner)).set('Idempotency-Key', k).send({ passengerId: 'a1', itineraryId, quantity, payment: { paymentReference } });

      const first = await add(key, 1, reference).expect(200);
      expect(first.body).toMatchObject({ passengerId: 'a1', itineraryId, totalBaggage: 1 });
      const replay = await add(key, 1, reference).expect(200);
      expect(replay.body).toEqual(first.body); // same key, same outcome, no second charge

      const reused = await add(randomUUID(), 1, reference);
      expect(reused.status).toBe(409);
      expect(reused.body.code).toBe('PAYMENT_REFERENCE_INVALID');

      const tooMany = await add(randomUUID(), 2, payRef());
      expect(tooMany.status).toBe(409);
      expect(tooMany.body.code).toBe('BAGGAGE_LIMIT_EXCEEDED');

      const second = await add(randomUUID(), 1, payRef()).expect(200);
      expect(second.body.totalBaggage).toBe(2);
    });

    it('closes the sale 3 hours before departure', async () => {
      const owner = 'owner-bag-late';
      const { bookingId, itineraryId } = await book(owner);
      const flightId = await legFlightId(bookingId);
      await ds.getRepository(Vuelo).update({ id: flightId }, { fechaSalida: new Date(Date.now() + 2 * 3_600_000), fechaLlegada: new Date(Date.now() + 6 * 3_600_000) });

      const res = await api()
        .post(`/api/v1/bookings/${bookingId}/baggage`)
        .set(auth(owner))
        .set('Idempotency-Key', randomUUID())
        .send({ passengerId: 'a1', itineraryId, quantity: 1, payment: { paymentReference: payRef() } });
      expect(res.status).toBe(409);
    });
  });

  describe('date change', () => {
    it('is refused for a fare that cannot change, and moves a FULL booking atomically with the inventory', async () => {
      const light = await book('owner-dc-light', 'LIGHT');
      const refused = await api()
        .post(`/api/v1/bookings/${light.bookingId}/date-change/search`)
        .set(auth('owner-dc-light'))
        .send({ changes: [{ itineraryId: light.itineraryId, newDepartureDate: dayAhead(40) }] });
      expect(refused.status).toBe(409);

      const owner = 'owner-dc';
      const { bookingId, itineraryId } = await book(owner);
      const oldFlightId = await legFlightId(bookingId);
      const oldBefore = (await vuelo(oldFlightId)).asientosDisponibles;

      const target = dayAhead(41);
      const search = await api()
        .post(`/api/v1/bookings/${bookingId}/date-change/search`)
        .set(auth(owner))
        .send({ changes: [{ itineraryId, newDepartureDate: target }] })
        .expect(200);
      expect(search.body.length).toBeGreaterThan(0);
      const option = search.body[0];
      expect(option.priceDifference.changeFee).toBe('30.00');
      expect(Number(option.priceDifference.totalToPay)).toBeGreaterThanOrEqual(30);
      const newFlightId = (await ds.getRepository(DateChangeOffer).findOneByOrFail({ changeOfferId: option.changeOfferId })).toVueloId;
      const newBefore = (await vuelo(newFlightId)).asientosDisponibles;

      // Money is owed, so a payment reference is required.
      const noPayment = await api().post(`/api/v1/bookings/${bookingId}/date-change`).set(auth(owner)).set('Idempotency-Key', randomUUID()).send({ changeOfferId: option.changeOfferId });
      expect(noPayment.status).toBe(422);

      const key = randomUUID();
      const reference = payRef(); // a replay carries the same body, so the same reference
      const confirm = () =>
        api().post(`/api/v1/bookings/${bookingId}/date-change`).set(auth(owner)).set('Idempotency-Key', key).send({ changeOfferId: option.changeOfferId, payment: { paymentReference: reference } });
      const done = await confirm().expect(200);
      expect(done.body.bookingId).toBe(bookingId);
      expect(done.body.changes?.length).toBe(1);

      expect((await vuelo(oldFlightId)).asientosDisponibles).toBe(oldBefore + 1);
      expect((await vuelo(newFlightId)).asientosDisponibles).toBe(newBefore - 1);

      const replay = await confirm().expect(200);
      expect(replay.body).toEqual(done.body);
      expect((await vuelo(newFlightId)).asientosDisponibles).toBe(newBefore - 1); // the replay took nothing more

      // The offer is single use.
      const again = await api().post(`/api/v1/bookings/${bookingId}/date-change`).set(auth(owner)).set('Idempotency-Key', randomUUID()).send({ changeOfferId: option.changeOfferId, payment: { paymentReference: payRef() } });
      expect([404, 409, 410]).toContain(again.status);
    });


    it('searching twice returns the same alive offers instead of piling up rows (M1)', async () => {
      const owner = 'owner-dc-dedup';
      const { bookingId, itineraryId } = await book(owner);
      const body = { changes: [{ itineraryId, newDepartureDate: dayAhead(41) }] };
      const first = await api().post(`/api/v1/bookings/${bookingId}/date-change/search`).set(auth(owner)).send(body).expect(200);
      const second = await api().post(`/api/v1/bookings/${bookingId}/date-change/search`).set(auth(owner)).send(body).expect(200);

      expect(second.body.map((o: { changeOfferId: string }) => o.changeOfferId)).toEqual(first.body.map((o: { changeOfferId: string }) => o.changeOfferId));
      expect(await ds.getRepository(DateChangeOffer).count({ where: { bookingId } })).toBe(first.body.length);
    });
  });

  describe('cancellation', () => {
    it('quotes 10 % penalty on FULL, cancels, returns the seat and is idempotent', async () => {
      const owner = 'owner-cancel';
      const { bookingId, row } = await book(owner);
      const flightId = await legFlightId(bookingId);
      const before = (await vuelo(flightId)).asientosDisponibles;

      const quote = await api().get(`/api/v1/bookings/${bookingId}/cancellation-quote`).set(auth(owner)).expect(200);
      expect(quote.body.isRefundable).toBe(true);
      const total = Number(row.grandTotal ?? 0) || Number(quote.body.refundAmount) + Number(quote.body.penaltyAmount);
      expect(Number(quote.body.penaltyAmount)).toBeCloseTo(total * 0.1, 1);

      const key = randomUUID();
      const cancel = () => api().post(`/api/v1/bookings/${bookingId}/cancel`).set(auth(owner)).set('Idempotency-Key', key).send({ quoteId: quote.body.quoteId, reason: 'Change of plans' });
      const done = await cancel().expect(200);
      expect(done.body).toMatchObject({ bookingId, status: 'CANCELLED', refundAmount: quote.body.refundAmount, penaltyAmount: quote.body.penaltyAmount });
      expect((await vuelo(flightId)).asientosDisponibles).toBe(before + 1);

      const replay = await cancel().expect(200);
      expect(replay.body).toEqual(done.body);
      expect((await vuelo(flightId)).asientosDisponibles).toBe(before + 1); // the seat is returned once

      const tickets = await ds.getRepository(Ticket).find({ where: { bookingId } });
      expect(tickets.length).toBeGreaterThan(0);
      expect(tickets.every((t) => ['REFUNDED', 'VOIDED'].includes(t.status))).toBe(true);

      const other = await api().get(`/api/v1/bookings/${bookingId}/baggage-options`).set(auth(owner));
      expect(other.status).toBe(409); // a cancelled booking is no longer confirmed
    });

    it('refunds only the taxes on a non-refundable fare and refuses once the cut-off has passed', async () => {
      const owner = 'owner-cancel-light';
      const { bookingId } = await book(owner, 'LIGHT');
      const quote = await api().get(`/api/v1/bookings/${bookingId}/cancellation-quote`).set(auth(owner)).expect(200);
      expect(quote.body.isRefundable).toBe(false);
      expect(Number(quote.body.penaltyAmount)).toBeGreaterThan(0);

      const flightId = await legFlightId(bookingId);
      await ds.getRepository(Vuelo).update({ id: flightId }, { fechaSalida: new Date(Date.now() + 2 * 3_600_000), fechaLlegada: new Date(Date.now() + 6 * 3_600_000) });
      const late = await api().get(`/api/v1/bookings/${bookingId}/cancellation-quote`).set(auth(owner));
      expect(late.status).toBe(409);
      expect(late.body.code).toBe('CUTOFF_PASSED');
    });

    it('keeps the refund when the live fare changes after the sale (A1) and reuses the quote still alive (M2)', async () => {
      const owner = 'owner-cancel-frozen';
      const { bookingId } = await book(owner, 'LIGHT');
      const quoteUrl = `/api/v1/bookings/${bookingId}/cancellation-quote`;
      const first = await api().get(quoteUrl).set(auth(owner)).expect(200);
      expect(Number(first.body.refundAmount)).toBeGreaterThan(0); // non-refundable: the taxes go back

      // An admin reprices the flight: the taxes the customer paid must not move with it.
      const flightId = await legFlightId(bookingId);
      await ds.getRepository(Vuelo).update({ id: flightId }, { precioBase: (await vuelo(flightId)).precioBase * 3 });
      const again = await api().get(quoteUrl).set(auth(owner)).expect(200);

      expect(again.body.refundAmount).toBe(first.body.refundAmount);
      expect(again.body.penaltyAmount).toBe(first.body.penaltyAmount);
      expect(again.body.quoteId).toBe(first.body.quoteId); // same alive quote, not a new row per GET
      expect(await ds.getRepository(CancellationQuote).count({ where: { bookingId } })).toBe(1);
    });
  });

  describe('check-in and boarding passes', () => {
    it('opens 48 h before, assigns a seat, is repeatable and then issues signed boarding passes', async () => {
      const owner = 'owner-checkin';
      const { bookingId } = await book(owner);
      const flightId = await legFlightId(bookingId);

      const early = await api().post(`/api/v1/bookings/${bookingId}/check-in`).set(auth(owner));
      expect(early.status).toBe(409);
      const none = await api().get(`/api/v1/bookings/${bookingId}/boarding-passes`).set(auth(owner));
      expect(none.status).toBe(404);
      expect(none.body.code).toBe('BOARDING_PASS_NOT_AVAILABLE');

      await ds.getRepository(Vuelo).update({ id: flightId }, { fechaSalida: new Date(Date.now() + 10 * 3_600_000), fechaLlegada: new Date(Date.now() + 14 * 3_600_000) });

      const done = await api().post(`/api/v1/bookings/${bookingId}/check-in`).set(auth(owner)).expect(200);
      expect(done.body.status).toBe('COMPLETED');
      expect(done.body.checkedInPassengers[0].segments[0]).toMatchObject({ status: 'CHECKED_IN', seat: expect.stringMatching(/^\d+[A-F]$/) });

      const again = await api().post(`/api/v1/bookings/${bookingId}/check-in`).set(auth(owner)).expect(200);
      expect(again.body.status).toBe('COMPLETED');
      expect(await ds.getRepository(CheckIn).count({ where: { bookingId } })).toBe(1);

      const passes = await api().get(`/api/v1/bookings/${bookingId}/boarding-passes`).set(auth(owner)).expect(200);
      expect(passes.body.boardingPasses).toHaveLength(1);
      const pass = passes.body.boardingPasses[0];
      expect(pass).toMatchObject({ passengerId: 'a1', barcodeType: 'QR', boardingGroup: 'A', seat: done.body.checkedInPassengers[0].segments[0].seat });
      expect(pass.barcode).toMatch(/^bp1\./);
      expect(pass.barcode).not.toContain('Tapia'); // no personal data in the code
    });

    it('is closed in the last hour', async () => {
      const owner = 'owner-checkin-late';
      const { bookingId } = await book(owner);
      const flightId = await legFlightId(bookingId);
      await ds.getRepository(Vuelo).update({ id: flightId }, { fechaSalida: new Date(Date.now() + 30 * 60_000), fechaLlegada: new Date(Date.now() + 4 * 3_600_000) });
      const res = await api().post(`/api/v1/bookings/${bookingId}/check-in`).set(auth(owner));
      expect(res.status).toBe(409);
    });
  });

  describe('webhook registration', () => {
    it('refuses private and non-https destinations, never returns the secret and isolates owners', async () => {
      const body = (url: string) => ({ url, events: ['booking.confirmed'], secret: 'a-secret-of-sixteen-chars' });
      for (const url of ['https://127.0.0.1/hook', 'https://10.0.0.5/hook', 'https://169.254.169.254/latest', 'http://example.com/hook', 'https://user:pass@example.com/hook']) {
        const res = await api().post('/api/v1/webhooks').set(auth('owner-wh')).send(body(url));
        expect(res.status).toBe(400);
        expect(res.headers['content-type']).toContain('application/problem+json');
      }
      await api().post('/api/v1/webhooks').send(body('https://example.com/hook')).expect(401);
      expect((await api().get('/api/v1/webhooks').set(auth('owner-wh')).expect(200)).body).toEqual([]);
      expect((await api().delete(`/api/v1/webhooks/${randomUUID()}`).set(auth('owner-wh'))).status).toBe(404);
    });
  });
});

describeIntegration('Webhook delivery against a local receiver', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let ds: DataSource;
  let tokens: TokenService;
  let server: http.Server;
  let url: string;
  const received: { headers: http.IncomingHttpHeaders; body: string }[] = [];
  let respondWith = 200;

  const api = () => request(app.getHttpServer());
  const auth = (ownerId: string) => ({ Authorization: `Bearer ${tokens.sign({ ownerId, kind: 'customer', roles: [] }).accessToken}` });
  const SECRET = 'a-secret-of-sixteen-chars';

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let data = '';
      req.on('data', (c) => (data += c));
      req.on('end', () => {
        received.push({ headers: req.headers, body: data });
        res.statusCode = respondWith;
        res.end('ok');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;

    ctx = await createIntegrationApp({ WEBHOOKS_ALLOW_PRIVATE_HOSTS: 'true' });
    app = ctx.app;
    ds = ctx.dataSource;
    tokens = app.get(TokenService);
    await seedFlights(ds);
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await ctx?.close();
  });

  // The registration route accepts https only, on purpose; the local receiver is plain http, so it is stored directly.
  const subscribe = (ownerId: string, events: string[]) => ds.getRepository(WebhookSubscription).save(ds.getRepository(WebhookSubscription).create({ ownerId, url, events, secret: SECRET, active: true }));

  async function confirmBooking(owner: string, offsetDays: number) {
    const date = dayAhead(offsetDays);
    const search = await api()
      .post('/api/v1/search')
      .set('X-Device-Fingerprint', 'it-device')
      .send({ itineraries: [{ origin: 'BOG', destination: 'SCL', departureDate: date }], passengers: { adults: 1 } })
      .expect(200);
    const offer = search.body.offers[0];
    const hold = await api()
      .post('/api/v1/offers/hold')
      .set(auth(owner))
      .set('Idempotency-Key', randomUUID())
      .send({ offerId: offer.offerId, itinerarySelections: offer.itineraries.map((i: { itineraryId: string }) => ({ itineraryId: i.itineraryId, cabinClass: 'ECONOMY', fareBrand: 'LIGHT' })), passengersBreakdown: { adults: 1 } })
      .expect(201);
    return api()
      .post('/api/v1/bookings')
      .set(auth(owner))
      .set('Idempotency-Key', randomUUID())
      .send({
        holdId: hold.body.holdId,
        passengers: [{ passengerId: 'a1', passengerType: 'ADULT', firstName: 'Ana', lastName: 'Tapia', documentType: 'PASSPORT', documentNumber: 'DOCA11234', nationality: 'EC', birthDate: '1990-05-05', gender: 'F', contact: { email: 'a@example.com', phone: '+593999999999' } }],
        payment: { paymentReference: `pay_${randomUUID().slice(0, 12)}` },
      })
      .expect(201);
  }

  it('signs each delivery, retries after a failure, and never returns the secret', async () => {
    const owner = 'owner-hook';
    const created = { body: await subscribe(owner, ['booking.confirmed', 'booking.ticket_issued']) };
    const listed = (await api().get('/api/v1/webhooks').set(auth(owner)).expect(200)).body;
    expect(listed).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toContain(SECRET); // the secret is write-only
    const raw = await ds.query(`SELECT secret FROM "${ctx.schema}"."vuelos_webhook_subscriptions" WHERE id = $1`, [created.body.id]);
    expect(raw[0].secret).not.toContain(SECRET); // and encrypted at rest

    // The first attempt fails: the receiver answers 500 and the delivery waits for the retry.
    respondWith = 500;
    const booked = await confirmBooking(owner, 20);
    const dispatcher = app.get(WebhookDispatcherService);
    const first = await dispatcher.process();
    expect(first.failed).toBeGreaterThan(0);
    const pending = await ds.getRepository(WebhookDelivery).find({ where: { subscriptionId: created.body.id } });
    expect(pending.length).toBeGreaterThanOrEqual(2); // booking.confirmed and booking.ticket_issued
    expect(pending.every((d) => d.status === 'PENDING' && d.attempts === 1 && d.lastStatusCode === 500)).toBe(true);

    // Not due yet: nothing is sent early.
    received.length = 0;
    expect((await dispatcher.process()).delivered).toBe(0);
    expect(received).toHaveLength(0);

    // A minute later the receiver is healthy again.
    respondWith = 200;
    const retry = await dispatcher.process(new Date(Date.now() + 61_000));
    expect(retry.delivered).toBeGreaterThanOrEqual(2);
    const delivered = await ds.getRepository(WebhookDelivery).find({ where: { subscriptionId: created.body.id, status: 'DELIVERED' } });
    expect(delivered.length).toBe(pending.length);

    const hit = received.find((r) => r.headers['x-webhook-event'] === 'booking.confirmed')!;
    expect(hit).toBeDefined();
    const timestamp = hit.headers['x-webhook-timestamp'] as string;
    expect(hit.headers['x-webhook-signature']).toBe(signWebhookBody(SECRET, timestamp, hit.body));
    expect(JSON.parse(hit.body).data?.bookingId ?? JSON.parse(hit.body).payload?.bookingId ?? hit.body).toContain(booked.body.bookingId);
    expect(hit.body).not.toContain('Tapia'); // the event carries no personal data
  });

  it('gives up after the last retry and does not deliver to somebody else', async () => {
    const stranger = { body: await subscribe('owner-other', ['booking.confirmed']) };
    respondWith = 500;
    received.length = 0;
    await confirmBooking('owner-hook', 21);

    const dispatcher = app.get(WebhookDispatcherService);
    let when = Date.now();
    for (let i = 0; i < 7; i++) {
      await dispatcher.process(new Date(when));
      when += 7 * 3_600_000; // longer than the longest delay
    }
    const dead = await ds.getRepository(WebhookDelivery).find({ where: { status: 'DEAD' } });
    expect(dead.length).toBeGreaterThan(0);
    expect(dead.every((d) => d.attempts === 6)).toBe(true);
    // The other owner has nothing queued: events are fanned out by owner.
    expect(await ds.getRepository(WebhookDelivery).count({ where: { subscriptionId: stranger.body.id } })).toBe(0);
    respondWith = 200;
  });

  it('lets an admin cancel and reschedule a flight, refunds the bookings and announces it', async () => {
    const owner = 'owner-flight';
    await subscribe(owner, ['flight.cancelled', 'flight.schedule_changed', 'booking.cancelled', 'booking.changed']);
    await confirmBooking(owner, 22);
    await confirmBooking(owner, 23);

    const bookings = await ds.getRepository(Booking).find({ where: { ownerId: owner }, order: { createdAt: 'ASC' } });
    const flightIds = await Promise.all(
      bookings.map(async (b) => (await ds.query(`SELECT h.inventory FROM "${ctx.schema}"."vuelos_flight_holds" h WHERE h."holdId" = $1`, [b.holdId]))[0].inventory[0].vueloId as string),
    );

    const admin = { Authorization: `Bearer ${tokens.sign({ ownerId: 'admin-1', kind: 'customer', roles: ['ADMIN'] }).accessToken}` };
    // Only an administrator may do this.
    await api().post(`/api/v1/admin/vuelos/${flightIds[0]}/cancelar`).expect(401);
    await api().post(`/api/v1/admin/vuelos/${flightIds[0]}/cancelar`).set(auth(owner)).send({}).expect(403);

    const cancelled = await api().post(`/api/v1/admin/vuelos/${flightIds[0]}/cancelar`).set(admin).send({ motivo: 'Falla técnica' }).expect(200);
    expect(cancelled.body).toMatchObject({ estado: 'CANCELLED', reservasAfectadas: 1 });
    expect((await ds.getRepository(Booking).findOneByOrFail({ bookingId: bookings[0].bookingId })).status).toBe('CANCELLED');
    expect((await api().get(`/api/v1/bookings/${bookings[0].bookingId}`).set(auth(owner)).expect(200)).body.status).toBe('CANCELLED');

    const newDeparture = new Date(new Date((await ds.getRepository(Vuelo).findOneByOrFail({ id: flightIds[1] })).fechaSalida).getTime() + 3 * 3_600_000).toISOString();
    const moved = await api().post(`/api/v1/admin/vuelos/${flightIds[1]}/reprogramar`).set(admin).send({ nuevaSalida: newDeparture, motivo: 'Cambio operativo' }).expect(200);
    expect(moved.body).toMatchObject({ estado: 'SCHEDULED', reservasAfectadas: 1 });

    received.length = 0;
    await app.get(WebhookDispatcherService).process();
    const events = received.map((r) => r.headers['x-webhook-event']);
    expect(events).toEqual(expect.arrayContaining(['flight.cancelled', 'booking.cancelled', 'flight.schedule_changed', 'booking.changed']));
    expect(await ds.getRepository(Booking).count({ where: { ownerId: owner, status: In(['CANCELLED', 'CONFIRMED']) } })).toBe(2);
  });
});
