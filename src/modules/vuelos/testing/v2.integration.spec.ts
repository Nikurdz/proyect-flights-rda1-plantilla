import { randomUUID } from 'node:crypto';
import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { signWebhookBodyV2 } from '../common/safe-http';
import { Vuelo } from '../entities/vuelo.entity';
import { WebhookSubscription, WebhookSubscriptionEvent } from '../entities/webhook-subscription.entity';
import { seedFlights } from '../seed/flights.seed';
import { DomainEventBus } from '../common/domain-event-bus';
import { WebhookDispatcherService } from '../services/webhook-dispatcher.service';
import { PartnerAuthService } from '../v2/auth/partner-auth.service';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(180_000);

const V2 = '/api/v2/vuelos';
const dayAhead = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const CLIENT = 'booking-prototipo';
const SECRET = 'a-partner-secret-of-24-chars!';

describeIntegration('Contract v2 (/api/v2/vuelos) against a real Postgres', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let ds: DataSource;
  let server: http.Server;
  let hookUrl: string;
  const received: { headers: http.IncomingHttpHeaders; body: string }[] = [];
  let day = 5;

  const api = () => request(app.getHttpServer());

  async function tokenFor(scope?: string): Promise<string> {
    const res = await api()
      .post('/api/v2/oauth2/token')
      .type('form')
      .send({ grant_type: 'client_credentials', client_id: CLIENT, client_secret: SECRET, ...(scope ? { scope } : {}) })
      .expect(200);
    return res.body.access_token as string;
  }
  const bearer = (token: string, userId?: string) => ({ Authorization: `Bearer ${token}`, ...(userId ? { 'X-User-Id': userId } : {}) });

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

  async function searchOffer(date: string, origin = 'BOG', destination = 'SCL') {
    const res = await api()
      .post(`${V2}/search`)
      .set('X-Device-Fingerprint', 'it-device')
      .send({ itineraries: [{ origin, destination, departureDate: date }], passengers: { adults: 1 } })
      .expect(200);
    return res.body.offers[0] as { offerId: string; itineraries: { itineraryId: string }[] };
  }

  async function hold(token: string, userId: string, date: string, extra: Record<string, unknown> = {}) {
    const offer = await searchOffer(date);
    const key = randomUUID();
    const body = {
      offerId: offer.offerId,
      itinerarySelections: offer.itineraries.map((i) => ({ itineraryId: i.itineraryId, cabinClass: 'ECONOMY', fareBrand: 'FULL' })),
      passengersBreakdown: { adults: 1 },
      ...extra,
    };
    const res = await api().post(`${V2}/offers/hold`).set(bearer(token, userId)).set('Idempotency-Key', key).send(body);
    return { res, key, body, offer };
  }

  async function book(token: string, userId: string, holdId: string, overrides: Record<string, unknown> = {}) {
    return api()
      .post(`${V2}/bookings`)
      .set(bearer(token, userId))
      .set('Idempotency-Key', randomUUID())
      .send({ holdId, passengers: [pax('a1')], payment: { paymentReference: `pay_${randomUUID().slice(0, 12)}` }, ...overrides });
  }

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let data = '';
      req.on('data', (c) => (data += c));
      req.on('end', () => {
        received.push({ headers: req.headers, body: data });
        res.statusCode = 200;
        res.end('ok');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    hookUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;

    ctx = await createIntegrationApp({ WEBHOOKS_ALLOW_PRIVATE_HOSTS: 'true' });
    app = ctx.app;
    ds = ctx.dataSource;
    await seedFlights(ds);
    await app.get(PartnerAuthService).upsert(CLIENT, SECRET);
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await ctx?.close();
  });

  describe('PartnerOAuth2 and errors', () => {
    it('issues a token only to a client that proves its secret, limited to the scopes it asks for', async () => {
      const wrong = await api().post('/api/v2/oauth2/token').type('form').send({ grant_type: 'client_credentials', client_id: CLIENT, client_secret: 'nope-nope-nope-nope-nope' });
      expect(wrong.status).toBe(401);
      expect(wrong.body.error).toBe('invalid_client');
      expect((await api().post('/api/v2/oauth2/token').type('form').send({ grant_type: 'password' })).body.error).toBe('unsupported_grant_type');

      const ok = await api().post('/api/v2/oauth2/token').type('form').send({ grant_type: 'client_credentials', client_id: CLIENT, client_secret: SECRET, scope: 'flights:read' }).expect(200);
      expect(ok.body).toMatchObject({ token_type: 'Bearer', scope: 'flights:read' });
      expect(ok.headers['cache-control']).toBe('no-store');

      // HTTP Basic works too, and asking for a scope the client does not have is refused.
      const basic = `Basic ${Buffer.from(`${CLIENT}:${SECRET}`).toString('base64')}`;
      await api().post('/api/v2/oauth2/token').set('Authorization', basic).type('form').send({ grant_type: 'client_credentials' }).expect(200);
      await app.get(PartnerAuthService).upsert('read-only-client', 'another-secret-of-24-chars!!', ['flights:read']);
      const outside = await api().post('/api/v2/oauth2/token').type('form').send({ grant_type: 'client_credentials', client_id: 'read-only-client', client_secret: 'another-secret-of-24-chars!!', scope: 'flights:book' });
      expect(outside.body.error).toBe('invalid_scope');
    });

    it('answers ProblemDetails v2 (instance, correlation_id, timestamp) and echoes the correlation id, also on 401 and 403', async () => {
      const correlation = 'corr-vuelos-test-1';
      const anonymous = await api().get(`${V2}/bookings`).set('X-Correlation-Id', correlation);
      expect(anonymous.status).toBe(401);
      expect(anonymous.headers['content-type']).toContain('application/problem+json');
      expect(anonymous.headers['x-correlation-id']).toBe(correlation);
      expect(anonymous.headers['x-request-id']).toBeDefined();
      expect(anonymous.body).toMatchObject({ code: 'UNAUTHORIZED', instance: `${V2}/bookings`, correlation_id: correlation });
      expect(new Date(anonymous.body.timestamp).toString()).not.toBe('Invalid Date');

      const readOnly = await tokenFor('flights:read');
      const forbidden = await api().post(`${V2}/offers/hold`).set(bearer(readOnly, 'u1')).set('Idempotency-Key', randomUUID()).send({});
      expect(forbidden.status).toBe(403);
      expect(forbidden.body).toMatchObject({ code: 'FORBIDDEN', instance: `${V2}/offers/hold` });
      expect(forbidden.body.correlation_id).toBe(forbidden.headers['x-correlation-id']);
    });

    it('keeps /api/v1 exactly as it was: v1 tokens do not work as partner tokens and v1 errors stay v1', async () => {
      const v1 = await api().get('/api/v1/bookings');
      expect(v1.status).toBe(401);
      expect(v1.body.instance).toBeUndefined();
    });
  });

  describe('booking flow with a partner token', () => {
    it('holds with a chosen ttl, replays idempotently (200 + Idempotent-Replayed), and rejects a reused key with 409', async () => {
      const token = await tokenFor();
      const created = await hold(token, 'user-1', dayAhead(day++), { ttlMinutes: 10 });
      expect(created.res.status).toBe(201);
      expect(created.res.headers['x-request-id']).toBeDefined();
      expect(created.res.body).toMatchObject({ status: 'HELD', ttlMinutes: 10 });
      expect(created.res.body._links.release).toMatchObject({ method: 'DELETE' });

      const replay = await api().post(`${V2}/offers/hold`).set(bearer(token, 'user-1')).set('Idempotency-Key', created.key).send(created.body);
      expect(replay.status).toBe(200);
      expect(replay.headers['idempotent-replayed']).toBe('true');
      expect(replay.body.holdId).toBe(created.res.body.holdId);

      const reused = await api().post(`${V2}/offers/hold`).set(bearer(token, 'user-1')).set('Idempotency-Key', created.key).send({ ...created.body, passengersBreakdown: { adults: 2 } });
      expect(reused.status).toBe(409);
      expect(reused.body.code).toBe('IDEMPOTENCY_KEY_REUSED');

      const tooLong = await hold(token, 'user-1', dayAhead(day++), { ttlMinutes: 90 });
      expect(tooLong.res.status).toBe(400);

      // Releasing twice is fine; a hold that already expired answers 204 too.
      await api().delete(`${V2}/offers/hold/${created.res.body.holdId}`).set(bearer(token, 'user-1')).expect(204);
      await api().delete(`${V2}/offers/hold/${created.res.body.holdId}`).set(bearer(token, 'user-1')).expect(204);
    });

    it('books with the sales channel, checks the amount, keeps users apart and serves v2 tickets', async () => {
      const token = await tokenFor();
      const date = dayAhead(day++);
      const held = await hold(token, 'user-2', date);
      const holdId = held.res.body.holdId as string;

      const wrongAmount = await book(token, 'user-2', holdId, { payment: { paymentReference: `pay_${randomUUID().slice(0, 12)}`, amount: { currency: 'USD', total: '1.00' } } });
      expect(wrongAmount.status).toBe(409);
      expect(wrongAmount.body.code).toBe('AMOUNT_MISMATCH');

      // BOG-SCL crosses a border: v2 wants a passport (v1 does not check it).
      const nationalId = await book(token, 'user-2', holdId, { passengers: [pax('a1', { documentType: 'NATIONAL_ID' })] });
      expect(nationalId.status).toBe(422);
      expect(nationalId.body.code).toBe('PASSPORT_REQUIRED_INTERNATIONAL');

      const booked = await book(token, 'user-2', holdId, {
        payment: { paymentReference: `pay_${randomUUID().slice(0, 12)}`, amount: held.res.body.lockedPrice, provider: 'BOOKING_PROTOTIPO' },
        salesChannel: { partnerId: 'booking', partnerOrderId: 'ORD-9', packageId: null, promotionApplied: false },
      });
      expect(booked.status).toBe(201);
      expect(booked.body).toMatchObject({ status: 'CONFIRMED', holdId, salesChannel: { partnerOrderId: 'ORD-9', promotionApplied: false } });
      expect(booked.body._links.cancel).toBeDefined();
      const bookingId = booked.body.bookingId as string;

      // Another user of the same partner cannot see it; the same user can.
      expect((await api().get(`${V2}/bookings/${bookingId}`).set(bearer(token, 'user-3'))).status).toBe(403);
      await api().get(`${V2}/bookings/${bookingId}`).set(bearer(token, 'user-2')).expect(200);
      const list = await api().get(`${V2}/bookings`).set(bearer(token, 'user-2')).expect(200);
      expect(list.body.items.some((b: { bookingId: string }) => b.bookingId === bookingId)).toBe(true);
      expect(list.body.nextCursor).toBeNull();

      const tickets = await api().get(`${V2}/bookings/${bookingId}/tickets`).set(bearer(token, 'user-2')).expect(200);
      expect(tickets.body).toHaveLength(1);
      expect(tickets.body[0]).toMatchObject({ passengerId: 'a1', passengerName: 'Namea1 Tapia', status: 'ISSUED' });
      expect(tickets.body[0].qrPayload).toBeUndefined();
      expect(tickets.body[0].segments[0]).toMatchObject({ departureIataCode: 'BOG', arrivalIataCode: 'SCL', status: 'ISSUED' });
      const ticket = await api().get(`${V2}/bookings/${bookingId}/tickets/${tickets.body[0].ticketId}`).set(bearer(token, 'user-2')).expect(200);
      expect(ticket.body.eTicketNumber).toBe(tickets.body[0].eTicketNumber);

      // Issuing again is a no-op: already issued answers 200 with issued 0.
      const again = await api().post(`${V2}/bookings/${bookingId}/tickets`).set(bearer(token, 'user-2')).expect(200);
      expect(again.body).toMatchObject({ issued: 0, status: 'CONFIRMED' });
      expect(again.body.tickets).toHaveLength(1);
    });

    it('changes seats atomically (swap), shows the status per seat, and refuses infants, other cabins and taken seats', async () => {
      const token = await tokenFor();
      const date = dayAhead(day++);
      const held = await hold(token, 'user-4', date);
      const booked = await book(token, 'user-4', held.res.body.holdId);
      const bookingId = booked.body.bookingId as string;
      const segment = (await api().get(`${V2}/bookings/${bookingId}/tickets`).set(bearer(token, 'user-4'))).body[0].segments[0].segmentId as string;

      const move = await api().put(`${V2}/bookings/${bookingId}/seats`).set(bearer(token, 'user-4')).set('Idempotency-Key', randomUUID()).send({ seats: [{ passengerId: 'a1', segmentId: segment, seatNumber: '14C' }] });
      expect(move.status).toBe(200);
      expect(move.body.seats[0]).toMatchObject({ seatNumber: '14C', previousSeatNumber: null, status: 'TICKETED' });
      expect(move.body.amountCharged.total).toBe('0.00');

      const map = await api().get(`${V2}/offers/${held.offer.offerId}/seatmap`).query({ segmentId: segment }).expect(200);
      const seats = map.body.cabins[0].rows.flatMap((r: { seats: { seatNumber: string; status: string; isAvailable: boolean }[] }) => r.seats);
      expect(seats.find((s: { seatNumber: string }) => s.seatNumber === '14C')).toMatchObject({ status: 'TICKETED', isAvailable: false });
      expect(seats.find((s: { seatNumber: string }) => s.seatNumber === '14D').status).toBe('AVAILABLE');

      const other = await api().put(`${V2}/bookings/${bookingId}/seats`).set(bearer(token, 'user-4')).set('Idempotency-Key', randomUUID()).send({ seats: [{ passengerId: 'a1', segmentId: segment, seatNumber: '14D' }] }).expect(200);
      expect(other.body.seats[0].previousSeatNumber).toBe('14C');
      const freed = (await api().get(`${V2}/offers/${held.offer.offerId}/seatmap`).query({ segmentId: segment }).expect(200)).body.cabins[0].rows.flatMap((r: { seats: { seatNumber: string; status: string }[] }) => r.seats);
      expect(freed.find((s: { seatNumber: string }) => s.seatNumber === '14C').status).toBe('AVAILABLE');

      const nonexistent = await api().put(`${V2}/bookings/${bookingId}/seats`).set(bearer(token, 'user-4')).set('Idempotency-Key', randomUUID()).send({ seats: [{ passengerId: 'a1', segmentId: segment, seatNumber: '99F' }] });
      expect(nonexistent.status).toBe(422);
      expect(nonexistent.body.code).toBe('SEAT_CABIN_MISMATCH');

      // A seat held by another booking is taken, and the first booking keeps its seat (all or none).
      const heldB = await hold(token, 'user-5', date);
      const bookedB = await book(token, 'user-5', heldB.res.body.holdId);
      await api().put(`${V2}/bookings/${bookedB.body.bookingId}/seats`).set(bearer(token, 'user-5')).set('Idempotency-Key', randomUUID()).send({ seats: [{ passengerId: 'a1', segmentId: segment, seatNumber: '14C' }] }).expect(200);
      const taken = await api().put(`${V2}/bookings/${bookingId}/seats`).set(bearer(token, 'user-4')).set('Idempotency-Key', randomUUID()).send({ seats: [{ passengerId: 'a1', segmentId: segment, seatNumber: '14C' }] });
      expect(taken.status).toBe(409);
      expect(taken.body.code).toBe('SEAT_TAKEN');
      const kept = (await api().get(`${V2}/bookings/${bookingId}/tickets`).set(bearer(token, 'user-4')).expect(200)).body[0].segments[0].seatNumber;
      expect(kept).toBe('14D');
    });

    it('cancels without a quote: the airline computes the refund and reports the inventory it restored', async () => {
      const token = await tokenFor();
      const held = await hold(token, 'user-6', dayAhead(day++));
      const booked = await book(token, 'user-6', held.res.body.holdId);
      const bookingId = booked.body.bookingId as string;
      const vueloId = (await ds.query(`SELECT i."vueloId" FROM "${ctx.schema}"."vuelos_flight_hold_items" i WHERE i."holdId" = $1`, [held.res.body.holdId]))[0].vueloId as string;
      const before = (await ds.getRepository(Vuelo).findOneByOrFail({ id: vueloId })).asientosDisponibles;

      const key = randomUUID();
      const cancelled = await api().post(`${V2}/bookings/${bookingId}/cancel`).set(bearer(token, 'user-6')).set('Idempotency-Key', key).send({ reasonCode: 'CUSTOMER_REQUEST' });
      expect(cancelled.status).toBe(200);
      expect(cancelled.body).toMatchObject({ bookingId, status: 'CANCELLED', reasonCode: 'CUSTOMER_REQUEST' });
      expect(cancelled.body.refund).toMatchObject({ status: 'CALCULATED', currency: 'USD' });
      expect(cancelled.body.refund.originalPaymentReference).toBeDefined();
      expect(cancelled.body.inventoryRestoration).toMatchObject({ status: 'RESTORED', seatsReleased: 1, newSeatStatus: 'AVAILABLE' });
      expect(cancelled.body.ticketsVoided).toHaveLength(1);
      expect((await ds.getRepository(Vuelo).findOneByOrFail({ id: vueloId })).asientosDisponibles).toBe(before + 1);

      const replay = await api().post(`${V2}/bookings/${bookingId}/cancel`).set(bearer(token, 'user-6')).set('Idempotency-Key', key).send({ reasonCode: 'CUSTOMER_REQUEST' });
      expect(replay.status).toBe(200);
      expect(replay.headers['idempotent-replayed']).toBe('true');

      const second = await api().post(`${V2}/bookings/${bookingId}/cancel`).set(bearer(token, 'user-6')).set('Idempotency-Key', randomUUID()).send({});
      expect(second.status).toBe(409);
      expect(second.body.code).toBe('ALREADY_CANCELLED');
    });
  });

  describe('promotions agreement', () => {
    it('is 404 until the airline answers, is written with flights:admin, and bounds the discount of a sale', async () => {
      const token = await tokenFor();
      await api().get(`${V2}/promociones/contrato`).set(bearer(token)).expect(404);
      const readOnly = await tokenFor('flights:read');
      await api().put(`${V2}/promociones/contrato`).set(bearer(readOnly)).set('Idempotency-Key', randomUUID()).send({ permite_promociones: true, porcentaje_descuento_maximo: 10 }).expect(403);

      const put = await api()
        .put(`${V2}/promociones/contrato`)
        .set(bearer(token))
        .set('Idempotency-Key', randomUUID())
        .send({ permite_promociones: true, porcentaje_descuento_maximo: 12.5, rutas_habilitadas: ['BOG-SCL'], cabinas_habilitadas: ['ECONOMY'], destinos_habilitados: ['SCL'] });
      expect(put.status).toBe(200);
      expect(put.body).toMatchObject({ vertical: 'VUELOS', permite_promociones: true, porcentaje_descuento_maximo: 12.5, rutas_habilitadas: ['BOG-SCL'] });
      expect((await api().get(`${V2}/promociones/contrato`).set(bearer(readOnly)).expect(200)).body.cabinas_habilitadas).toEqual(['ECONOMY']);

      const held = await hold(token, 'user-7', dayAhead(day++));
      const over = await book(token, 'user-7', held.res.body.holdId, { salesChannel: { partnerId: 'booking', promotionApplied: true, discountPercentage: 40 } });
      expect(over.status).toBe(422);
      expect(over.body.code).toBe('PROMOTION_DISCOUNT_OUT_OF_RANGE');
      const within = await book(token, 'user-7', held.res.body.holdId, { salesChannel: { partnerId: 'booking', promotionApplied: true, discountPercentage: 10 } });
      expect(within.status).toBe(201);
      expect(within.body.salesChannel).toMatchObject({ promotionApplied: true, discountPercentage: 10 });
    });
  });

  describe('operations', () => {
    it('needs flights:ops, validates transitions, records a delay and lists occupancy', async () => {
      const token = await tokenFor();
      const readOnly = await tokenFor('flights:read');
      const date = dayAhead(day++);
      const flight = await ds.getRepository(Vuelo).createQueryBuilder('v').where('v."fechaSalida" >= :s AND v."fechaSalida" < :e', { s: `${date}T00:00:00Z`, e: `${date}T23:59:59Z` }).getOneOrFail();

      const forbidden = await api().patch(`${V2}/flights/${flight.codigoVuelo}/status`).set(bearer(readOnly)).send({ date, status: 'BOARDING' });
      expect(forbidden.status).toBe(403);

      const noEstimate = await api().patch(`${V2}/flights/${flight.codigoVuelo}/status`).set(bearer(token)).send({ date, status: 'DELAYED' });
      expect(noEstimate.status).toBe(400);

      const estimate = new Date(new Date(flight.fechaSalida).getTime() + 45 * 60_000).toISOString();
      const delayed = await api().patch(`${V2}/flights/${flight.codigoVuelo}/status`).set(bearer(token)).send({ date, status: 'DELAYED', estimatedDepartureAt: estimate, departureGate: 'B12', reason: 'Tráfico aéreo' }).expect(200);
      expect(delayed.body).toMatchObject({ previousStatus: 'SCHEDULED', flight: { status: 'DELAYED', delayMinutes: 45 } });
      expect(delayed.body.flight.departure).toMatchObject({ gate: 'B12', estimatedAt: estimate });
      expect(delayed.body.eventId).toBeDefined();

      // Public status shows it.
      const publicStatus = await api().get(`${V2}/flights/${flight.codigoVuelo}/status`).query({ date }).expect(200);
      expect(publicStatus.body).toMatchObject({ status: 'DELAYED', delayMinutes: 45 });

      // A cancelled flight cannot come back.
      await api().patch(`${V2}/flights/${flight.codigoVuelo}/status`).set(bearer(token)).send({ date, status: 'CANCELLED', reason: 'Falla técnica' }).expect(200);
      const back = await api().patch(`${V2}/flights/${flight.codigoVuelo}/status`).set(bearer(token)).send({ date, status: 'BOARDING' });
      expect(back.status).toBe(409);
      expect(back.body.code).toBe('INVALID_STATUS_TRANSITION');
      await api().patch(`${V2}/flights/ZZ9999/status`).set(bearer(token)).send({ date, status: 'BOARDING' }).expect(404);

      const ops = await api().get(`${V2}/operaciones/vuelos`).query({ date, origin: flight.origenIATA }).set(bearer(token)).expect(200);
      expect(ops.body.date).toBe(date);
      const item = ops.body.items.find((i: { flightNumber: string }) => i.flightNumber === flight.codigoVuelo);
      expect(item).toMatchObject({ status: 'CANCELLED', totalSeats: flight.capacidadTotal });
      expect(item.cabins[0].seatsByStatus).toHaveProperty('AVAILABLE');
      expect(item.alerts.map((a: { code: string }) => a.code)).toContain('CANCELLED');
      await api().get(`${V2}/operaciones/vuelos`).query({ date }).set(bearer(readOnly)).expect(403);
    });

    it('reports the node health without a token', async () => {
      const res = await api().get(`${V2}/health`).expect(200);
      expect(res.body).toMatchObject({ status: 'HEALTHY', vertical: 'VUELOS' });
      expect(res.body.dependencias[0]).toMatchObject({ nombre: 'postgresql', status: 'UP' });
    });
  });

  describe('events Booking sends us', () => {
    it('payment.confirmed issues nothing twice, package.cancelled cancels the flight part, payment.failed marks or compensates, all idempotently', async () => {
      const token = await tokenFor();
      const bus = app.get(DomainEventBus);
      const inbound = (type: string, data: Record<string, unknown>, id = randomUUID()) => bus.despachar({ id, type, schemaVersion: 1, occurredAt: new Date().toISOString(), market: null, correlationId: 'corr-booking-1', aggregateId: String(data.bookingId), payload: data });

      const held = await hold(token, 'user-9', dayAhead(day++));
      const booked = await book(token, 'user-9', held.res.body.holdId);
      const bookingId = booked.body.bookingId as string;
      const paymentReference = booked.body.paymentReference as string;

      expect((await inbound('pagos.payment.confirmed', { paymentReference, bookingId })).fallos).toBe(0);
      expect((await api().get(`${V2}/bookings/${bookingId}/tickets`).set(bearer(token, 'user-9')).expect(200)).body).toHaveLength(1);

      // An invalid payload (no bookingId nor paymentReference named) is refused before it reaches a handler.
      expect((await inbound('pagos.payment.confirmed', { paymentReference: 1 as unknown as string, bookingId })).fallos).toBe(1);

      const cancelEvent = randomUUID();
      expect((await inbound('paquetes.package.cancelled', { packageId: 'PKG-1', bookingId, reason: 'Hotel sin cupo' }, cancelEvent)).fallos).toBe(0);
      expect((await api().get(`${V2}/bookings/${bookingId}`).set(bearer(token, 'user-9')).expect(200)).body.status).toBe('CANCELLED');
      // Delivered twice: nothing more happens.
      expect((await inbound('paquetes.package.cancelled', { packageId: 'PKG-1', bookingId, reason: 'Hotel sin cupo' }, cancelEvent)).fallos).toBe(0);

      // A failed payment for a confirmed booking compensates it; for an unknown booking it only logs.
      const held2 = await hold(token, 'user-9', dayAhead(day++));
      const booked2 = await book(token, 'user-9', held2.res.body.holdId);
      expect((await inbound('pagos.payment.failed', { paymentReference: booked2.body.paymentReference, bookingId: booked2.body.bookingId, failureReason: 'card_declined' })).fallos).toBe(0);
      expect((await api().get(`${V2}/bookings/${booked2.body.bookingId}`).set(bearer(token, 'user-9')).expect(200)).body.status).toBe('CANCELLED');
      expect((await inbound('pagos.payment.failed', { paymentReference: 'pay_unknown_0001', bookingId: randomUUID() })).fallos).toBe(0);
    });
  });

  describe('events', () => {
    it('lists CloudEvents in order with a cursor, and delivers them signed over the body to a v2 webhook', async () => {
      const token = await tokenFor();
      const feed = await api().get(`${V2}/eventos`).query({ limit: 100 }).set(bearer(token)).expect(200);
      expect(feed.body.events.length).toBeGreaterThan(0);
      const sample = feed.body.events.find((e: { type: string }) => e.type.endsWith('booking.confirmed'));
      expect(sample).toMatchObject({ specversion: '1.0', source: '/aerolineas/ram-alliance/vuelos' });
      expect(sample.type).toBe('ec.edu.epn.booking.vuelos.booking.confirmed');
      expect(sample.correlationid).toBeDefined();
      expect(sample.data).toMatchObject({ status: 'CONFIRMED' });
      expect(feed.body.metadata.next_after).toMatch(/^evt-vue-\d{6}$/);

      const page1 = await api().get(`${V2}/eventos`).query({ limit: 2 }).set(bearer(token)).expect(200);
      const page2 = await api().get(`${V2}/eventos`).query({ limit: 2, after: page1.body.metadata.next_after }).set(bearer(token)).expect(200);
      expect(page2.body.events[0].id).not.toBe(page1.body.events[0].id);
      const filtered = await api().get(`${V2}/eventos`).query({ type: 'hold.created' }).set(bearer(token)).expect(200);
      expect(filtered.body.events.every((e: { type: string }) => e.type.endsWith('hold.created'))).toBe(true);

      // A partner webhook hears the events of the bookings of every one of its users. (Stored directly: registration insists on https.)
      const repo = ds.getRepository(WebhookSubscription);
      await repo.save(repo.create({ ownerId: `partner:${CLIENT}`, url: hookUrl, eventos: ['booking.confirmed'].map((evento) => ds.manager.create(WebhookSubscriptionEvent, { evento })), secret: 'a-secret-of-sixteen-chars', active: true, apiVersion: 2 }));
      received.length = 0;
      const held = await hold(token, 'user-8', dayAhead(day++));
      const booked = await book(token, 'user-8', held.res.body.holdId);
      expect(booked.status).toBe(201);
      await app.get(WebhookDispatcherService).process();
      const hit = received.find((r) => r.headers['x-webhook-event'] === 'booking.confirmed');
      expect(hit).toBeDefined();
      expect(hit!.headers['content-type']).toBe('application/cloudevents+json');
      expect(hit!.headers['x-webhook-signature']).toBe(signWebhookBodyV2('a-secret-of-sixteen-chars', hit!.body));
      const event = JSON.parse(hit!.body);
      expect(event).toMatchObject({ specversion: '1.0', type: 'ec.edu.epn.booking.vuelos.booking.confirmed' });
      expect(event.data.bookingId).toBe(booked.body.bookingId);
      expect(hit!.headers['x-correlation-id']).toBe(event.correlationid);
    });

    it('registers a v2 webhook, lists it with active/createdAt, never returns the secret, and deletes it', async () => {
      const token = await tokenFor();
      const secret = 'a-secret-of-sixteen-chars';
      const unknown = await api().post(`${V2}/webhooks`).set(bearer(token)).send({ url: hookUrl, events: ['nope'], secret });
      expect(unknown.status).toBe(400);
      const shortSecret = await api().post(`${V2}/webhooks`).set(bearer(token)).send({ url: hookUrl, events: ['hold.created'], secret: 'short' });
      expect(shortSecret.status).toBe(400);

      // This test app allows private hosts (WEBHOOKS_ALLOW_PRIVATE_HOSTS); production accepts https to public addresses only.
      const created = await api().post(`${V2}/webhooks`).set(bearer(token)).send({ url: hookUrl, events: ['hold.created', 'flight.status_changed', 'booking.seat_changed'], secret }).expect(201);
      expect(created.body).toMatchObject({ url: hookUrl, active: true, events: ['booking.seat_changed', 'flight.status_changed', 'hold.created'] });
      expect(created.body.createdAt).toBeDefined();
      expect(JSON.stringify(created.body)).not.toContain(secret);
      const listed = await api().get(`${V2}/webhooks`).set(bearer(token)).expect(200);
      expect(listed.body.some((w: { id: string }) => w.id === created.body.id)).toBe(true);
      expect(JSON.stringify(listed.body)).not.toContain(secret);
      const row = await ds.getRepository(WebhookSubscription).findOneByOrFail({ id: created.body.id });
      expect(row.apiVersion).toBe(2);
      await api().delete(`${V2}/webhooks/${created.body.id}`).set(bearer(token)).expect(204);
      await api().delete(`${V2}/webhooks/${created.body.id}`).set(bearer(token)).expect(404);
    });
  });
});
