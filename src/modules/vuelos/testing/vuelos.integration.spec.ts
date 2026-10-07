import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { TokenService } from '../auth/token.service';
import { BaggagePurchase } from '../entities/baggage-purchase.entity';
import { Booking } from '../entities/booking.entity';
import { FlightHold } from '../entities/flight-hold.entity';
import { Vuelo } from '../entities/vuelo.entity';
import { OffersService } from '../services/offers.service';
import { seedFlights } from '../seed/flights.seed';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(120_000);

const dayAhead = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

describeIntegration('Vuelos core against a real Postgres', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let ds: DataSource;
  let tokens: TokenService;

  const api = () => request(app.getHttpServer());
  const tokenFor = (ownerId: string) => tokens.sign({ ownerId, kind: 'customer', roles: [] }).accessToken;
  const auth = (ownerId: string) => ({ Authorization: `Bearer ${tokenFor(ownerId)}` });

  const vuelo = (id: string) => ds.getRepository(Vuelo).findOneByOrFail({ id });
  const holdRow = (holdId: string) => ds.getRepository(FlightHold).findOneByOrFail({ holdId });
  const bookingCount = () => ds.getRepository(Booking).count();

  async function searchOffer(date: string, route: [string, string] = ['BOG', 'SCL'], passengers: Record<string, number> = { adults: 1 }) {
    const res = await api()
      .post('/api/v1/search')
      .set('X-Device-Fingerprint', 'it-device')
      .send({ itineraries: [{ origin: route[0], destination: route[1], departureDate: date }], passengers })
      .expect(200);
    return res.body.offers[0] as {
      offerId: string;
      itineraries: { itineraryId: string; segments: { segmentId: string }[]; pricingOptions: { fareBrand: string }[] }[];
      grandTotal: { total: string };
    };
  }

  const holdBody = (offer: Awaited<ReturnType<typeof searchOffer>>, fareBrand = 'LIGHT', passengersBreakdown: Record<string, number> = { adults: 1 }) => ({
    offerId: offer.offerId,
    itinerarySelections: offer.itineraries.map((i) => ({ itineraryId: i.itineraryId, cabinClass: 'ECONOMY', fareBrand })),
    passengersBreakdown,
  });

  const createHold = (owner: string, body: object, key: string = randomUUID()) =>
    api().post('/api/v1/offers/hold').set(auth(owner)).set('Idempotency-Key', key).send(body);

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

  const createBooking = (owner: string, holdId: string, passengers: object[], paymentReference: string, key: string = randomUUID()) =>
    api()
      .post('/api/v1/bookings')
      .set(auth(owner))
      .set('Idempotency-Key', key)
      .send({ holdId, passengers, payment: { paymentReference } });

  /** search -> hold -> booking for one adult; returns every id a test may want. */
  async function bookOne(owner: string, date: string, paymentReference: string, extra: Record<string, unknown> = {}) {
    const offer = await searchOffer(date);
    const hold = await createHold(owner, holdBody(offer)).expect(201);
    const booking = await createBooking(owner, hold.body.holdId, [pax('a1', extra)], paymentReference).expect(201);
    return { offer, hold: hold.body, booking: booking.body };
  }

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

  describe('contract basics', () => {
    it('requires X-Device-Fingerprint on /search and reports it as problem+json with invalidParams (A7/A8)', async () => {
      const res = await api()
        .post('/api/v1/search')
        .send({ itineraries: [{ origin: 'BOG', destination: 'SCL', departureDate: dayAhead(10) }], passengers: { adults: 1 } })
        .expect(400);

      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({ status: 400, code: 'VALIDATION_FAILED', invalidParams: [{ name: 'X-Device-Fingerprint' }] });
    });

    it('validates the search body and normalises IATA codes (A1/B5/M4)', async () => {
      const ok = await api()
        .post('/api/v1/search')
        .set('X-Device-Fingerprint', 'it')
        .send({ itineraries: [{ origin: ' bog ', destination: 'scl', departureDate: dayAhead(10) }], passengers: { adults: 1 } })
        .expect(200);
      expect(ok.body.totalOffers).toBeGreaterThan(0);

      const bad = await api()
        .post('/api/v1/search')
        .set('X-Device-Fingerprint', 'it')
        .send({ itineraries: [], passengers: { adults: 1 } })
        .expect(400);
      expect(bad.body.code).toBe('VALIDATION_FAILED');
      expect(bad.body.invalidParams.length).toBeGreaterThan(0);

      await api()
        .post('/api/v1/search')
        .set('X-Device-Fingerprint', 'it')
        .send({ itineraries: [{ origin: 'BOG', destination: 'SCL', departureDate: '2026-02-31' }], passengers: { adults: 1 } })
        .expect(400);
    });

    it('prices the whole party by passenger type (A2)', async () => {
      const offer = await searchOffer(dayAhead(11), ['BOG', 'SCL'], { adults: 2, children: 1, infants: 1 });
      const prices = offer.itineraries[0] as unknown as { pricingOptions: { pricePerPassengerType: { passengerType: string }[] }[] };
      expect(prices.pricingOptions[0].pricePerPassengerType.map((p) => p.passengerType).sort()).toEqual(['ADULT', 'CHILD', 'INFANT']);
    });

    it('serves what used to be stubs for real: behind auth, and a typed problem for something that does not exist (C5)', async () => {
      const bookingId = randomUUID();
      const res = await api().get(`/api/v1/bookings/${bookingId}/baggage-options`).set(auth('u1')).expect(404);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body.code).toBe('BOOKING_NOT_CONFIRMED');

      await api().get(`/api/v1/bookings/${bookingId}/baggage-options`).expect(401);
      await api().get(`/api/v1/bookings/${bookingId}/boarding-passes`).expect(401);
      await api().get('/api/v1/webhooks').expect(401);
      expect((await api().get('/api/v1/webhooks').set(auth('u1')).expect(200)).body).toEqual([]);
    });
  });

  describe('authentication (C1)', () => {
    const holdPayload = { offerId: randomUUID(), itinerarySelections: [{ itineraryId: randomUUID(), cabinClass: 'ECONOMY', fareBrand: 'LIGHT' }], passengersBreakdown: { adults: 1 } };

    it('rejects missing, malformed, wrongly signed, expired and alg=none tokens with 401', async () => {
      const post = (headers: Record<string, string>) => api().post('/api/v1/offers/hold').set('Idempotency-Key', randomUUID()).set(headers).send(holdPayload);

      await post({}).expect(401);
      await post({ Authorization: 'Bearer not-a-jwt' }).expect(401);
      await post({ Authorization: `Bearer ${jwt.sign({}, 'another-secret-another-secret-another!', { subject: 'u1', issuer: 'vuelos-identity' })}` }).expect(401);
      await post({ Authorization: `Bearer ${jwt.sign({}, 'integration-test-secret-integration-test-secret', { subject: 'u1', issuer: 'vuelos-identity', expiresIn: -10 })}` }).expect(401);

      const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"sub":"u1","iss":"vuelos-identity"}').toString('base64url')}.`;
      await post({ Authorization: `Bearer ${none}` }).expect(401);
    });

    it('never falls back to a default owner: no token means no data', async () => {
      await api().get('/api/v1/bookings').expect(401);
      const res = await api().get('/api/v1/bookings').set(auth('nobody')).expect(200);
      expect(res.body.items).toEqual([]);
    });
  });

  describe('happy path and seatmap (A3)', () => {
    it('search -> seatmap -> hold -> booking -> tickets, with inventory and seats tracked', async () => {
      const date = dayAhead(15);
      const offer = await searchOffer(date);
      const segmentId = offer.itineraries[0].segments[0].segmentId;
      const before = (await vuelo(segmentId)).asientosDisponibles;

      const seatmap = await api().get(`/api/v1/offers/${offer.offerId}/seatmap`).query({ segmentId }).expect(200);
      const seats = seatmap.body.cabins[0].rows.flatMap((r: { seats: { seatNumber: string; isAvailable: boolean }[] }) => r.seats);
      expect(seats.find((s: { seatNumber: string }) => s.seatNumber === '14C').isAvailable).toBe(true);

      const hold = await createHold('owner-flow', holdBody(offer)).expect(201);
      expect(hold.body).toMatchObject({ status: 'HELD', ttlMinutes: 15 });
      expect((await vuelo(segmentId)).asientosDisponibles).toBe(before - 1);

      const status = await api().get(`/api/v1/offers/hold/${hold.body.holdId}`).set(auth('owner-flow')).expect(200);
      expect(status.body).toMatchObject({ status: 'HELD' });
      expect(status.body.remainingSeconds).toBeGreaterThan(800);

      const booking = await createBooking('owner-flow', hold.body.holdId, [pax('a1', { assignedSeats: [{ segmentId, seatNumber: '14C' }] })], 'pay_flow_0001').expect(201);
      expect(booking.body).toMatchObject({ status: 'CONFIRMED', grandTotal: hold.body.lockedPrice });
      expect(booking.body.tickets).toHaveLength(1);
      expect(booking.body.tickets[0].eTicketNumber).toMatch(/^\d{13}$/);
      expect((await holdRow(hold.body.holdId)).status).toBe('CONSUMED');
      expect((await vuelo(segmentId)).asientosDisponibles).toBe(before - 1); // consumed, not returned

      const detail = await api().get(`/api/v1/bookings/${booking.body.bookingId}`).set(auth('owner-flow')).expect(200);
      expect(detail.body.pnr).toBe(booking.body.pnr);
      const tickets = await api().get(`/api/v1/bookings/${booking.body.bookingId}/tickets`).set(auth('owner-flow')).expect(200);
      expect(tickets.body).toHaveLength(1);
      await api().get(`/api/v1/bookings/${booking.body.bookingId}/tickets/${tickets.body[0].ticketId}`).set(auth('owner-flow')).expect(200);

      const after = await api().get(`/api/v1/offers/${offer.offerId}/seatmap`).query({ segmentId }).expect(200);
      const takenSeat = after.body.cabins[0].rows.flatMap((r: { seats: { seatNumber: string; isAvailable: boolean }[] }) => r.seats).find((s: { seatNumber: string }) => s.seatNumber === '14C');
      expect(takenSeat.isAvailable).toBe(false);
    });

    it('validates the offer and segment of a seatmap request instead of inventing seats', async () => {
      const offer = await searchOffer(dayAhead(16));
      const segmentId = offer.itineraries[0].segments[0].segmentId;

      await api().get(`/api/v1/offers/${randomUUID()}/seatmap`).query({ segmentId }).expect(404);
      const defaulted = await api().get(`/api/v1/offers/${offer.offerId}/seatmap`).expect(200); // segmentId optional: first segment
      expect(defaulted.body.segmentId).toBe(segmentId);
      await api().get(`/api/v1/offers/${offer.offerId}/seatmap`).query({ segmentId: randomUUID() }).expect(400);
    });

    it('returns 410 for an expired offer', async () => {
      const offer = await searchOffer(dayAhead(16));
      await ds.query(`UPDATE "${ctx.schema}"."vuelos_flight_offers" SET "expiresAt" = $1 WHERE "offerId" = $2`, [new Date(Date.now() - 60_000), offer.offerId]);

      await api().get(`/api/v1/offers/${offer.offerId}/seatmap`).query({ segmentId: offer.itineraries[0].segments[0].segmentId }).expect(410);
      await createHold('owner-x', holdBody(offer)).expect(410);
    });
  });

  describe('idempotency (C6/A5)', () => {
    it('replays the original response for a retried key and never double-books', async () => {
      const offer = await searchOffer(dayAhead(17));
      const key = randomUUID();
      const body = holdBody(offer);

      const first = await createHold('owner-idem', body, key).expect(201);
      const again = await createHold('owner-idem', body, key).expect(201);
      expect(again.body).toEqual(first.body);
      expect(await ds.getRepository(FlightHold).count({ where: { ownerId: 'owner-idem' } })).toBe(1);

      const seg = offer.itineraries[0].segments[0].segmentId;
      const before = (await vuelo(seg)).asientosDisponibles;
      await createHold('owner-idem', body, key).expect(201);
      expect((await vuelo(seg)).asientosDisponibles).toBe(before); // a replay takes no more seats
    });

    it('rejects the same key with a different payload (422) and requires the header (400)', async () => {
      const offer = await searchOffer(dayAhead(17));
      const key = randomUUID();
      await createHold('owner-idem2', holdBody(offer, 'LIGHT'), key).expect(201);

      const reuse = await createHold('owner-idem2', holdBody(offer, 'FULL'), key).expect(422);
      expect(reuse.body.code).toBe('VALIDATION_FAILED');

      await api().post('/api/v1/offers/hold').set(auth('owner-idem2')).send(holdBody(offer)).expect(400);
    });

    it('does not let another user replay a stored response with the same key', async () => {
      const offer = await searchOffer(dayAhead(17));
      const key = randomUUID();
      const mine = await createHold('owner-a', holdBody(offer), key).expect(201);
      const theirs = await createHold('owner-b', holdBody(offer), key).expect(201);
      expect(theirs.body.holdId).not.toBe(mine.body.holdId);
    });

    it('survives parallel retries of one key: exactly one booking is created', async () => {
      const offer = await searchOffer(dayAhead(18));
      const hold = await createHold('owner-par', holdBody(offer)).expect(201);
      const key = randomUUID();
      const before = await bookingCount();

      const results = await Promise.all(
        Array.from({ length: 4 }, () => createBooking('owner-par', hold.body.holdId, [pax('a1')], 'pay_parallel_01', key)),
      );

      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 201).length).toBeGreaterThanOrEqual(1);
      expect(statuses.every((s) => s === 201 || s === 409)).toBe(true);
      expect(await bookingCount()).toBe(before + 1);
      const created = results.filter((r) => r.status === 201).map((r) => r.body.bookingId);
      expect(new Set(created).size).toBe(1);
    });
  });

  describe('concurrency (C2/C3)', () => {
    it('two parallel bookings of one hold: one 201, one 409, one row', async () => {
      const offer = await searchOffer(dayAhead(19));
      const hold = await createHold('owner-race', holdBody(offer)).expect(201);
      const before = await bookingCount();

      const [a, b] = await Promise.all([
        createBooking('owner-race', hold.body.holdId, [pax('a1')], 'pay_race_00001'),
        createBooking('owner-race', hold.body.holdId, [pax('a1')], 'pay_race_00002'),
      ]);

      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(await bookingCount()).toBe(before + 1);
      expect((await holdRow(hold.body.holdId)).status).toBe('CONSUMED');
    });

    it('never oversells: with one seat left, parallel holds give one 201 and one SEAT_TAKEN', async () => {
      const flight = await ds.getRepository(Vuelo).save(
        ds.getRepository(Vuelo).create({
          aerolinea: 'Test Air',
          codigoAerolinea: 'TA',
          codigoVuelo: 'TA001',
          origenIATA: 'MDE',
          destinoIATA: 'CTG',
          fechaSalida: new Date(`${dayAhead(20)}T10:00:00.000Z`),
          fechaLlegada: new Date(`${dayAhead(20)}T11:00:00.000Z`),
          precioBase: 80,
          asientosDisponibles: 1,
          capacidadTotal: 180,
          durationMinutes: 60,
        }),
      );
      const offer = await searchOffer(dayAhead(20), ['MDE', 'CTG']);

      const [a, b] = await Promise.all([createHold('racer-1', holdBody(offer)), createHold('racer-2', holdBody(offer))]);

      expect([a.status, b.status].sort()).toEqual([201, 409]);
      const loser = a.status === 409 ? a : b;
      expect(loser.body.code).toBe('SEAT_TAKEN');
      expect((await vuelo(flight.id)).asientosDisponibles).toBe(0);

      const winner = a.status === 201 ? a : b;
      const owner = a.status === 201 ? 'racer-1' : 'racer-2';
      await api().delete(`/api/v1/offers/hold/${winner.body.holdId}`).set(auth(owner)).expect(204);
      expect((await vuelo(flight.id)).asientosDisponibles).toBe(1);
      await api().delete(`/api/v1/offers/hold/${winner.body.holdId}`).set(auth(owner)).expect(204); // idempotent
      expect((await vuelo(flight.id)).asientosDisponibles).toBe(1); // not returned twice
    });

    it('hides flights that cannot seat the whole party', async () => {
      const res = await api()
        .post('/api/v1/search')
        .set('X-Device-Fingerprint', 'it')
        .send({ itineraries: [{ origin: 'BOG', destination: 'SCL', departureDate: dayAhead(21) }], passengers: { adults: 9 } })
        .expect(200);
      // LA1500 starts with only 5 seats, so it must not be offered to a party of 9.
      const flightNumbers = res.body.offers.flatMap((o: { itineraries: { segments: { flightNumber: string }[] }[] }) => o.itineraries.flatMap((i) => i.segments.map((s) => s.flightNumber)));
      expect(flightNumbers).not.toContain('LA1500');
    });
  });

  describe('hold lifecycle (A9/M2)', () => {
    it('expires an overdue hold on read and gives its seat back', async () => {
      const offer = await searchOffer(dayAhead(22));
      const seg = offer.itineraries[0].segments[0].segmentId;
      const before = (await vuelo(seg)).asientosDisponibles;
      const hold = await createHold('owner-exp', holdBody(offer)).expect(201);

      await ds.query(`UPDATE "${ctx.schema}"."vuelos_flight_holds" SET "expiresAt" = $1 WHERE "holdId" = $2`, [new Date(Date.now() - 60_000), hold.body.holdId]);

      const status = await api().get(`/api/v1/offers/hold/${hold.body.holdId}`).set(auth('owner-exp')).expect(200);
      expect(status.body).toMatchObject({ status: 'EXPIRED', remainingSeconds: 0 });
      expect((await vuelo(seg)).asientosDisponibles).toBe(before);

      await api().delete(`/api/v1/offers/hold/${hold.body.holdId}`).set(auth('owner-exp')).expect(410);
    });

    it('answers 410 when booking an expired hold and still restores the seat', async () => {
      const offer = await searchOffer(dayAhead(22));
      const seg = offer.itineraries[0].segments[0].segmentId;
      const before = (await vuelo(seg)).asientosDisponibles;
      const hold = await createHold('owner-exp2', holdBody(offer)).expect(201);
      await ds.query(`UPDATE "${ctx.schema}"."vuelos_flight_holds" SET "expiresAt" = $1 WHERE "holdId" = $2`, [new Date(Date.now() - 60_000), hold.body.holdId]);

      const res = await createBooking('owner-exp2', hold.body.holdId, [pax('a1')], 'pay_expired_01').expect(410);
      expect(res.body.code).toBe('QUOTE_EXPIRED');
      expect((await holdRow(hold.body.holdId)).status).toBe('EXPIRED');
      expect((await vuelo(seg)).asientosDisponibles).toBe(before);
    });

    it('the sweeper expires holds nobody touched and restores their seats', async () => {
      const offer = await searchOffer(dayAhead(23));
      const seg = offer.itineraries[0].segments[0].segmentId;
      const before = (await vuelo(seg)).asientosDisponibles;
      const hold = await createHold('owner-sweep', holdBody(offer)).expect(201);
      await ds.query(`UPDATE "${ctx.schema}"."vuelos_flight_holds" SET "expiresAt" = $1 WHERE "holdId" = $2`, [new Date(Date.now() - 60_000), hold.body.holdId]);

      expect(await app.get(OffersService).expireDueHolds()).toBeGreaterThanOrEqual(1);
      expect((await holdRow(hold.body.holdId)).status).toBe('EXPIRED');
      expect((await vuelo(seg)).asientosDisponibles).toBe(before);
    });

    it('refuses to release a consumed hold (409) so a confirmed booking keeps its trace', async () => {
      const { hold } = await bookOne('owner-cons', dayAhead(24), 'pay_consumed_01');
      await api().delete(`/api/v1/offers/hold/${hold.holdId}`).set(auth('owner-cons')).expect(409);
      expect((await holdRow(hold.holdId)).status).toBe('CONSUMED');
    });
  });

  describe('ownership (C1/IDOR)', () => {
    it('blocks other users from reading or releasing someone else’s hold and booking', async () => {
      const { hold, booking } = await bookOne('owner-A', dayAhead(25), 'pay_idor_00001');
      const offer = await searchOffer(dayAhead(25));
      const liveHold = await createHold('owner-A', holdBody(offer)).expect(201);

      await api().get(`/api/v1/bookings/${booking.bookingId}`).set(auth('owner-B')).expect(403);
      await api().get(`/api/v1/bookings/${booking.bookingId}/tickets`).set(auth('owner-B')).expect(403);
      await api().get(`/api/v1/bookings/${booking.bookingId}/tickets/${booking.tickets[0].ticketId}`).set(auth('owner-B')).expect(403);
      await api().get(`/api/v1/offers/hold/${hold.holdId}`).set(auth('owner-B')).expect(403);
      await api().delete(`/api/v1/offers/hold/${liveHold.body.holdId}`).set(auth('owner-B')).expect(403);
      await createBooking('owner-B', liveHold.body.holdId, [pax('a1')], 'pay_idor_00002').expect(403);

      expect((await holdRow(liveHold.body.holdId)).status).toBe('HELD'); // untouched by the intruder
      const mine = await api().get('/api/v1/bookings').set(auth('owner-B')).expect(200);
      expect(mine.body.items).toEqual([]);
    });
  });

  describe('booking validation (A6/B5)', () => {
    it('rejects reusing a paymentReference and rolls the second booking back completely', async () => {
      await bookOne('owner-pay', dayAhead(26), 'pay_reused_0001');
      const offer = await searchOffer(dayAhead(26));
      const hold = await createHold('owner-pay', holdBody(offer)).expect(201);
      const before = await bookingCount();

      const res = await createBooking('owner-pay', hold.body.holdId, [pax('a1')], 'pay_reused_0001').expect(409);
      expect(res.body.code).toBe('PAYMENT_REFERENCE_INVALID');
      expect(await bookingCount()).toBe(before);
      expect((await holdRow(hold.body.holdId)).status).toBe('HELD');
    });

    it('detects a seat taken by another booking (SEAT_TAKEN) without creating the second booking', async () => {
      const date = dayAhead(27);
      const offer1 = await searchOffer(date);
      const seg = offer1.itineraries[0].segments[0].segmentId;
      const h1 = await createHold('owner-s1', holdBody(offer1)).expect(201);
      await createBooking('owner-s1', h1.body.holdId, [pax('a1', { assignedSeats: [{ segmentId: seg, seatNumber: '20A' }] })], 'pay_seat_000001').expect(201);

      const offer2 = await searchOffer(date);
      const h2 = await createHold('owner-s2', holdBody(offer2)).expect(201);
      const before = await bookingCount();
      const res = await createBooking('owner-s2', h2.body.holdId, [pax('a2', { assignedSeats: [{ segmentId: seg, seatNumber: '20A' }] })], 'pay_seat_000002').expect(409);

      expect(res.body.code).toBe('SEAT_TAKEN');
      expect(await bookingCount()).toBe(before);
      expect((await holdRow(h2.body.holdId)).status).toBe('HELD');
    });

    it('applies the passenger rules: party must match the hold, ages, infants, duplicates, field formats', async () => {
      const offer = await searchOffer(dayAhead(28), ['BOG', 'SCL'], { adults: 1, infants: 1 });
      const hold = await createHold('owner-rules', holdBody(offer, 'LIGHT', { adults: 1, infants: 1 })).expect(201);
      const infant = pax('i1', { passengerType: 'INFANT', birthDate: dayAhead(-200), associatedAdultId: 'a1', documentNumber: 'INFANT0001' });

      // missing the infant
      await createBooking('owner-rules', hold.body.holdId, [pax('a1')], 'pay_rules_00001').expect(422);
      // infant not linked to an adult
      await createBooking('owner-rules', hold.body.holdId, [pax('a1'), { ...infant, associatedAdultId: undefined }], 'pay_rules_00002').expect(422);
      // adult declared but born last year
      await createBooking('owner-rules', hold.body.holdId, [pax('a1', { birthDate: dayAhead(-300) }), infant], 'pay_rules_00003').expect(422);
      // seat for a lap infant
      await createBooking('owner-rules', hold.body.holdId, [pax('a1'), { ...infant, assignedSeats: [{ segmentId: offer.itineraries[0].segments[0].segmentId, seatNumber: '3B' }] }], 'pay_rules_00004').expect(422);
      // malformed email / phone / enum / paymentReference
      const bad = await createBooking('owner-rules', hold.body.holdId, [pax('a1', { contact: { email: 'nope', phone: '12' }, gender: 'Q' }), infant], 'x').expect(400);
      expect(bad.body.invalidParams.map((p: { name: string }) => p.name).join(' ')).toMatch(/email|phone|gender|paymentReference/);

      // and the valid party goes through
      await createBooking('owner-rules', hold.body.holdId, [pax('a1'), infant], 'pay_rules_00005').expect(201);
    });
  });

  describe('second audit fixes', () => {
    it('refuses a premium cabin instead of selling it at economy fares (A1)', async () => {
      const offer = await searchOffer(dayAhead(31));
      const body = holdBody(offer);
      body.itinerarySelections = body.itinerarySelections.map((s) => ({ ...s, cabinClass: 'BUSINESS' }));
      const res = await createHold('owner-a1', body).expect(422);
      expect(res.body.invalidParams[0].name).toBe('itinerarySelections.cabinClass');
    });

    it('stores the extra baggage bought with the booking, within the limits (A2)', async () => {
      const offer = await searchOffer(dayAhead(32));
      const itineraryId = offer.itineraries[0].itineraryId;
      const hold = await createHold('owner-a2', holdBody(offer)).expect(201);

      // A leg that is not part of the hold, and more bags than the cap, are refused and nothing is consumed.
      const strange = await createBooking('owner-a2', hold.body.holdId, [pax('a1', { extraBaggage: [{ itineraryId: randomUUID(), quantity: 1 }] })], 'pay_bag_000001').expect(422);
      expect(strange.body.invalidParams[0].name).toBe('passengers.extraBaggage.itineraryId');
      const tooMany = await createBooking('owner-a2', hold.body.holdId, [pax('a1', { extraBaggage: [{ itineraryId, quantity: 3 }] })], 'pay_bag_000002').expect(409);
      expect(tooMany.body.code).toBe('BAGGAGE_LIMIT_EXCEEDED');
      expect((await holdRow(hold.body.holdId)).status).toBe('HELD');

      const booked = await createBooking('owner-a2', hold.body.holdId, [pax('a1', { extraBaggage: [{ itineraryId, quantity: 2 }] })], 'pay_bag_000003').expect(201);
      const rows = await ds.getRepository(BaggagePurchase).find({ where: { bookingId: booked.body.bookingId } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ quantity: 2, unitPriceMinor: 4000, totalMinor: 8000, paymentReference: 'pay_bag_000003' });

      const options = await api().get(`/api/v1/bookings/${booked.body.bookingId}/baggage-options`).set(auth('owner-a2')).expect(200);
      expect(options.body[0]).toMatchObject({ passengerId: 'a1', itineraryId, alreadyPurchased: 2, maxAllowed: 2 });
    });

    it('does not confirm a hold whose flight has already departed (A8)', async () => {
      const offer = await searchOffer(dayAhead(33));
      const hold = await createHold('owner-a8', holdBody(offer)).expect(201);
      const { vueloId } = (await holdRow(hold.body.holdId)).inventory[0];
      await ds.getRepository(Vuelo).update({ id: vueloId }, { fechaSalida: new Date(Date.now() - 3_600_000), fechaLlegada: new Date(Date.now() + 3_600_000) });

      const res = await createBooking('owner-a8', hold.body.holdId, [pax('a1')], 'pay_late_000001').expect(410);
      expect(res.body.code).toBe('OFFER_NO_LONGER_AVAILABLE');
      expect(await ds.getRepository(Booking).count({ where: { ownerId: 'owner-a8' } })).toBe(0);
    });

    it('requires an Idempotency-Key on every write after the sale (A9)', async () => {
      const id = randomUUID();
      const body = { quoteId: randomUUID(), reason: 'Change of plans' };
      for (const [path, payload] of [
        [`/api/v1/bookings/${id}/cancel`, body],
        [`/api/v1/bookings/${id}/baggage`, { passengerId: 'a1', itineraryId: randomUUID(), quantity: 1, payment: { paymentReference: 'pay_0000001' } }],
        [`/api/v1/bookings/${id}/date-change`, { changeOfferId: randomUUID() }],
      ] as [string, object][]) {
        const res = await api().post(path).set(auth('u1')).send(payload);
        expect(res.status).toBe(400);
      }
    });

    it('stores passenger identity and contact data encrypted (C1)', async () => {
      await bookOne('owner-c1', dayAhead(34), 'pay_pii_0000001');
      const rows: Record<string, string>[] = await ds.query(
        `SELECT "firstName", "lastName", "documentNumber", "birthDate", "contactEmail", "contactPhone" FROM "${ctx.schema}"."vuelos_passengers"`,
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        for (const value of Object.values(row)) expect(value.startsWith('v1:')).toBe(true);
      }
      const dump = JSON.stringify(rows);
      expect(dump).not.toContain('Tapia');
      expect(dump).not.toContain('example.com');
    });
  });

  describe('listing (A4/M3)', () => {
    it('paginates by cursor, filters, and validates its query', async () => {
      const owner = 'owner-list';
      const made: string[] = [];
      for (let i = 0; i < 3; i++) {
        const { booking } = await bookOne(owner, dayAhead(30 + i), `pay_list_0000${i}`);
        made.push(booking.bookingId);
      }

      const page1 = await api().get('/api/v1/bookings').query({ limit: 2 }).set(auth(owner)).expect(200);
      expect(page1.body.items).toHaveLength(2);
      expect(page1.body.nextCursor).toBeDefined();
      expect(page1.body.items[0]).toMatchObject({ origin: 'BOG', destination: 'SCL', status: 'CONFIRMED' });

      const page2 = await api().get('/api/v1/bookings').query({ limit: 2, cursor: page1.body.nextCursor }).set(auth(owner)).expect(200);
      expect(page2.body.items).toHaveLength(1);
      expect(page2.body.nextCursor).toBeUndefined();

      const ids = [...page1.body.items, ...page2.body.items].map((b: { bookingId: string }) => b.bookingId);
      expect(new Set(ids)).toEqual(new Set(made));

      const byPnr = await api().get('/api/v1/bookings').query({ pnr: page1.body.items[0].pnr.toLowerCase() }).set(auth(owner)).expect(200);
      expect(byPnr.body.items).toHaveLength(1);
      const future = await api().get('/api/v1/bookings').query({ createdFrom: dayAhead(2) }).set(auth(owner)).expect(200);
      expect(future.body.items).toEqual([]);

      await api().get('/api/v1/bookings').query({ limit: 51 }).set(auth(owner)).expect(400);
      await api().get('/api/v1/bookings').query({ limit: 0 }).set(auth(owner)).expect(400);
      await api().get('/api/v1/bookings').query({ status: 'WRONG' }).set(auth(owner)).expect(400);
      await api().get('/api/v1/bookings').query({ cursor: 'garbage' }).set(auth(owner)).expect(400);
    });
  });

  describe('flight status (C4)', () => {
    it('honours the requested date and rejects missing or invalid input', async () => {
      const d1 = dayAhead(33);
      const d2 = dayAhead(34);
      const s1 = await api().get('/api/v1/flights/LA800/status').query({ date: d1 }).expect(200);
      const s2 = await api().get('/api/v1/flights/la800/status').query({ date: d2 }).expect(200);

      expect(s1.body.departure.scheduledAt.startsWith(d1)).toBe(true);
      expect(s2.body.departure.scheduledAt.startsWith(d2)).toBe(true);
      expect(s1.body.status).toBe('SCHEDULED');

      const none = await api().get('/api/v1/flights/LA800/status').query({ date: '2020-01-01' }).expect(404);
      expect(none.body.code).toBe('FLIGHT_STATUS_NOT_AVAILABLE');
      const noDate = await api().get('/api/v1/flights/LA800/status').expect(200); // date optional: next departure
      expect(noDate.body.flightNumber).toBe('LA800');
      await api().get('/api/v1/flights/LA800/status').query({ date: 'tomorrow' }).expect(400);
      await api().get('/api/v1/flights/NOT-A-FLIGHT/status').query({ date: d1 }).expect(400);
    });
  });
});
