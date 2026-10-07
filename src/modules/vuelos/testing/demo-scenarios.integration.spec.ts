import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DataSource, In } from 'typeorm';
import { Booking } from '../entities/booking.entity';
import { FlightHold } from '../entities/flight-hold.entity';
import { SeatAssignment } from '../entities/seat-assignment.entity';
import { Ticket } from '../entities/ticket.entity';
import { Vuelo } from '../entities/vuelo.entity';
import { Oferta } from '../ecommerce/ofertas/entities/oferta.entity';
import { Pago } from '../ecommerce/pagos/entities/pago.entity';
import { OffersService } from '../services/offers.service';
import { DEMO_OWNER, DEMO_SCENARIOS, seedDemoScenarios, seedFlights } from '../seed/flights.seed';
import { seedEcommerce } from '../ecommerce/seed/ecommerce.seed';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(180_000);

const dayAhead = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

describeIntegration('Demo scenarios: full flights and the seat hold, against a real Postgres', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let ds: DataSource;
  let guestToken: string;

  const api = () => request(app.getHttpServer());
  const bearer = () => ({ Authorization: `Bearer ${guestToken}` });
  const flight = async (codigoVuelo: string, day: number) => {
    const rows = await ds.getRepository(Vuelo).find({ where: { codigoVuelo } });
    return rows.find((v) => new Date(v.fechaSalida).toISOString().slice(0, 10) === dayAhead(day)) as Vuelo;
  };
  const search = (query: Record<string, string | number>) => api().get('/api/v1/disponibilidad').query({ sort: 'MAS_BARATOS', ...query });
  const createOffer = (itinerarioId: string, adultos = 1) =>
    api()
      .post('/api/v1/ofertas')
      .set(bearer())
      .set('Idempotency-Key', randomUUID())
      .send({ mercado: 'ec', selecciones: [{ itinerarioId, familia: 'LIGHT' }], pasajeros: { adultos, ninos: 0, infantes: 0 } });

  beforeAll(async () => {
    ctx = await createIntegrationApp();
    app = ctx.app;
    ds = ctx.dataSource;
    await seedFlights(ds);
    await seedEcommerce(ds, { correo: 'admin@example.com', contrasena: 'AdminPass-12345' });
    guestToken = (await api().post('/api/v1/auth/invitado').expect(201)).body.accessToken;
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('leaves the planned flights sold out or nearly full, and a second run changes nothing', async () => {
    const planned = DEMO_SCENARIOS.reduce((n, s) => n + s.dias.length, 0);
    expect(await seedDemoScenarios(ds)).toBe(planned);

    expect((await flight('LA800', 3)).asientosDisponibles).toBe(0);
    expect((await flight('LA1500', 5)).asientosDisponibles).toBe(2);
    expect((await flight('LA800', 4)).asientosDisponibles).toBeGreaterThan(2); // the days around are untouched

    expect(await seedDemoScenarios(ds)).toBe(0);
  });

  it('occupies the sold seats with real bookings, so the seat map agrees with the counter, and never twice', async () => {
    const seats = (id: string) => ds.getRepository(SeatAssignment).count({ where: { vueloId: id } });
    const full = await flight('LA800', 3);
    const near = await flight('LA1500', 5);
    expect(await seats(full.id)).toBe(full.capacidadTotal); // sold out: every seat taken
    expect(await seats(near.id)).toBe(near.capacidadTotal - 2); // two seats left free

    const bookings = await ds.getRepository(Booking).find({ where: { ownerId: DEMO_OWNER, departureAt: full.fechaSalida } });
    const tickets = await ds.getRepository(Ticket).count({ where: { bookingId: In(bookings.map((b) => b.bookingId)) } });
    expect(bookings.length).toBeGreaterThan(0);
    expect(tickets).toBe(full.capacidadTotal); // one ticket per seat, nothing half-built
    expect(bookings.every((b) => b.status === 'CONFIRMED')).toBe(true);

    // The numbered seat map the traveller sees marks those seats as taken (here read through the admin back office).
    const admin = (await api().post('/api/v1/auth/login').send({ correo: 'admin@example.com', contrasena: 'AdminPass-12345' }).expect(200)).body.accessToken;
    const map = await api().get(`/api/v1/admin/vuelos/${near.id}/asientos`).set({ Authorization: `Bearer ${admin}` }).expect(200);
    expect(map.body.reservados).toHaveLength(near.capacidadTotal - 2);

    expect(await seedDemoScenarios(ds)).toBe(0);
    expect(await seats(full.id)).toBe(full.capacidadTotal); // a second run adds nothing
  });

  it('shows a full flight as sold out (last, without badges) instead of hiding it', async () => {
    const res = await search({ origin: 'BOG', destination: 'SCL', outbound: dayAhead(3) }).expect(200);
    const items = res.body.trayectos[0].itinerarios as { numeroVuelo: string; agotado: boolean; distintivos: string[]; ultimosAsientos: boolean }[];
    const full = items.find((i) => i.numeroVuelo === 'LA800')!;
    expect(full).toMatchObject({ agotado: true, distintivos: [], ultimosAsientos: false });
    expect(items[items.length - 1].numeroVuelo).toBe('LA800'); // the sold-out flight closes the list
    expect(items.filter((i) => !i.agotado).length).toBeGreaterThan(0); // LA1500 still sells that day
    expect(res.body.sinDisponibilidad).toBe(false);
  });

  it('flags a day as unavailable when every flight on it is sold out', async () => {
    const res = await search({ origin: 'UIO', destination: 'GYE', outbound: dayAhead(4) }).expect(200);
    const items = res.body.trayectos[0].itinerarios as { numeroVuelo: string; agotado: boolean }[];
    expect(items.find((i) => i.numeroVuelo === 'LA2402')?.agotado).toBe(true);
  });

  it('refuses to start an order on a sold-out flight (409 SEAT_TAKEN) and leaves no hold, offer or payment behind', async () => {
    const full = await flight('LA800', 10);
    const holdsBefore = await ds.getRepository(FlightHold).count();

    const res = await createOffer(full.id).expect(409);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.code).toBe('SEAT_TAKEN');

    expect(await ds.getRepository(FlightHold).count()).toBe(holdsBefore);
    expect(await ds.getRepository(Oferta).count()).toBe(0);
    expect(await ds.getRepository(Pago).count()).toBe(0);
    expect((await flight('LA800', 10)).asientosDisponibles).toBe(0); // and the count never went below zero
  });

  it('is sold out only for the group that does not fit: two seats left sell to a pair, not to three', async () => {
    const date = dayAhead(5);
    const three = await search({ origin: 'BOG', destination: 'SCL', outbound: date, adt: 3 }).expect(200);
    expect((three.body.trayectos[0].itinerarios as { numeroVuelo: string; agotado: boolean }[]).find((i) => i.numeroVuelo === 'LA1500')?.agotado).toBe(true);
    const two = await search({ origin: 'BOG', destination: 'SCL', outbound: date, adt: 2 }).expect(200);
    expect((two.body.trayectos[0].itinerarios as { numeroVuelo: string; agotado: boolean }[]).find((i) => i.numeroVuelo === 'LA1500')?.agotado).toBe(false);

    const near = await flight('LA1500', 5);
    await createOffer(near.id, 3).expect(409);
    expect((await flight('LA1500', 5)).asientosDisponibles).toBe(2);
  });

  it('does not touch a flight that already has a hold on it', async () => {
    const target = await flight('LA800', 17);
    await ds.getRepository(Vuelo).update({ id: target.id }, { asientosDisponibles: 40 }); // as if it had never been filled
    const offer = await createOffer(target.id).expect(201);
    expect(offer.body.ofertaId).toBeDefined();
    expect((await flight('LA800', 17)).asientosDisponibles).toBe(39);

    await seedDemoScenarios(ds);
    expect((await flight('LA800', 17)).asientosDisponibles).toBe(39); // a live hold is never overwritten
  });

  describe('the seat hold is real', () => {
    it('takes the seats while the offer lives and gives them back exactly once when it expires', async () => {
      const target = await flight('LA2403', 20);
      const before = target.asientosDisponibles;

      const created = await createOffer(target.id, 2).expect(201);
      expect((await flight('LA2403', 20)).asientosDisponibles).toBe(before - 2); // held, not sold

      const offer = await ds.getRepository(Oferta).findOneByOrFail({ ofertaId: created.body.ofertaId });
      await ds.getRepository(FlightHold).update({ holdId: offer.holdId }, { expiresAt: new Date(Date.now() - 60_000) });
      await app.get(OffersService).expireDueHolds();
      expect((await flight('LA2403', 20)).asientosDisponibles).toBe(before);

      await app.get(OffersService).expireDueHolds(); // a second sweep returns nothing more
      expect((await flight('LA2403', 20)).asientosDisponibles).toBe(before);
    });

    it('does not let two travellers hold the same last seat', async () => {
      const target = await flight('LA2403', 21);
      await ds.getRepository(Vuelo).update({ id: target.id }, { asientosDisponibles: 1 });

      const results = await Promise.all([createOffer(target.id), createOffer(target.id), createOffer(target.id)]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
      expect((await flight('LA2403', 21)).asientosDisponibles).toBe(0);
    });
  });
});
