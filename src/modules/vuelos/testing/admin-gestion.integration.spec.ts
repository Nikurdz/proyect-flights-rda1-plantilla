import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { Vuelo } from '../entities/vuelo.entity';
import { AuditoriaCambio } from '../ecommerce/mercados/entities/auditoria-cambio.entity';
import { seedEcommerce } from '../ecommerce/seed/ecommerce.seed';
import { seedFlights } from '../seed/flights.seed';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(180_000);

const ADMIN = { correo: 'admin@example.com', contrasena: 'AdminPass-12345' };
const PASSWORD = 'Passw0rd-ok-123';
const inDays = (days: number, hour = 14): string => {
  const d = new Date(Date.now() + days * 86_400_000);
  d.setUTCHours(hour, 30, 0, 0);
  return d.toISOString();
};

describeIntegration('Admin: users and flights management against a real Postgres', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let ds: DataSource;
  let adminToken: string;
  let adminId: string;

  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (correo: string, contrasena: string) => (await api().post('/api/v1/auth/login').send({ correo, contrasena }).expect(200)).body.accessToken as string;
  const newUser = (extra: Record<string, unknown> = {}) => ({ correo: `u-${randomUUID().slice(0, 8)}@example.com`, contrasena: PASSWORD, nombres: 'Rosa', apellidos: 'Mora', fechaNacimiento: '1992-03-04', ...extra });
  const audit = (entidad: string, entidadId: string) => ds.getRepository(AuditoriaCambio).find({ where: { entidad, entidadId } });

  beforeAll(async () => {
    ctx = await createIntegrationApp();
    app = ctx.app;
    ds = ctx.dataSource;
    await seedFlights(ds);
    await seedEcommerce(ds, ADMIN);
    adminToken = await login(ADMIN.correo, ADMIN.contrasena);
    adminId = (await api().get('/api/v1/admin/usuarios').query({ q: ADMIN.correo }).set(bearer(adminToken)).expect(200)).body.items[0].clienteId;
  });

  afterAll(async () => {
    await ctx?.close();
  });

  describe('users', () => {
    it('refuses everyone but an ADMIN (401 anonymous, 403 guest and customer)', async () => {
      const guest = (await api().post('/api/v1/auth/invitado').expect(201)).body.accessToken;
      const customer = await login((await api().post('/api/v1/admin/usuarios').set(bearer(adminToken)).send(newUser({ correo: 'cliente-acc@example.com' })).expect(201)).body.correo, PASSWORD);
      for (const [method, path, body] of [
        ['get', '/api/v1/admin/usuarios', undefined],
        ['post', '/api/v1/admin/usuarios', newUser()],
        ['put', `/api/v1/admin/usuarios/${adminId}/roles`, { roles: ['CUSTOMER'] }],
        ['post', '/api/v1/admin/vuelos', {}],
        ['delete', `/api/v1/admin/vuelos/${randomUUID()}`, undefined],
      ] as [string, string, object | undefined][]) {
        expect(((await (api() as any)[method](path).send(body)) as request.Response).status).toBe(401);
        expect(((await (api() as any)[method](path).set(bearer(guest)).send(body)) as request.Response).status).toBe(403);
        expect(((await (api() as any)[method](path).set(bearer(customer)).send(body)) as request.Response).status).toBe(403);
      }
    });

    it('creates a user who can sign in, never shows credentials, and rejects a duplicate e-mail', async () => {
      const body = newUser();
      const created = await api().post('/api/v1/admin/usuarios').set(bearer(adminToken)).send(body).expect(201);
      expect(created.body).toMatchObject({ correo: body.correo, roles: ['CUSTOMER'], correoVerificado: true, bloqueada: false });
      expect(JSON.stringify(created.body)).not.toMatch(/hash|contrasena|token/i);
      await login(body.correo, PASSWORD);

      const dup = await api().post('/api/v1/admin/usuarios').set(bearer(adminToken)).send(body).expect(409);
      expect(dup.body.code).toBe('EMAIL_ALREADY_REGISTERED');
      await api().post('/api/v1/admin/usuarios').set(bearer(adminToken)).send(newUser({ contrasena: 'corta' })).expect(400);
      await api().post('/api/v1/admin/usuarios').set(bearer(adminToken)).send(newUser({ roles: ['SUPERUSER'] })).expect(400);

      const found = await api().get('/api/v1/admin/usuarios').query({ q: body.correo }).set(bearer(adminToken)).expect(200);
      expect(found.body.total).toBe(1);
      expect((await audit('usuario', created.body.clienteId)).map((a) => a.accion)).toEqual(['CREAR']);
    });

    it('creates an administrator directly, and promotes and demotes an existing user (the role applies at the next sign-in)', async () => {
      const direct = newUser();
      const admin2 = await api().post('/api/v1/admin/usuarios').set(bearer(adminToken)).send({ ...direct, roles: ['ADMIN'] }).expect(201);
      expect(admin2.body.roles).toEqual(['CUSTOMER', 'ADMIN']);
      await api().get('/api/v1/admin/usuarios').set(bearer(await login(direct.correo, PASSWORD))).expect(200);

      const plain = newUser();
      const user = (await api().post('/api/v1/admin/usuarios').set(bearer(adminToken)).send(plain).expect(201)).body;
      const before = await login(plain.correo, PASSWORD);
      await api().get('/api/v1/admin/usuarios').set(bearer(before)).expect(403);

      const promoted = await api().put(`/api/v1/admin/usuarios/${user.clienteId}/roles`).set(bearer(adminToken)).send({ roles: ['ADMIN'] }).expect(200);
      expect(promoted.body.roles).toEqual(['CUSTOMER', 'ADMIN']); // CUSTOMER is always kept
      await api().get('/api/v1/admin/usuarios').set(bearer(before)).expect(403); // the old token still says CUSTOMER
      await api().get('/api/v1/admin/usuarios').set(bearer(await login(plain.correo, PASSWORD))).expect(200);

      await api().put(`/api/v1/admin/usuarios/${user.clienteId}/roles`).set(bearer(adminToken)).send({ roles: ['CUSTOMER'] }).expect(200);
      await api().get('/api/v1/admin/usuarios').set(bearer(await login(plain.correo, PASSWORD))).expect(403);

      expect((await audit('usuario', user.clienteId)).map((a) => a.accion).sort()).toEqual(['ASCENDER', 'CREAR', 'DEGRADAR']);
      await api().put(`/api/v1/admin/usuarios/${randomUUID()}/roles`).set(bearer(adminToken)).send({ roles: ['ADMIN'] }).expect(404);
    });

    it('never leaves the system without an administrator: no self-demotion and no demoting the last one', async () => {
      const self = await api().put(`/api/v1/admin/usuarios/${adminId}/roles`).set(bearer(adminToken)).send({ roles: ['CUSTOMER'] }).expect(409);
      expect(self.body.code).toBe('LAST_ADMIN');

      // Down to a single administrator: the one that remains cannot be demoted by anybody, not even by an admin who is no longer one.
      const admins = (await api().get('/api/v1/admin/usuarios').query({ rol: 'ADMIN', limite: 100 }).set(bearer(adminToken)).expect(200)).body.items as { clienteId: string }[];
      for (const other of admins.filter((a) => a.clienteId !== adminId)) {
        await api().put(`/api/v1/admin/usuarios/${other.clienteId}/roles`).set(bearer(adminToken)).send({ roles: ['CUSTOMER'] }).expect(200);
      }
      const last = (await api().get('/api/v1/admin/usuarios').query({ rol: 'ADMIN' }).set(bearer(adminToken)).expect(200)).body;
      expect(last.total).toBe(1);
    });
  });

  describe('flights', () => {
    const flight = (extra: Record<string, unknown> = {}) => ({
      codigoVuelo: `LA${900 + Math.floor(Math.random() * 99)}`,
      aerolinea: 'LATAM Airlines',
      origen: 'BOG',
      destino: 'MDE',
      salida: inDays(60 + Math.floor(Math.random() * 200)),
      duracionMinutos: 55,
      precioBaseUsd: 99.5,
      capacidad: 120,
      ...extra,
    });
    const flightRow = (id: string) => ds.getRepository(Vuelo).findOneByOrFail({ id });

    it('creates a flight that shows up in the search, and refuses duplicates, past dates and unknown airports', async () => {
      const body = flight();
      const created = await api().post('/api/v1/admin/vuelos').set(bearer(adminToken)).send(body).expect(201);
      expect(created.body).toMatchObject({ codigoVuelo: body.codigoVuelo, origen: 'BOG', destino: 'MDE', capacidadTotal: 120, asientosDisponibles: 120, asientosReservados: 0, precioBaseUsd: 99.5 });
      expect(new Date(created.body.llegada).getTime() - new Date(created.body.salida).getTime()).toBe(55 * 60_000);
      expect((await flightRow(created.body.vueloId)).codigoAerolinea).toBe('LA');

      const day = body.salida.slice(0, 10);
      const search = await api().get('/api/v1/disponibilidad').query({ origin: 'BOG', destination: 'MDE', outbound: day }).expect(200);
      expect((search.body.trayectos[0].itinerarios as { numeroVuelo: string }[]).map((i) => i.numeroVuelo)).toContain(body.codigoVuelo);

      expect((await api().post('/api/v1/admin/vuelos').set(bearer(adminToken)).send(body).expect(409)).body.code).toBe('CONFLICT');
      await api().post('/api/v1/admin/vuelos').set(bearer(adminToken)).send(flight({ salida: inDays(-1) })).expect(400);
      await api().post('/api/v1/admin/vuelos').set(bearer(adminToken)).send(flight({ destino: 'BOG' })).expect(400);
      await api().post('/api/v1/admin/vuelos').set(bearer(adminToken)).send(flight({ destino: 'ZZZ' })).expect(422);
      await api().post('/api/v1/admin/vuelos').set(bearer(adminToken)).send(flight({ codigoVuelo: 'X' })).expect(400);
      expect((await audit('vuelo', created.body.vueloId)).map((a) => a.accion)).toEqual(['CREAR']);
    });

    it('edits price, duration and capacity, but never below what is sold or past the numbered seats in use', async () => {
      const id = (await api().post('/api/v1/admin/vuelos').set(bearer(adminToken)).send(flight()).expect(201)).body.vueloId as string;

      const edited = await api().patch(`/api/v1/admin/vuelos/${id}`).set(bearer(adminToken)).send({ precioBaseUsd: 150, duracionMinutos: 70, capacidadTotal: 150, aerolinea: 'Avianca' }).expect(200);
      expect(edited.body).toMatchObject({ precioBaseUsd: 150, duracionMinutos: 70, capacidadTotal: 150, asientosDisponibles: 150, aerolinea: 'Avianca' });
      expect(new Date(edited.body.llegada).getTime() - new Date(edited.body.salida).getTime()).toBe(70 * 60_000);

      // Pretend 40 seats are sold or held: the capacity cannot go under that, and what is open follows the capacity.
      await ds.getRepository(Vuelo).update({ id }, { asientosDisponibles: 110 });
      await api().patch(`/api/v1/admin/vuelos/${id}`).set(bearer(adminToken)).send({ capacidadTotal: 39 }).expect(409);
      const shrunk = await api().patch(`/api/v1/admin/vuelos/${id}`).set(bearer(adminToken)).send({ capacidadTotal: 100 }).expect(200);
      expect(shrunk.body).toMatchObject({ capacidadTotal: 100, asientosDisponibles: 60 });

      await api().patch(`/api/v1/admin/vuelos/${id}`).set(bearer(adminToken)).send({ capacidadTotal: 0 }).expect(400);
      await api().patch(`/api/v1/admin/vuelos/${randomUUID()}`).set(bearer(adminToken)).send({ precioBaseUsd: 10 }).expect(404);
      await ds.getRepository(Vuelo).update({ id }, { fechaSalida: new Date(Date.now() - 3_600_000) });
      await api().patch(`/api/v1/admin/vuelos/${id}`).set(bearer(adminToken)).send({ precioBaseUsd: 10 }).expect(409); // already departed
      expect((await audit('vuelo', id)).map((a) => a.accion)).toEqual(['CREAR', 'ACTUALIZAR', 'ACTUALIZAR']);
    });

    it('deletes a flight that never sold, and refuses one with a hold or a booking (cancel it instead)', async () => {
      const clean = (await api().post('/api/v1/admin/vuelos').set(bearer(adminToken)).send(flight()).expect(201)).body.vueloId as string;
      await api().delete(`/api/v1/admin/vuelos/${clean}`).set(bearer(adminToken)).expect(204);
      expect(await ds.getRepository(Vuelo).findOneBy({ id: clean })).toBeNull();
      await api().delete(`/api/v1/admin/vuelos/${clean}`).set(bearer(adminToken)).expect(404);
      expect((await audit('vuelo', clean)).map((a) => a.accion)).toEqual(['CREAR', 'ELIMINAR']);

      // A flight with a hold on it (a traveller started an order) has history: it cannot be erased.
      const sold = await api().post('/api/v1/admin/vuelos').set(bearer(adminToken)).send(flight()).expect(201);
      const guest = (await api().post('/api/v1/auth/invitado').expect(201)).body.accessToken;
      await api()
        .post('/api/v1/ofertas')
        .set(bearer(guest))
        .set('Idempotency-Key', randomUUID())
        .send({ mercado: 'ec', selecciones: [{ itinerarioId: sold.body.vueloId, familia: 'LIGHT' }], pasajeros: { adultos: 1, ninos: 0, infantes: 0 } })
        .expect(201);
      const refused = await api().delete(`/api/v1/admin/vuelos/${sold.body.vueloId}`).set(bearer(adminToken)).expect(409);
      expect(refused.body.code).toBe('FLIGHT_IN_USE');
      expect(await ds.getRepository(Vuelo).findOneBy({ id: sold.body.vueloId })).not.toBeNull();

      // ...and it can still be cancelled, which is the supported way out.
      await api().post(`/api/v1/admin/vuelos/${sold.body.vueloId}/cancelar`).set(bearer(adminToken)).send({ motivo: 'Prueba' }).expect(200);
    });
  });
});
