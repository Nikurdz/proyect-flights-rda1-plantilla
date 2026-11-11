import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { seedEcommerce } from '../ecommerce/seed/ecommerce.seed';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { seedFlights } from '../seed/flights.seed';
import { WebhookDispatcherService } from '../services/webhook-dispatcher.service';
import { PartnerAuthService } from '../v2/auth/partner-auth.service';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(240_000);

const V2 = '/api/v2/vuelos';
const ADMIN = { correo: 'admin@example.com', contrasena: 'AdminPass-12345' };
const CLIENT = 'booking-prototipo';
const SECRET = 'a-partner-secret-of-24-chars!';
// Nothing listens there: every delivery to Booking fails, so the retry and DEAD paths can be driven by hand.
const HOOK_URL = 'http://127.0.0.1:9/booking-hook';
const dayAhead = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const minor = (amount: string): number => Math.round(Number(amount) * 100);

/**
 * What the end-to-end session with Booking checks on our side: the reconciliation amounts (refundable fare gives everything
 * back with the agreed penalty of 0, a non-refundable one only the taxes), the cancellation event Booking refunds from,
 * and the admin view of the webhooks it should receive.
 */
describeIntegration('Booking test session: reconciliation, cancellation event and admin webhooks against a real Postgres', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let ds: DataSource;
  let adminToken: string;
  let partnerToken: string;

  const api = () => request(app.getHttpServer());
  const bearer = (token: string, userId?: string) => ({ Authorization: `Bearer ${token}`, ...(userId ? { 'X-User-Id': userId } : {}) });
  const login = async (correo: string, contrasena: string) => (await api().post('/api/v1/auth/login').send({ correo, contrasena }).expect(200)).body.accessToken as string;

  async function partnerBooking(userId: string, day: number, fareBrand: 'FULL' | 'BASIC') {
    const partnerOrderId = `ORD-BKP-${randomUUID().slice(0, 8)}`;
    const search = await api().post(`${V2}/search`).set('X-Device-Fingerprint', 'it').send({ itineraries: [{ origin: 'UIO', destination: 'GYE', departureDate: dayAhead(day) }], passengers: { adults: 1 } }).expect(200);
    const offer = search.body.offers[0];
    const held = await api()
      .post(`${V2}/offers/hold`)
      .set(bearer(partnerToken, userId))
      .set('Idempotency-Key', randomUUID())
      .send({ offerId: offer.offerId, itinerarySelections: offer.itineraries.map((i: { itineraryId: string }) => ({ itineraryId: i.itineraryId, cabinClass: 'ECONOMY', fareBrand })), passengersBreakdown: { adults: 1 } })
      .expect(201);
    const paymentReference = `PAY-BKP-${randomUUID().slice(0, 12)}`;
    const booked = await api()
      .post(`${V2}/bookings`)
      .set(bearer(partnerToken, userId))
      .set('Idempotency-Key', randomUUID())
      .send({
        holdId: held.body.holdId,
        passengers: [{ passengerId: 'a1', passengerType: 'ADULT', firstName: 'Ana', lastName: 'Vera', documentType: 'PASSPORT', documentNumber: `P${randomUUID().slice(0, 7)}`, nationality: 'EC', birthDate: '1990-05-05', gender: 'F', contact: { email: 'a@example.com', phone: '+593999999999' } }],
        payment: { paymentReference, amount: held.body.lockedPrice, provider: 'BOOKING_PROTOTIPO' },
        salesChannel: { partnerId: 'booking', partnerOrderId, packageId: null, promotionApplied: false },
      })
      .expect(201);
    return { bookingId: booked.body.bookingId as string, pnr: booked.body.pnr as string, partnerOrderId, paymentReference };
  }

  async function cancelFromBooking(userId: string, bookingId: string) {
    const res = await api().post(`${V2}/bookings/${bookingId}/cancel`).set(bearer(partnerToken, userId)).set('Idempotency-Key', randomUUID()).send({ reasonCode: 'CUSTOMER_REQUEST' });
    expect(res.status).toBe(200);
    return res.body as { refund: { amount: string; penaltyAmount: string } };
  }

  /** Deliveries are queued by an event consumer, right after the publish: wait for them. */
  async function deliveriesOf(bookingId: string, type: string): Promise<WebhookDelivery[]> {
    for (let i = 0; i < 50; i++) {
      const rows = (await ds.getRepository(WebhookDelivery).find({ where: { eventType: type } })).filter((d) => JSON.stringify(d.payload).includes(bookingId));
      if (rows.length > 0) return rows;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return [];
  }

  beforeAll(async () => {
    ctx = await createIntegrationApp({
      POSTSALE_CANCEL_PENALTY_PERCENT: '0',
      WEBHOOKS_ALLOW_PRIVATE_HOSTS: 'true',
      BOOKING_WEBHOOK_URL: HOOK_URL,
      BOOKING_WEBHOOK_SECRET: 'a-secret-of-sixteen-chars',
      PARTNER_CLIENT_ID: CLIENT,
    });
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

  it('the new admin routes are for ADMIN only: 401 anonymous, 403 guest and customer', async () => {
    const guest = (await api().post('/api/v1/auth/invitado').expect(201)).body.accessToken as string;
    const correo = `cliente-${randomUUID().slice(0, 8)}@example.com`;
    await api().post('/api/v1/clientes').send({ correo, contrasena: 'Cliente-Pass-12345', nombres: 'Luis', apellidos: 'Mora', fechaNacimiento: '1990-04-01', aceptaTerminos: true }).expect(201);
    const customer = await login(correo, 'Cliente-Pass-12345');
    for (const [method, path] of [
      ['get', '/api/v1/admin/webhooks/suscripciones'],
      ['get', '/api/v1/admin/webhooks/entregas'],
      ['post', `/api/v1/admin/webhooks/entregas/${randomUUID()}/reintentar`],
      ['get', '/api/v1/admin/reservas/export.csv'],
    ] as [string, string][]) {
      expect(((await (api() as any)[method](path)) as request.Response).status).toBe(401);
      for (const token of [guest, customer]) {
        expect(((await (api() as any)[method](path).set(bearer(token))) as request.Response).status).toBe(403);
      }
    }
  });

  it('a refundable fare cancelled from Booking gives everything back; a non-refundable one only the taxes', async () => {
    const full = await partnerBooking('user-1', 20, 'FULL');
    const basic = await partnerBooking('user-2', 21, 'BASIC');
    const fullRefund = await cancelFromBooking('user-1', full.bookingId);
    const basicRefund = await cancelFromBooking('user-2', basic.bookingId);

    const view = async (partnerOrderId: string) => (await api().get('/api/v1/admin/reservas').query({ partnerOrderId }).set(bearer(adminToken)).expect(200)).body.items[0];
    const f = (await view(full.partnerOrderId)).importes;
    expect(minor(f.base) + minor(f.impuestos)).toBe(minor(f.total));
    expect(f).toMatchObject({ moneda: 'USD', reembolso: f.total, penalidad: '0.00' });
    expect(fullRefund.refund).toMatchObject({ amount: f.total, penaltyAmount: '0.00' });

    const b = (await view(basic.partnerOrderId)).importes;
    expect(minor(b.impuestos)).toBeGreaterThan(0);
    expect(b).toMatchObject({ reembolso: b.impuestos, penalidad: b.base });
    expect(basicRefund.refund).toMatchObject({ amount: b.impuestos });
  });

  it('the cancellation Booking hears carries the payment, the currency and the penalty; the flight cancellation says why', async () => {
    const booking = await partnerBooking('user-3', 22, 'FULL');
    await cancelFromBooking('user-3', booking.bookingId);
    const [delivery] = await deliveriesOf(booking.bookingId, 'booking.cancelled');
    expect(delivery).toBeDefined();
    expect((delivery.payload as { data: Record<string, unknown> }).data).toMatchObject({
      bookingId: booking.bookingId,
      partnerOrderId: booking.partnerOrderId,
      paymentReference: booking.paymentReference,
      currency: 'USD',
      penaltyAmount: '0.00',
      reasonCode: 'CUSTOMER_REQUEST',
      refundAmount: expect.any(String),
    });

    const other = await partnerBooking('user-4', 23, 'BASIC');
    const vueloId = (await api().get(`/api/v1/admin/reservas/${other.bookingId}`).set(bearer(adminToken)).expect(200)).body.vuelos[0].vueloId as string;
    await api().post(`/api/v1/admin/vuelos/${vueloId}/cancelar`).set(bearer(adminToken)).send({ motivo: 'Prueba con Booking' }).expect((res) => expect([200, 201]).toContain(res.status));
    const [byAirline] = await deliveriesOf(other.bookingId, 'booking.cancelled');
    expect((byAirline.payload as { data: Record<string, unknown> }).data).toMatchObject({ reasonCode: 'FLIGHT_CANCELLED', penaltyAmount: '0.00', paymentReference: other.paymentReference });
  });

  it('lists the subscription and deliveries of Booking, and puts a dead delivery back in the queue', async () => {
    const subs = await api().get('/api/v1/admin/webhooks/suscripciones').set(bearer(adminToken)).expect(200);
    const sub = (subs.body.items as { owner: string; url: string; apiVersion: number; eventos: string[] }[]).find((s) => s.url === HOOK_URL);
    expect(sub).toMatchObject({ owner: `partner:${CLIENT}`, apiVersion: 2 });
    expect(sub!.eventos).toEqual(expect.arrayContaining(['booking.confirmed', 'booking.checked_in', 'booking.cancelled', 'flight.status_changed']));
    expect(JSON.stringify(subs.body)).not.toContain('a-secret-of-sixteen-chars');

    const booking = await partnerBooking('user-5', 24, 'FULL');
    const [confirmed] = await deliveriesOf(booking.bookingId, 'booking.confirmed');
    expect(confirmed).toBeDefined();

    // Nobody answers at HOOK_URL: six attempts (the first and five retries) and it is DEAD. Every run takes a batch of
    // the due deliveries, and the earlier tests queued many, so run until this one gives up.
    const dispatcher = app.get(WebhookDispatcherService);
    const repo = ds.getRepository(WebhookDelivery);
    let now = Date.now();
    for (let run = 0; run < 200 && (await repo.findOneByOrFail({ deliveryId: confirmed.deliveryId })).status !== 'DEAD'; run++) {
      now += 24 * 3_600_000;
      await dispatcher.process(new Date(now));
    }
    const dead = await api().get('/api/v1/admin/webhooks/entregas').query({ estado: 'DEAD', tipo: 'booking.confirmed', owner: `partner:${CLIENT}` }).set(bearer(adminToken)).expect(200);
    const item = (dead.body.items as Record<string, unknown>[]).find((d) => d.deliveryId === confirmed.deliveryId);
    expect(item).toMatchObject({ estado: 'DEAD', intentos: 6, bookingId: booking.bookingId, pnr: booking.pnr, partnerOrderId: booking.partnerOrderId, url: HOOK_URL });
    expect(item!.ultimoError).toEqual(expect.any(String));

    const retried = await api().post(`/api/v1/admin/webhooks/entregas/${confirmed.deliveryId}/reintentar`).set(bearer(adminToken)).expect(200);
    expect(retried.body).toMatchObject({ deliveryId: confirmed.deliveryId, estado: 'PENDING' });
    const row = await ds.getRepository(WebhookDelivery).findOneByOrFail({ deliveryId: confirmed.deliveryId });
    expect(row).toMatchObject({ status: 'PENDING', attempts: 0 });
    const audit = await ds.query(`SELECT accion FROM "${ctx.schema}"."auditoria_administrativa" WHERE "entidad" = 'webhook_entrega' AND "entidadId" = $1`, [confirmed.deliveryId]);
    expect(audit).toEqual([{ accion: 'REINTENTAR_WEBHOOK' }]);

    await api().post(`/api/v1/admin/webhooks/entregas/${randomUUID()}/reintentar`).set(bearer(adminToken)).expect(404);
    await ds.getRepository(WebhookDelivery).update({ deliveryId: confirmed.deliveryId }, { status: 'DELIVERED' });
    await api().post(`/api/v1/admin/webhooks/entregas/${confirmed.deliveryId}/reintentar`).set(bearer(adminToken)).expect(409);
  });

  it('exports the partner bookings as CSV with the amounts of the reconciliation and no passenger data', async () => {
    const booking = await partnerBooking('user-6', 25, 'FULL');
    const res = await api().get('/api/v1/admin/reservas/export.csv').query({ canal: 'SOCIO', partnerOrderId: booking.partnerOrderId }).set(bearer(adminToken)).expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('reservas.csv');
    expect(res.text.charCodeAt(0)).toBe(0xfeff); // the BOM, so a spreadsheet reads UTF-8
    const lines = res.text.slice(1).trim().split('\r\n');
    expect(lines).toHaveLength(2);
    const header = lines[0].split(',');
    const row = Object.fromEntries(lines[1].split(',').map((value, i) => [header[i], value]));
    const listed = (await api().get('/api/v1/admin/reservas').query({ partnerOrderId: booking.partnerOrderId }).set(bearer(adminToken)).expect(200)).body.items[0];
    expect(row).toMatchObject({
      pnr: booking.pnr,
      estado: 'CONFIRMED',
      canal: 'SOCIO',
      partnerOrderId: booking.partnerOrderId,
      paymentReference: booking.paymentReference,
      proveedorPago: 'BOOKING_PROTOTIPO',
      moneda: 'USD',
      base: listed.importes.base,
      impuestos: listed.importes.impuestos,
      total: listed.importes.total,
      reembolso: '',
      bookingId: booking.bookingId,
    });
    expect(res.text).not.toContain('Vera');

    const today = new Date().toISOString().slice(0, 10);
    const inRange = await api().get('/api/v1/admin/reservas').query({ partnerOrderId: booking.partnerOrderId, desde: today, hasta: today }).set(bearer(adminToken)).expect(200);
    expect(inRange.body.total).toBe(1);
    const outOfRange = await api().get('/api/v1/admin/reservas').query({ partnerOrderId: booking.partnerOrderId, hasta: '2020-01-01' }).set(bearer(adminToken)).expect(200);
    expect(outOfRange.body.total).toBe(0);
    await api().get('/api/v1/admin/reservas').query({ desde: 'ayer' }).set(bearer(adminToken)).expect(400);
  });

  it('shows the state of the Booking links in the runtime observability', async () => {
    const runtime = await api().get('/api/v1/admin/observabilidad/runtime').set(bearer(adminToken)).expect(200);
    expect(runtime.body.integrations['booking-webhook']).toMatchObject({ estado: 'SUSCRITO', owner: `partner:${CLIENT}` });
    expect(runtime.body.integrations['booking-stock']).toMatchObject({ modo: 'OFF' });
  });
});
