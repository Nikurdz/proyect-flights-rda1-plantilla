import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { todayEcuador } from '../common/date.util';
import { seedEcommerce } from '../ecommerce/seed/ecommerce.seed';
import { seedFlights } from '../seed/flights.seed';
import { PartnerAuthService } from '../v2/auth/partner-auth.service';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(240_000);

const V2 = '/api/v2/vuelos';
const API = '/api/v1/admin/facturacion-booking';
const ADMIN = { correo: 'admin@example.com', contrasena: 'AdminPass-12345' };
const CLIENT = 'booking-prototipo';
const SECRET = 'a-partner-secret-of-24-chars!';
const dayAhead = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const cents = (value: string): number => Math.round(Number(value) * 100);

/** The sales of Booking as invoice lines: base + VAT = total, the credit note of a cancellation, the VAT alert and the day summary. */
describeIntegration('Admin: reconciliation of the sales of Booking against a real Postgres', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let ds: DataSource;
  let adminToken: string;
  let partnerToken: string;

  const api = () => request(app.getHttpServer());
  const bearer = (token: string, userId?: string) => ({ Authorization: `Bearer ${token}`, ...(userId ? { 'X-User-Id': userId } : {}) });

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
        passengers: [{ passengerId: 'a1', passengerType: 'ADULT', firstName: 'María', lastName: 'Andrade', documentType: 'PASSPORT', documentNumber: `P${randomUUID().slice(0, 8)}`, nationality: 'EC', birthDate: '1990-05-05', gender: 'F', contact: { email: 'm@example.com', phone: '+593999999999' } }],
        payment: { paymentReference: `PAY-BKP-${Date.now()}-${randomUUID().slice(0, 6)}`, amount: held.body.lockedPrice, provider: 'BOOKING_PROTOTIPO' },
        salesChannel: { partnerId: 'booking', partnerOrderId, packageId: null, promotionApplied: false },
      })
      .expect(201);
    return { bookingId: booked.body.bookingId as string, pnr: booked.body.pnr as string, holdId: held.body.holdId as string, userId };
  }

  beforeAll(async () => {
    ctx = await createIntegrationApp();
    app = ctx.app;
    ds = ctx.dataSource;
    await seedFlights(ds);
    await seedEcommerce(ds, ADMIN);
    await app.get(PartnerAuthService).upsert(CLIENT, SECRET);
    adminToken = (await api().post('/api/v1/auth/login').send(ADMIN).expect(200)).body.accessToken;
    partnerToken = (await api().post('/api/v2/oauth2/token').type('form').send({ grant_type: 'client_credentials', client_id: CLIENT, client_secret: SECRET }).expect(200)).body.access_token;
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('is for ADMIN only: 401 anonymous, 403 guest', async () => {
    const guest = (await api().post('/api/v1/auth/invitado').expect(201)).body.accessToken as string;
    for (const path of [API, `${API}/resumen`, `${API}/export.csv`]) {
      expect((await api().get(path)).status).toBe(401);
      expect((await api().get(path).set(bearer(guest))).status).toBe(403);
    }
  });

  it('shows each sale as an invoice line (base + VAT = total, VAT 15 %), and the summary of the day in Ecuador time', async () => {
    const a = await partnerBooking('user-1', 20, `ORD-BKP-${randomUUID().slice(0, 8)}`);
    const b = await partnerBooking('user-2', 21, `ORD-BKP-${randomUUID().slice(0, 8)}`);

    const list = await api().get(API).query({ partnerId: CLIENT }).set(bearer(adminToken)).expect(200);
    expect(list.body.total).toBe(2);
    const lines = list.body.items as { bookingId: string; fecha: string; base: string; iva: string; total: string; ivaEsperado: string; ivaSegunBooking: string; ivaAlerta: boolean; notaCredito: unknown }[];
    for (const line of lines) {
      expect(cents(line.base) + cents(line.iva)).toBe(cents(line.total));
      expect(line.iva).toBe(line.ivaEsperado); // VAT = 15 % of the base
      expect(line.ivaAlerta).toBe(false);
      expect(line.ivaSegunBooking).toMatch(/^\d+\.\d{2}$/); // what Booking would compute with the VAT included
      expect(line.notaCredito).toBeNull();
      expect(line.fecha).toBe(todayEcuador());
    }
    expect(lines.map((l) => l.bookingId).sort()).toEqual([a.bookingId, b.bookingId].sort());

    const summary = await api().get(`${API}/resumen`).query({ desde: todayEcuador(), hasta: todayEcuador() }).set(bearer(adminToken)).expect(200);
    expect(summary.body.total).toMatchObject({ ventas: 2, cancelaciones: 0, alertasIva: 0 });
    expect(cents(summary.body.total.total)).toBe(lines.reduce((s, l) => s + cents(l.total), 0));
    expect(summary.body.dias).toHaveLength(1);
    expect(summary.body.dias[0]).toMatchObject({ fecha: todayEcuador(), ventas: 2 });
    const other = await api().get(`${API}/resumen`).query({ desde: '2000-01-01', hasta: '2000-01-02' }).set(bearer(adminToken)).expect(200);
    expect(other.body.total.ventas).toBe(0);
  });

  it('derives the credit note from a cancellation and counts the refund and the penalty in the day', async () => {
    const sale = await partnerBooking('user-3', 22, `ORD-BKP-${randomUUID().slice(0, 8)}`);
    const quote = await api().get(`${V2}/bookings/${sale.bookingId}/cancellation-quote`).set(bearer(partnerToken, sale.userId)).expect(200);
    await api().post(`${V2}/bookings/${sale.bookingId}/cancel`).set(bearer(partnerToken, sale.userId)).set('Idempotency-Key', randomUUID()).send({ quoteId: quote.body.quoteId, reasonCode: 'CUSTOMER_REQUEST' }).expect(200);

    const list = await api().get(API).query({ estado: 'CANCELLED' }).set(bearer(adminToken)).expect(200);
    expect(list.body.total).toBe(1);
    const line = list.body.items[0];
    expect(line.notaCredito).toMatchObject({ numero: `NC-${sale.pnr}` });
    expect(cents(line.notaCredito.reembolso) + cents(line.notaCredito.penalidad)).toBe(cents(line.total));

    const summary = await api().get(`${API}/resumen`).set(bearer(adminToken)).expect(200);
    expect(summary.body.total.cancelaciones).toBe(1);
    expect(cents(summary.body.total.reembolsos)).toBe(cents(line.notaCredito.reembolso));
    // net = what was charged minus what was refunded
    expect(cents(summary.body.total.neto)).toBe(cents(summary.body.total.total) - cents(summary.body.total.reembolsos));
  });

  it('flags a sale whose VAT does not add up to 15 %, and lets you list only those', async () => {
    const sale = await partnerBooking('user-4', 23, `ORD-BKP-${randomUUID().slice(0, 8)}`);
    await ds.query(`UPDATE "${ctx.schema}"."vuelos_flight_holds" SET "lockedTaxesMinor" = "lockedTaxesMinor" + 500 WHERE "holdId" = $1`, [sale.holdId]);

    const alerts = await api().get(API).query({ soloAlertas: 'true' }).set(bearer(adminToken)).expect(200);
    expect(alerts.body.total).toBe(1);
    expect(alerts.body.items[0]).toMatchObject({ bookingId: sale.bookingId, ivaAlerta: true });
    const summary = await api().get(`${API}/resumen`).set(bearer(adminToken)).expect(200);
    expect(summary.body.total.alertasIva).toBe(1);
  });

  it('exports the same lines as CSV, without personal data', async () => {
    const csv = await api().get(`${API}/export.csv`).query({ partnerId: CLIENT }).set(bearer(adminToken)).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('pnr,partnerOrderId,paymentReference');
    expect(csv.text).toContain('NC-'); // the credit note of the cancelled sale
    expect(csv.text).not.toContain('Andrade');
    const rows = csv.text.trim().split('\r\n').length - 1;
    const list = await api().get(API).query({ partnerId: CLIENT, limite: 100 }).set(bearer(adminToken)).expect(200);
    expect(rows).toBe(list.body.total);
  });
});
