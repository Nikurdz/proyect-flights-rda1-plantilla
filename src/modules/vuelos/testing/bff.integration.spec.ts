import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { seedEcommerce } from '../ecommerce/seed/ecommerce.seed';
import { seedFlights } from '../seed/flights.seed';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(180_000);

const ADMIN = { correo: 'admin@example.com', contrasena: 'AdminPass-12345' };
const PASSWORD = 'Passw0rd-ok-123';

const dayAhead = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const yearsBefore = (years: number, from: string): string => {
  const d = new Date(`${from}T00:00:00.000Z`);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
};

describeIntegration('BFF por cliente (móvil, web, administrador) contra Postgres', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let ds: DataSource;
  let adminToken: string;
  let dueno: { token: string };
  let otro: { token: string };
  let invitado: string;
  let numero: string;

  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function cliente() {
    const correo = `cliente-${randomUUID().slice(0, 8)}@example.com`;
    await api().post('/api/v1/clientes').send({ correo, contrasena: PASSWORD, nombres: 'María José', apellidos: 'Pérez', fechaNacimiento: '1990-04-01', aceptaTerminos: true }).expect(201);
    const login = await api().post('/api/v1/auth/login').send({ correo, contrasena: PASSWORD }).expect(200);
    return { token: login.body.accessToken as string };
  }

  /** Buys a round trip BOG-SCL-BOG and returns the order number. */
  async function comprarViaje(token: string): Promise<string> {
    const out = dayAhead(30);
    const back = dayAhead(37);
    const search = await api().get('/api/v1/disponibilidad').query({ origin: 'BOG', destination: 'SCL', outbound: out, inbound: back, adt: 1, chd: 0, inf: 0, sort: 'MAS_BARATOS', mercado: 'ec' }).expect(200);
    const oferta = await api()
      .post('/api/v1/ofertas')
      .set(bearer(token))
      .set('Idempotency-Key', randomUUID())
      .send({
        mercado: 'ec',
        selecciones: [
          { itinerarioId: search.body.trayectos[0].itinerarios[0].itinerarioId, familia: 'LIGHT' },
          { itinerarioId: search.body.trayectos[1].itinerarios[0].itinerarioId, familia: 'LIGHT' },
        ],
        pasajeros: { adultos: 1, ninos: 0, infantes: 0 },
      })
      .expect(201);
    const id = oferta.body.ofertaId as string;
    const pasajeros = [
      {
        id: 'a1',
        tipo: 'ADULT',
        nombres: 'María José',
        apellidos: 'Peña Tapia',
        fechaNacimiento: yearsBefore(35, out),
        genero: 'F',
        nacionalidad: 'EC',
        documento: { tipo: 'PASSPORT', numero: 'ABA112345', vencimiento: '2040-01-01' },
      },
    ];
    await api().put(`/api/v1/ofertas/${id}/pasajeros`).set(bearer(token)).send({ pasajeros, contacto: { correo: 'comprador@example.com', telefono: '+593999999999' } }).expect(200);
    await api()
      .put(`/api/v1/ofertas/${id}/facturacion`)
      .set(bearer(token))
      .send({ tipoIdentificacion: 'CEDULA', numeroIdentificacion: '1712345678', razonSocial: 'María Peña', direccion: 'Av. Amazonas 123', pais: 'EC' })
      .expect(200);
    await api().post(`/api/v1/ofertas/${id}/condiciones`).set(bearer(token)).send({ versionTerminos: '2026-10', versionCondicionesTransporte: '2026-10' }).expect(200);
    const compra = await api()
      .post(`/api/v1/ofertas/${id}/compra`)
      .set(bearer(token))
      .set('Idempotency-Key', randomUUID())
      .send({ medio: { tipo: 'TARJETA', token: 'tok_visa_ok', marca: 'VISA' } })
      .expect(201);
    return compra.body.numeroOrden as string;
  }

  beforeAll(async () => {
    ctx = await createIntegrationApp();
    app = ctx.app;
    ds = ctx.dataSource;
    await seedFlights(ds);
    await seedEcommerce(ds, ADMIN);
    adminToken = (await api().post('/api/v1/auth/login').send(ADMIN).expect(200)).body.accessToken;
    dueno = await cliente();
    otro = await cliente();
    invitado = (await api().post('/api/v1/auth/invitado').expect(201)).body.accessToken;
    numero = await comprarViaje(dueno.token);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  describe('BFF móvil', () => {
    it('lists the customer orders as minimal rows', async () => {
      const res = await api().get('/api/v1/movil/ordenes').set(bearer(dueno.token)).expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toEqual({
        numero,
        estado: 'EMITIDA',
        total: expect.stringMatching(/^\d+\.\d{2}$/),
        moneda: 'USD',
        ruta: 'BOG-SCL-BOG',
        salida: expect.any(String),
        pax: 1,
      });
    });

    it('answers the detail without contact, payment, history or internal ids, and smaller than the web view', async () => {
      const movil = await api().get(`/api/v1/movil/ordenes/${numero}`).set(bearer(dueno.token)).expect(200);
      expect(movil.body).toMatchObject({ numero, estado: 'EMITIDA', moneda: 'USD' });
      expect(movil.body.tramos).toHaveLength(2);
      expect(movil.body.pasajeros[0]).toMatchObject({ nombre: 'MARIA JOSE PENA TAPIA', eTicket: expect.stringMatching(/^\d{13}$/), qr: expect.stringMatching(/^v1\./) });
      expect(Array.isArray(movil.body.acciones)).toBe(true);
      for (const prohibido of ['comprador@example.com', '+593999999999', 'VISA', 'historial', 'contacto', 'bookingId', 'ordenId']) {
        expect(JSON.stringify(movil.body)).not.toContain(prohibido);
      }

      const web = await api().get(`/api/v1/web/ordenes/${numero}`).set(bearer(dueno.token)).expect(200);
      expect(JSON.stringify(movil.body).length).toBeLessThan(JSON.stringify(web.body).length / 2);
    });

    it('does not reveal someone else\'s order, and guests have no list', async () => {
      await api().get(`/api/v1/movil/ordenes/${numero}`).set(bearer(otro.token)).expect(404);
      await api().get('/api/v1/movil/ordenes').set(bearer(invitado)).expect(403);
      await api().get('/api/v1/movil/ordenes').expect(401);
      const vacio = await api().get('/api/v1/movil/ordenes').set(bearer(otro.token)).expect(200);
      expect(vacio.body.items).toEqual([]);
    });
  });

  describe('BFF web', () => {
    it('returns the complete order with invoice, breakdown, flight state and actions', async () => {
      const res = await api().get(`/api/v1/web/ordenes/${numero}`).set(bearer(dueno.token)).expect(200);
      expect(res.body).toMatchObject({ numeroOrden: numero, estado: 'EMITIDA', contacto: { correo: 'comprador@example.com' } });
      expect(res.body.itinerarios.every((t: { estadoVuelo: string }) => t.estadoVuelo === 'SCHEDULED')).toBe(true);
      expect(res.body.factura).toMatchObject({ numero: expect.any(String), estado: 'EMITIDA' });
      const { subtotal, impuestos, total } = res.body.importes;
      expect(Math.round((Number(subtotal.monto) + Number(impuestos.monto)) * 100)).toBe(Math.round(Number(total.monto) * 100));
      expect(res.body.acciones.map((a: { codigo: string }) => a.codigo)).toContain('CANCELAR');
    });

    it('answers 404 to another customer and 401 to anyone anonymous', async () => {
      await api().get(`/api/v1/web/ordenes/${numero}`).set(bearer(otro.token)).expect(404);
      await api().get(`/api/v1/web/ordenes/${numero}`).expect(401);
    });

    it('leaves the existing order route exactly as it was', async () => {
      const res = await api().get(`/api/v1/ordenes/${numero}`).set(bearer(dueno.token)).expect(200);
      expect(res.body.itinerarios[0]).not.toHaveProperty('estadoVuelo');
      expect(res.body).not.toHaveProperty('importes');
      expect(res.body).not.toHaveProperty('acciones');
    });
  });

  describe('BFF administrador', () => {
    const expediente = () => api().get(`/api/v1/admin/ordenes/${numero}/expediente`);

    it('is closed to anonymous callers, guests and customers', async () => {
      await expediente().expect(401);
      await expediente().set(bearer(invitado)).expect(403);
      await expediente().set(bearer(dueno.token)).expect(403);
    });

    it('answers 404 for an unknown order', async () => {
      await api().get('/api/v1/admin/ordenes/ORD-ZZZZZZZZZZ/expediente').set(bearer(adminToken)).expect(404);
    });

    it('returns the file with payment, invoice, saga, events and the contact always masked', async () => {
      const res = await expediente().set(bearer(adminToken)).expect(200);
      expect(res.body).toMatchObject({ numeroOrden: numero, estado: 'EMITIDA', comprador: 'cliente', canal: expect.any(String) });
      expect(res.body.contacto).toEqual({ correo: 'c***@example.com', telefono: '***999' });
      expect(JSON.stringify(res.body)).not.toContain('comprador@example.com');
      expect(res.body.pago).toMatchObject({ marca: 'VISA', estado: 'CAPTURADO', referencia: expect.any(String) });
      expect(res.body.factura).toMatchObject({ estado: 'EMITIDA' });
      expect(res.body.transicionesPosibles).toEqual(expect.arrayContaining(['MODIFICADA', 'DEVOLUCION_EN_CURSO', 'EN_VIAJE']));
      expect(res.body.auditoria.sagas).toHaveLength(1);
      expect(res.body.auditoria.sagas[0]).toMatchObject({ tipo: 'COMPRA', estado: 'COMPLETADA' });
      expect(res.body.auditoria.sagas[0].pasos.length).toBeGreaterThan(0);
    });

    it('lists the domain events of the order once they are recorded', async () => {
      let tipos: string[] = [];
      for (let intento = 0; intento < 20 && !tipos.includes('OrdenEmitida'); intento++) {
        const res = await expediente().set(bearer(adminToken)).expect(200);
        tipos = res.body.auditoria.eventos.map((e: { tipo: string }) => e.tipo);
        if (!tipos.includes('OrdenEmitida')) await new Promise((r) => setTimeout(r, 250));
      }
      expect(tipos).toContain('OrdenEmitida');
    });
  });

  describe('trazabilidad', () => {
    it('echoes the correlation id sent by the caller on every BFF route', async () => {
      const correlacion = `bff-test-${randomUUID()}`;
      for (const ruta of ['/api/v1/movil/ordenes', `/api/v1/web/ordenes/${numero}`]) {
        const res = await api().get(ruta).set(bearer(dueno.token)).set('X-Correlation-Id', correlacion).expect(200);
        expect(res.headers['x-correlation-id']).toBe(correlacion);
      }
      const admin = await api().get(`/api/v1/admin/ordenes/${numero}/expediente`).set(bearer(adminToken)).set('X-Correlation-Id', correlacion).expect(200);
      expect(admin.headers['x-correlation-id']).toBe(correlacion);
    });
  });
});
