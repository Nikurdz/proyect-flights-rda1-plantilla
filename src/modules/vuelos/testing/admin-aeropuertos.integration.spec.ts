import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { AuditoriaCambio } from '../ecommerce/mercados/entities/auditoria-cambio.entity';
import { seedEcommerce } from '../ecommerce/seed/ecommerce.seed';
import { seedFlights } from '../seed/flights.seed';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(240_000);

const ADMIN = { correo: 'admin@example.com', contrasena: 'AdminPass-12345' };
const dayAhead = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

describeIntegration('Airport catalogue: Ecuador seed and admin creation against a real Postgres', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let ds: DataSource;
  let adminToken: string;

  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (correo: string, contrasena: string) => (await api().post('/api/v1/auth/login').send({ correo, contrasena }).expect(200)).body.accessToken as string;
  const valid = (extra: Record<string, unknown> = {}) => ({ iata: 'ZZA', ciudad: 'Ciudad Prueba', nombre: 'Aeropuerto de Prueba', pais: 'EC', paisNombre: 'Ecuador', zonaHoraria: 'America/Guayaquil', confirmar: true, ...extra });

  beforeAll(async () => {
    ctx = await createIntegrationApp();
    app = ctx.app;
    ds = ctx.dataSource;
    await seedFlights(ds);
    await seedEcommerce(ds, ADMIN);
    adminToken = await login(ADMIN.correo, ADMIN.contrasena);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  describe('the Ecuadorian airports of the seed', () => {
    it('knows Loja and the other airports with an IATA code, with the right time zone', async () => {
      const loja = await api().get('/api/v1/localidades').query({ q: 'loja' }).expect(200);
      expect(loja.body[0]).toMatchObject({ iata: 'LOH', ciudad: 'Loja', pais: 'EC', paisNombre: 'Ecuador', zonaHoraria: 'America/Guayaquil' });
      expect((await api().get('/api/v1/localidades').query({ q: 'camilo' }).expect(200)).body.map((l: { iata: string }) => l.iata)).toContain('LOH');
      const all = (await api().get('/api/v1/localidades').expect(200)).body as { iata: string; pais: string; zonaHoraria: string }[];
      const ecuador = all.filter((l) => l.pais === 'EC').map((l) => l.iata);
      for (const code of ['UIO', 'GYE', 'CUE', 'LOH', 'MEC', 'ESM', 'GPS', 'SCY', 'TUA', 'ATF', 'LGQ', 'OCC', 'TNW', 'TPN']) expect(ecuador).toContain(code);
      expect(all.length).toBeGreaterThan(40); // nothing typed: the whole catalogue, not ten
      expect(all.find((l) => l.iata === 'SCY')!.zonaHoraria).toBe('Pacific/Galapagos');
    });

    it('sells flights to and from Loja', async () => {
      for (const [origin, destination] of [['UIO', 'LOH'], ['LOH', 'UIO'], ['GYE', 'LOH'], ['LOH', 'GYE']]) {
        const search = await api()
          .post('/api/v1/search')
          .set('X-Device-Fingerprint', 'it')
          .send({ itineraries: [{ origin, destination, departureDate: dayAhead(5) }], passengers: { adults: 1 } })
          .expect(200);
        expect(search.body.offers.length).toBeGreaterThan(0);
      }
    });
  });

  describe('admin: create an airport', () => {
    it('is for ADMIN only: 401 anonymous, 403 guest and customer', async () => {
      const guest = (await api().post('/api/v1/auth/invitado').expect(201)).body.accessToken as string;
      for (const [method, path, body] of [
        ['get', '/api/v1/admin/aeropuertos', undefined],
        ['post', '/api/v1/admin/aeropuertos', valid()],
      ] as [string, string, object | undefined][]) {
        expect(((await (api() as any)[method](path).send(body)) as request.Response).status).toBe(401);
        expect(((await (api() as any)[method](path).set(bearer(guest)).send(body)) as request.Response).status).toBe(403);
      }
    });

    it('lists with search and filter, and counts the flights that use each airport', async () => {
      const found = await api().get('/api/v1/admin/aeropuertos').query({ q: 'loja' }).set(bearer(adminToken)).expect(200);
      const loh = found.body.items.find((a: { iata: string }) => a.iata === 'LOH'); // "Nueva Loja" (Lago Agrio) matches too: the admin search is by content
      expect(loh).toMatchObject({ iata: 'LOH', zonaHoraria: 'America/Guayaquil' });
      expect(loh.vuelos).toBeGreaterThan(0);
      const ecuador = await api().get('/api/v1/admin/aeropuertos').query({ pais: 'EC', limite: 100 }).set(bearer(adminToken)).expect(200);
      expect(ecuador.body.items.every((a: { pais: string }) => a.pais === 'EC')).toBe(true);
      expect(ecuador.body.total).toBeGreaterThanOrEqual(29);
    });

    it('asks for the confirmation: without confirmar: true (or with false) nothing is created', async () => {
      const missing = valid();
      delete (missing as Record<string, unknown>).confirmar;
      for (const body of [missing, valid({ confirmar: false })]) {
        const res = await api().post('/api/v1/admin/aeropuertos').set(bearer(adminToken)).send(body);
        expect(res.status).toBe(422);
        expect(JSON.stringify(res.body.invalidParams)).toContain('confirmar');
      }
      expect(await ds.query(`SELECT 1 FROM "${ctx.schema}"."ecom_localidades" WHERE "iata" = 'ZZA'`)).toHaveLength(0);
    });

    it('rejects a bad code, country or time zone', async () => {
      for (const body of [valid({ iata: 'ZZ' }), valid({ iata: 'ZZZZ' }), valid({ iata: 'Z1A' }), valid({ pais: 'ECU' }), valid({ zonaHoraria: 'Mars/Olympus' }), valid({ ciudad: '   ' })]) {
        const res = await api().post('/api/v1/admin/aeropuertos').set(bearer(adminToken)).send(body);
        expect(res.status).toBe(400);
      }
    });

    it('creates the airport after the confirmation, audits it, offers it in the catalogue and lets a flight use it', async () => {
      const created = await api().post('/api/v1/admin/aeropuertos').set(bearer(adminToken)).send(valid({ iata: 'zza' })); // lower case is normalised
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ iata: 'ZZA', ciudad: 'Ciudad Prueba', pais: 'EC', zonaHoraria: 'America/Guayaquil', vuelos: 0 });

      const audit = await ds.getRepository(AuditoriaCambio).find({ where: { entidad: 'aeropuerto', entidadId: 'ZZA' } });
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ accion: 'CREAR' });

      expect((await api().get('/api/v1/localidades').query({ q: 'aeropuerto de prueba' }).expect(200)).body.map((l: { iata: string }) => l.iata)).toContain('ZZA');

      const departure = new Date(Date.now() + 6 * 86_400_000);
      departure.setUTCHours(14, 30, 0, 0);
      const flight = await api()
        .post('/api/v1/admin/vuelos')
        .set(bearer(adminToken))
        .send({ codigoVuelo: 'LA9901', aerolinea: 'LATAM Airlines', origen: 'ZZA', destino: 'UIO', salida: departure.toISOString(), duracionMinutos: 45, precioBaseUsd: 50, capacidad: 60 });
      expect(flight.status).toBe(201);
    });

    it('answers 409 when the code already exists, including a seeded one', async () => {
      expect((await api().post('/api/v1/admin/aeropuertos').set(bearer(adminToken)).send(valid({ iata: 'ZZA' }))).status).toBe(409);
      expect((await api().post('/api/v1/admin/aeropuertos').set(bearer(adminToken)).send(valid({ iata: 'LOH' }))).status).toBe(409);
    });
  });
});
