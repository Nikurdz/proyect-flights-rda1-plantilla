import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { AuditoriaCambio } from '../ecommerce/mercados/entities/auditoria-cambio.entity';
import { AuditoriaTransaccion } from '../ecommerce/observabilidad/entities/auditoria.entity';
import { RetencionAuditoriaService } from '../ecommerce/observabilidad/retencion-auditoria.service';
import { seedEcommerce } from '../ecommerce/seed/ecommerce.seed';
import { seedFlights } from '../seed/flights.seed';
import { PartnerAuthService } from '../v2/auth/partner-auth.service';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(240_000);

const V2 = '/api/v2/vuelos';
const API = '/api/v1/admin/trazabilidad';
const ADMIN = { correo: 'admin@example.com', contrasena: 'AdminPass-12345' };
const CLIENT = 'booking-prototipo';
const SECRET = 'a-partner-secret-of-24-chars!';
const dayAhead = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Traceability end to end: who did what (actor, request id), the flow between components, the CSV, no providers, and the answers Booking relies on. */
describeIntegration('Traceability and the answers Booking relies on against a real Postgres', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let ds: DataSource;
  let adminToken: string;
  let partnerToken: string;

  const api = () => request(app.getHttpServer());
  const bearer = (token: string, userId?: string) => ({ Authorization: `Bearer ${token}`, ...(userId ? { 'X-User-Id': userId } : {}) });

  /** Polls until the check holds: the sign-in and webhook rows are written without waiting for them. */
  async function eventually(check: () => Promise<boolean>): Promise<void> {
    for (let i = 0; i < 40; i++) {
      if (await check()) return;
      await pause(100);
    }
    expect(await check()).toBe(true);
  }

  async function hold(userId: string, day: number) {
    const search = await api().post(`${V2}/search`).set('X-Device-Fingerprint', 'it').send({ itineraries: [{ origin: 'UIO', destination: 'GYE', departureDate: dayAhead(day) }], passengers: { adults: 1 } }).expect(200);
    const offer = search.body.offers[0];
    const held = await api()
      .post(`${V2}/offers/hold`)
      .set(bearer(partnerToken, userId))
      .set('Idempotency-Key', randomUUID())
      .send({ offerId: offer.offerId, itinerarySelections: offer.itineraries.map((i: { itineraryId: string }) => ({ itineraryId: i.itineraryId, cabinClass: 'ECONOMY', fareBrand: 'FULL' })), passengersBreakdown: { adults: 1 } })
      .expect(201);
    return { offer, held: held.body, segmentId: offer.itineraries[0].segments[0].segmentId as string };
  }

  function bookingBody(holdId: string, amount: unknown, seat?: { segmentId: string; seatNumber: string }) {
    return {
      holdId,
      passengers: [
        {
          passengerId: 'a1',
          passengerType: 'ADULT',
          firstName: 'María',
          lastName: 'Andrade',
          documentType: 'PASSPORT',
          documentNumber: `P${randomUUID().slice(0, 8)}`,
          nationality: 'EC',
          birthDate: '1990-05-05',
          gender: 'F',
          contact: { email: 'm@example.com', phone: '+593999999999' },
          ...(seat ? { assignedSeats: [seat] } : {}),
        },
      ],
      payment: { paymentReference: `PAY-TRZ-${Date.now()}-${randomUUID().slice(0, 6)}`, amount, provider: 'BOOKING_PROTOTIPO' },
      salesChannel: { partnerId: 'booking', partnerOrderId: `ORD-TRZ-${randomUUID().slice(0, 8)}`, packageId: null, promotionApplied: false },
    };
  }

  async function book(userId: string, day: number, seatNumber?: string) {
    const { offer, held, segmentId } = await hold(userId, day);
    const res = await api()
      .post(`${V2}/bookings`)
      .set(bearer(partnerToken, userId))
      .set('Idempotency-Key', randomUUID())
      .send(bookingBody(held.holdId, held.lockedPrice, seatNumber ? { segmentId, seatNumber } : undefined));
    return { res, offer, held, segmentId, userId };
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

  describe('seats (what Booking asked for)', () => {
    it('answers 409 SEAT_TAKEN as problem+json naming the seat and the segment, creates nothing and keeps the hold', async () => {
      const first = await book('seat-user-1', 30, '12A');
      expect(first.res.status).toBe(201);

      // Another booking for the same flight asks for the sold seat.
      const second = await hold('seat-user-2', 30);
      expect(second.segmentId).toBe(first.segmentId);
      const taken = await api()
        .post(`${V2}/bookings`)
        .set(bearer(partnerToken, 'seat-user-2'))
        .set('Idempotency-Key', randomUUID())
        .send(bookingBody(second.held.holdId, second.held.lockedPrice, { segmentId: second.segmentId, seatNumber: '12A' }));
      expect(taken.status).toBe(409);
      expect(taken.headers['content-type']).toContain('application/problem+json');
      expect(taken.body).toMatchObject({
        type: 'https://api.booking.local/errors/seat-taken',
        title: 'Asiento no disponible',
        status: 409,
        detail: `El asiento 12A del segmento ${second.segmentId} ya fue tomado.`,
        code: 'SEAT_TAKEN',
      });

      // Nothing was created and the hold can still be used with another seat.
      const list = await api().get(`${V2}/bookings`).set(bearer(partnerToken, 'seat-user-2')).expect(200);
      expect(list.body.items ?? list.body.bookings ?? []).toHaveLength(0);
      const retry = await api()
        .post(`${V2}/bookings`)
        .set(bearer(partnerToken, 'seat-user-2'))
        .set('Idempotency-Key', randomUUID())
        .send(bookingBody(second.held.holdId, second.held.lockedPrice, { segmentId: second.segmentId, seatNumber: '12B' }));
      expect(retry.status).toBe(201);
    });

    it('shows a sold seat as TICKETED and not available, and the rest as AVAILABLE', async () => {
      const sold = await book('seat-user-3', 31, '9C');
      expect(sold.res.status).toBe(201);
      const map = await api().get(`${V2}/offers/${sold.offer.offerId}/seatmap`).query({ segmentId: sold.segmentId }).expect(200);
      const seats = map.body.cabins.flatMap((c: { rows: { seats: { seatNumber: string; status: string; isAvailable: boolean }[] }[] }) => c.rows.flatMap((r) => r.seats));
      expect(seats.find((s: { seatNumber: string }) => s.seatNumber === '9C')).toMatchObject({ status: 'TICKETED', isAvailable: false });
      for (const seat of seats) expect(seat.isAvailable).toBe(seat.status === 'AVAILABLE');
      expect(seats.some((s: { status: string }) => s.status === 'AVAILABLE')).toBe(true);
    });
  });

  describe('cancellation quote (what fails on Booking side)', () => {
    it('answers a clear 404 NOT_FOUND when the booking does not exist or is another user\'s, and tells which X-User-Id to use', async () => {
      const sale = await book('quote-user-1', 32);
      expect(sale.res.status).toBe(201);
      const bookingId = sale.res.body.bookingId as string;

      const unknown = await api().get(`${V2}/bookings/${randomUUID()}/cancellation-quote`).set(bearer(partnerToken, 'quote-user-1'));
      expect(unknown.status).toBe(404);
      expect(unknown.body.code).toBe('NOT_FOUND');

      const other = await api().get(`${V2}/bookings/${bookingId}/cancellation-quote`).set(bearer(partnerToken, 'someone-else'));
      expect(other.status).toBe(404);
      expect(other.body.code).toBe('NOT_FOUND');
      expect(other.body.detail).toContain('X-User-Id');

      const notUuid = await api().get(`${V2}/bookings/${sale.res.body.pnr}/cancellation-quote`).set(bearer(partnerToken, 'quote-user-1'));
      expect(notUuid.status).toBe(400);
    });

    it('refuses a malformed X-User-Id instead of silently using another owner', async () => {
      const res = await api().get(`${V2}/bookings`).set({ Authorization: `Bearer ${partnerToken}`, 'X-User-Id': 'no valid!' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('quotes, cancels and then answers 409 ALREADY_CANCELLED to a new quote; the state and the event follow', async () => {
      const sale = await book('quote-user-2', 33);
      const bookingId = sale.res.body.bookingId as string;
      const quote = await api().get(`${V2}/bookings/${bookingId}/cancellation-quote`).set(bearer(partnerToken, 'quote-user-2')).expect(200);
      expect(quote.body).toMatchObject({ isRefundable: expect.any(Boolean), currency: expect.any(String) });
      expect(typeof quote.body.refundAmount).toBe('string');
      await api().post(`${V2}/bookings/${bookingId}/cancel`).set(bearer(partnerToken, 'quote-user-2')).set('Idempotency-Key', randomUUID()).send({ quoteId: quote.body.quoteId, reasonCode: 'CUSTOMER_REQUEST' }).expect(200);

      const again = await api().get(`${V2}/bookings/${bookingId}/cancellation-quote`).set(bearer(partnerToken, 'quote-user-2'));
      expect(again.status).toBe(409);
      expect(again.body.code).toBe('ALREADY_CANCELLED');

      const detail = await api().get(`${V2}/bookings/${bookingId}`).set(bearer(partnerToken, 'quote-user-2')).expect(200);
      expect(detail.body.status).toBe('CANCELLED');
      const feed = await api().get(`${V2}/eventos`).query({ type: 'booking.cancelled' }).set(bearer(partnerToken, 'quote-user-2')).expect(200);
      expect(JSON.stringify(feed.body)).toContain(bookingId);
    });
  });

  describe('traceability', () => {
    it('is for ADMIN only: 401 anonymous, 403 guest', async () => {
      const guest = (await api().post('/api/v1/auth/invitado').expect(201)).body.accessToken as string;
      for (const path of [API, `${API}/flujo?numero=X`, `${API}/mapa`, `${API}/export.csv`]) {
        expect((await api().get(path)).status).toBe(401);
        expect((await api().get(path).set(bearer(guest))).status).toBe(403);
      }
    });

    it('shows a partner sale and its cancellation with who did it, and draws the flow between components', async () => {
      const sale = await book('trace-user-1', 34);
      const pnr = sale.res.body.pnr as string;
      const bookingId = sale.res.body.bookingId as string;
      const quote = await api().get(`${V2}/bookings/${bookingId}/cancellation-quote`).set(bearer(partnerToken, 'trace-user-1')).expect(200);
      await api().post(`${V2}/bookings/${bookingId}/cancel`).set(bearer(partnerToken, 'trace-user-1')).set('Idempotency-Key', randomUUID()).send({ quoteId: quote.body.quoteId, reasonCode: 'CUSTOMER_REQUEST' }).expect(200);

      const timeline = await api().get(API).query({ numero: pnr }).set(bearer(adminToken)).expect(200);
      const types = (timeline.body.items as { tipo: string }[]).map((i) => i.tipo);
      expect(types).toEqual(expect.arrayContaining(['booking.confirmed', 'booking.cancelled']));
      for (const item of timeline.body.items as { actorTipo: string; actorId: string }[]) {
        if (item.actorTipo === 'PARTNER') expect(item.actorId).toBe(`partner:${CLIENT}:user:trace-user-1`);
      }
      expect((timeline.body.items as { actorTipo: string }[]).some((i) => i.actorTipo === 'PARTNER')).toBe(true);

      const flow = await api().get(`${API}/flujo`).query({ numero: pnr }).set(bearer(adminToken)).expect(200);
      const ids = (flow.body.nodos as { id: string }[]).map((n) => n.id);
      expect(ids).toEqual(expect.arrayContaining(['booking', 'api', 'webhooks', 'pagos']));
      const edges = flow.body.aristas as { orden: number; desde: string; hasta: string; etiqueta: string }[];
      expect(edges[0]).toMatchObject({ orden: 1, desde: 'booking', hasta: 'api', etiqueta: 'Solicitud' });
      expect(edges.map((e) => e.orden)).toEqual(edges.map((_, i) => i + 1));
      expect(edges.some((e) => e.etiqueta === 'booking.cancelled' && e.desde === 'api' && e.hasta === 'pagos')).toBe(true);

      const csv = await api().get(`${API}/export.csv`).query({ numero: pnr }).set(bearer(adminToken)).expect(200);
      expect(csv.headers['content-type']).toContain('text/csv');
      expect(csv.text).toContain('booking.cancelled');
      expect(csv.text).not.toContain('Andrade');

      await api().get(`${API}/flujo`).set(bearer(adminToken)).expect(400); // it needs something to trace
    });

    it('ties an administrative change to the request that made it, with where it came from', async () => {
      const correlationId = `trace-${randomUUID()}`;
      const correo = `traza-${randomUUID().slice(0, 8)}@example.com`;
      await api().post('/api/v1/admin/usuarios').set(bearer(adminToken)).set('X-Correlation-Id', correlationId).set('User-Agent', 'trazabilidad-test').send({ nombres: 'Traza', apellidos: 'Prueba', correo, contrasena: 'ClaveSegura-12345', fechaNacimiento: '1992-03-04' }).expect(201);

      const row = await ds.getRepository(AuditoriaCambio).findOneByOrFail({ correlationId });
      expect(row).toMatchObject({ entidad: 'usuario', accion: 'CREAR', userAgent: 'trazabilidad-test' });
      expect(row.ip).toBeTruthy();

      const timeline = await api().get(API).query({ correlationId }).set(bearer(adminToken)).expect(200);
      expect(timeline.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ fuente: 'admin', tipo: 'usuario.CREAR', actorTipo: 'ADMIN', correlationId })]));
      expect(JSON.stringify(timeline.body)).not.toContain(correo); // the e-mail stays in the database, never in the trail
    });

    it('records failed and successful sign-ins and the partner token without any e-mail', async () => {
      const email = `nadie-${randomUUID().slice(0, 8)}@example.com`;
      await api().post('/api/v1/auth/login').send({ correo: email, contrasena: 'Equivocada-12345' }).expect(401);
      await api().post('/api/v2/oauth2/token').type('form').send({ grant_type: 'client_credentials', client_id: CLIENT, client_secret: 'wrong-secret-of-24-chars!!' }).expect(401);

      await eventually(async () => (await ds.getRepository(AuditoriaTransaccion).countBy({ tipo: 'acceso.login_fallido' })) > 0 && (await ds.getRepository(AuditoriaTransaccion).countBy({ tipo: 'oauth2.token_fallido' })) > 0);
      const failed = await api().get(API).query({ tipo: 'acceso.login_fallido' }).set(bearer(adminToken)).expect(200);
      expect(failed.body.items[0]).toMatchObject({ estado: 'ERROR', origen: 'web', destino: 'identidad' });
      expect(JSON.stringify(failed.body)).not.toContain(email);
      const okLogin = await api().get(API).query({ tipo: 'acceso.login', actor: undefined }).set(bearer(adminToken)).expect(200);
      expect(okLogin.body.items.length).toBeGreaterThan(0);
    });

    it('leaves the providers out of the timeline, the CSV and the map', async () => {
      const correlationId = `prov-${randomUUID()}`;
      const repo = ds.getRepository(AuditoriaTransaccion);
      await repo.insert([
        { eventoId: randomUUID(), tipo: 'proveedor.salud', agregadoId: 'p1', mercado: null, propietarioId: null, correlationId, resumen: 'estado=DOWN', actorId: null, actorTipo: 'SYSTEM', entidad: 'proveedor', numero: null, origen: null, destino: null, ocurridoEn: new Date() },
        { eventoId: randomUUID(), tipo: 'ReservaExternaConfirmada', agregadoId: 'r1', mercado: null, propietarioId: null, correlationId, resumen: 'estado=OK', actorId: null, actorTipo: 'SYSTEM', entidad: 'reserva_externa', numero: null, origen: null, destino: null, ocurridoEn: new Date() },
      ]);
      const timeline = await api().get(API).query({ correlationId }).set(bearer(adminToken)).expect(200);
      expect(timeline.body.items).toHaveLength(0);
      const csv = await api().get(`${API}/export.csv`).query({ correlationId }).set(bearer(adminToken)).expect(200);
      expect(csv.text).not.toContain('proveedor');
      const map = await api().get(`${API}/mapa`).set(bearer(adminToken)).expect(200);
      expect(JSON.stringify(map.body)).not.toContain('proveedor');
      expect(map.body.enlaces.some((e: { desde: string; hasta: string; total: number }) => e.desde === 'api' && e.hasta === 'webhooks' && e.total > 0)).toBe(true);
    });

    it('pages the timeline with a cursor and deletes what is past the retention', async () => {
      const first = await api().get(API).query({ limite: 2 }).set(bearer(adminToken)).expect(200);
      expect(first.body.items).toHaveLength(2);
      expect(first.body.siguiente).toBeTruthy();
      const next = await api().get(API).query({ limite: 2, antes: first.body.siguiente }).set(bearer(adminToken)).expect(200);
      for (const item of next.body.items as { en: string }[]) expect(item.en < first.body.siguiente).toBe(true);

      const old = new Date(Date.now() - 400 * 86_400_000);
      await ds.getRepository(AuditoriaTransaccion).insert({ eventoId: randomUUID(), tipo: 'hold.expired', agregadoId: 'viejo', mercado: null, propietarioId: null, correlationId: 'viejo-0001', resumen: 'viejo', actorId: null, actorTipo: 'SYSTEM', entidad: 'hold', numero: null, origen: 'inventario', destino: 'catalogo', ocurridoEn: old });
      const deleted = await app.get(RetencionAuditoriaService).purgar(180);
      expect(deleted.eventos).toBeGreaterThanOrEqual(1);
      expect(await ds.getRepository(AuditoriaTransaccion).countBy({ agregadoId: 'viejo' })).toBe(0);
    });
  });
});
