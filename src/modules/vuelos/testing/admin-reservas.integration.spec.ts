import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { seedEcommerce } from '../ecommerce/seed/ecommerce.seed';
import { seedFlights } from '../seed/flights.seed';
import { PartnerAuthService } from '../v2/auth/partner-auth.service';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(240_000);

const V2 = '/api/v2/vuelos';
const ADMIN = { correo: 'admin@example.com', contrasena: 'AdminPass-12345' };
const CLIENT = 'booking-prototipo';
const SECRET = 'a-partner-secret-of-24-chars!';
const CEDULA = '1710034065';
const dayAhead = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/** The counter of the airline: bookings sold by a partner are seen, found by document, checked in, cancelled and their flight updated. */
describeIntegration('Admin counter: reservations of every channel against a real Postgres', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let ds: DataSource;
  let adminToken: string;
  let partnerToken: string;

  const api = () => request(app.getHttpServer());
  const bearer = (token: string, userId?: string) => ({ Authorization: `Bearer ${token}`, ...(userId ? { 'X-User-Id': userId } : {}) });
  const login = async (correo: string, contrasena: string) => (await api().post('/api/v1/auth/login').send({ correo, contrasena }).expect(200)).body.accessToken as string;

  /** A booking the way Booking sells it (v2, partner token), with a cédula and the partner's own order id. */
  async function partnerBooking(userId: string, day: number, partnerOrderId: string) {
    const search = await api().post(`${V2}/search`).set('X-Device-Fingerprint', 'it').send({ itineraries: [{ origin: 'UIO', destination: 'GYE', departureDate: dayAhead(day) }], passengers: { adults: 1 } }).expect(200);
    const offer = search.body.offers[0];
    const held = await api()
      .post(`${V2}/offers/hold`)
      .set(bearer(partnerToken, userId))
      .set('Idempotency-Key', randomUUID())
      .send({ offerId: offer.offerId, itinerarySelections: offer.itineraries.map((i: { itineraryId: string }) => ({ itineraryId: i.itineraryId, cabinClass: 'ECONOMY', fareBrand: 'FULL' })), passengersBreakdown: { adults: 1 } })
      .expect(201);
    const booked = await api()
      .post(`${V2}/bookings`)
      .set(bearer(partnerToken, userId))
      .set('Idempotency-Key', randomUUID())
      .send({
        holdId: held.body.holdId,
        passengers: [{ passengerId: 'a1', passengerType: 'ADULT', firstName: 'María José', lastName: 'Andrade Vera', documentType: 'NATIONAL_ID', documentNumber: CEDULA, nationality: 'EC', birthDate: '1990-05-05', gender: 'F', contact: { email: 'm@example.com', phone: '+593999999999' } }],
        payment: { paymentReference: `PAY-BKP-${Date.now()}-${randomUUID().slice(0, 6)}`, amount: held.body.lockedPrice, provider: 'BOOKING_PROTOTIPO' },
        salesChannel: { partnerId: 'booking', partnerOrderId, packageId: null, promotionApplied: false },
      })
      .expect(201);
    return booked.body as { bookingId: string; pnr: string };
  }

  beforeAll(async () => {
    ctx = await createIntegrationApp();
    app = ctx.app;
    ds = ctx.dataSource;
    await seedFlights(ds);
    await seedEcommerce(ds, ADMIN);
    await app.get(PartnerAuthService).upsert(CLIENT, SECRET);
    adminToken = await login(ADMIN.correo, ADMIN.contrasena);
    partnerToken = (await api().post('/api/v2/oauth2/token').type('form').send({ grant_type: 'client_credentials', client_id: CLIENT, client_secret: SECRET }).expect(200)).body.access_token;
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('is for ADMIN only: 401 anonymous, 403 guest', async () => {
    const guest = (await api().post('/api/v1/auth/invitado').expect(201)).body.accessToken as string;
    const id = randomUUID();
    for (const [method, path] of [
      ['get', '/api/v1/admin/reservas'],
      ['get', `/api/v1/admin/reservas/${id}`],
      ['post', `/api/v1/admin/reservas/${id}/check-in`],
      ['get', `/api/v1/admin/reservas/${id}/cotizacion-cancelacion`],
      ['post', `/api/v1/admin/reservas/${id}/cancelar`],
      ['patch', `/api/v1/admin/vuelos/${id}/estado`],
    ] as [string, string][]) {
      expect(((await (api() as any)[method](path).set('Idempotency-Key', randomUUID()).send({})) as request.Response).status).toBe(401);
      expect(((await (api() as any)[method](path).set(bearer(guest)).set('Idempotency-Key', randomUUID()).send({})) as request.Response).status).toBe(403);
    }
  });

  it('finds a partner booking by order, locator, payment reference, channel and the passenger document, and masks the document', async () => {
    const partnerOrderId = `ORD-BKP-${randomUUID().slice(0, 8)}`;
    const booking = await partnerBooking('user-1', 20, partnerOrderId);

    const byOrder = await api().get('/api/v1/admin/reservas').query({ partnerOrderId }).set(bearer(adminToken)).expect(200);
    expect(byOrder.body.total).toBe(1);
    const item = byOrder.body.items[0];
    expect(item).toMatchObject({ bookingId: booking.bookingId, pnr: booking.pnr, canal: 'SOCIO', status: 'CONFIRMED', paymentProvider: 'BOOKING_PROTOTIPO', socio: { partnerOrderId } });
    expect(item.paymentReference).toMatch(/^PAY-BKP-/);
    expect(item.pasajeros[0]).toMatchObject({ documento: '*******065', tipoDocumento: 'NATIONAL_ID' });
    expect(item.pasajeros[0].travellerId).toBeDefined();
    expect(JSON.stringify(item)).not.toContain(CEDULA);
    expect(item.vuelos[0]).toMatchObject({ codigoVuelo: expect.stringMatching(/^(LA|AV)\d+$/), origen: 'UIO', destino: 'GYE' }); // several carriers fly UIO-GYE

    for (const query of [{ pnr: booking.pnr }, { paymentReference: item.paymentReference }, { documento: CEDULA }, { documento: CEDULA, canal: 'SOCIO' }]) {
      const found = await api().get('/api/v1/admin/reservas').query(query).set(bearer(adminToken)).expect(200);
      expect(found.body.items.map((i: { bookingId: string }) => i.bookingId)).toContain(booking.bookingId);
    }
    const other = await api().get('/api/v1/admin/reservas').query({ documento: '1710034066' }).set(bearer(adminToken)).expect(200);
    expect(other.body.total).toBe(0);
    const direct = await api().get('/api/v1/admin/reservas').query({ canal: 'DIRECTO', partnerOrderId }).set(bearer(adminToken)).expect(200);
    expect(direct.body.total).toBe(0);

    const detail = await api().get(`/api/v1/admin/reservas/${booking.bookingId}`).set(bearer(adminToken)).expect(200);
    expect(detail.body).toMatchObject({ bookingId: booking.bookingId, cambios: [] });
    await api().get(`/api/v1/admin/reservas/${randomUUID()}`).set(bearer(adminToken)).expect(404);
  });

  it('checks in and cancels at the counter a booking it does not own, and the partner sees both in its feed', async () => {
    const partnerOrderId = `ORD-BKP-${randomUUID().slice(0, 8)}`;
    const booking = await partnerBooking('user-2', 1, partnerOrderId); // tomorrow: inside the check-in window

    const checkedIn = await api().post(`/api/v1/admin/reservas/${booking.bookingId}/check-in`).set(bearer(adminToken)).expect(200);
    expect(JSON.stringify(checkedIn.body)).toContain('CHECKED_IN');
    const listed = await api().get('/api/v1/admin/reservas').query({ partnerOrderId }).set(bearer(adminToken)).expect(200);
    expect(listed.body.items[0].pasajeros[0].checkIn).toBe(true);

    const quote = await api().get(`/api/v1/admin/reservas/${booking.bookingId}/cotizacion-cancelacion`).set(bearer(adminToken)).expect(200);
    expect(quote.body.quoteId).toBeDefined();
    const key = randomUUID();
    const cancelled = await api().post(`/api/v1/admin/reservas/${booking.bookingId}/cancelar`).set(bearer(adminToken)).set('Idempotency-Key', key).send({ quoteId: quote.body.quoteId, reasonCode: 'CUSTOMER_REQUEST' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    const again = await api().post(`/api/v1/admin/reservas/${booking.bookingId}/cancelar`).set(bearer(adminToken)).set('Idempotency-Key', randomUUID()).send({});
    expect(again.status).toBe(409);

    // The partner reads both events from its feed, with its own order id, and the cancellation carries the refund.
    const feed = await api().get(`${V2}/eventos`).query({ limit: 100 }).set(bearer(partnerToken)).expect(200);
    const ofBooking = (feed.body.events as { type: string; data: Record<string, unknown> }[]).filter((e) => e.data.bookingId === booking.bookingId);
    expect(ofBooking.find((e) => e.type.endsWith('booking.checked_in'))?.data).toMatchObject({ partnerOrderId });
    expect(ofBooking.find((e) => e.type.endsWith('booking.cancelled'))?.data).toMatchObject({ partnerOrderId, refundAmount: expect.any(String) });
    // Both counter actions are in the admin audit trail.
    const audit = await ds.query(`SELECT accion FROM "${ctx.schema}"."auditoria_administrativa" WHERE "entidad" = 'reserva' AND "entidadId" = $1 ORDER BY accion`, [booking.bookingId]);
    expect(audit.map((a: { accion: string }) => a.accion)).toEqual(['CANCELAR_MOSTRADOR', 'CHECK_IN_MOSTRADOR']);
  });

  it('marks a flight delayed with a gate from the back office: still on sale, visible in its status and announced', async () => {
    const booking = await partnerBooking('user-3', 22, `ORD-BKP-${randomUUID().slice(0, 8)}`);
    const vueloId = (await api().get(`/api/v1/admin/reservas/${booking.bookingId}`).set(bearer(adminToken)).expect(200)).body.vuelos[0].vueloId as string;
    const departure = (await api().get(`/api/v1/admin/reservas/${booking.bookingId}`).set(bearer(adminToken))).body.vuelos[0].salida as string;

    const bad = await api().patch(`/api/v1/admin/vuelos/${vueloId}/estado`).set(bearer(adminToken)).send({ status: 'DELAYED' });
    expect(bad.status).toBe(400); // a delay needs the estimated departure
    const estimated = new Date(new Date(departure).getTime() + 45 * 60_000).toISOString();
    const ok = await api().patch(`/api/v1/admin/vuelos/${vueloId}/estado`).set(bearer(adminToken)).send({ status: 'DELAYED', estimatedDepartureAt: estimated, departureGate: 'B12', reason: 'Retraso por tráfico aéreo' });
    expect(ok.status).toBe(200);

    const status = await api().get(`${V2}/flights/LA2402/status`).query({ date: departure.slice(0, 10) }).set(bearer(partnerToken)).expect(200);
    expect(status.body).toMatchObject({ status: 'DELAYED' });
    expect(JSON.stringify(status.body)).toContain('B12');
    const search = await api().post(`${V2}/search`).set('X-Device-Fingerprint', 'it').send({ itineraries: [{ origin: 'UIO', destination: 'GYE', departureDate: departure.slice(0, 10) }], passengers: { adults: 1 } }).expect(200);
    expect(search.body.offers.length).toBeGreaterThan(0); // a delayed flight still flies and stays on sale

    const feed = await api().get(`${V2}/eventos`).query({ limit: 100 }).set(bearer(partnerToken)).expect(200);
    expect((feed.body.events as { type: string }[]).some((e) => e.type.endsWith('flight.status_changed'))).toBe(true);
  });
});
