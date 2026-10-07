import { randomUUID } from 'node:crypto';
import { HttpStatus, INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { Booking } from '../entities/booking.entity';
import { SeatAssignment } from '../entities/seat-assignment.entity';
import { FlightHold } from '../entities/flight-hold.entity';
import { Vuelo } from '../entities/vuelo.entity';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { OffersService } from '../services/offers.service';
import { BookingsService } from '../services/bookings.service';
import { MercadosService } from '../ecommerce/mercados/mercados.service';
import { Localidad } from '../ecommerce/catalogo/entities/localidad.entity';
import { Cliente } from '../ecommerce/identidad/entities/cliente.entity';
import { Mercado } from '../ecommerce/mercados/entities/mercado.entity';
import { Oferta } from '../ecommerce/ofertas/entities/oferta.entity';
import { Orden } from '../ecommerce/ordenes/entities/orden.entity';
import { Pago } from '../ecommerce/pagos/entities/pago.entity';
import { PASARELA_PAGO, PasarelaPago } from '../ecommerce/pagos/ports/pagos.ports';
import { ReconciliacionService } from '../ecommerce/ordenes/reconciliacion.service';
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

describeIntegration('E-commerce R1 against a real Postgres', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let ds: DataSource;
  let adminToken: string;
  let cursor = 2; // each purchase uses its own pair of days (cursor, cursor + 7) so seat counts never interfere; the seed covers 45 days

  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const q = (table: string) => `"${ctx.schema}"."${table}"`;

  async function guest(): Promise<string> {
    return (await api().post('/api/v1/auth/invitado').expect(201)).body.accessToken;
  }

  const register = (correo: string, extra: Record<string, unknown> = {}) =>
    api()
      .post('/api/v1/clientes')
      .send({ correo, contrasena: PASSWORD, nombres: 'María José', apellidos: 'Pérez', fechaNacimiento: '1990-04-01', aceptaTerminos: true, ...extra });

  async function customer(correo = `cliente-${randomUUID().slice(0, 8)}@example.com`) {
    const created = await register(correo).expect(201);
    const login = await api().post('/api/v1/auth/login').send({ correo, contrasena: PASSWORD }).expect(200);
    return { token: login.body.accessToken as string, clienteId: created.body.clienteId as string, correo };
  }

  // Sign-in is rate limited per address (20 / 15 min), and this suite is one address: share an empty account.
  let spareCustomer: Awaited<ReturnType<typeof customer>> | undefined;
  const sharedCustomer = async () => (spareCustomer ??= await customer());

  const money = (v: { monto: string }) => Number(v.monto);

  type Itinerario = { itinerarioId: string; precioDesde: { moneda: string; monto: string }; distintivos: string[]; fechaSalidaIso?: string; salida: string };
  const disponibilidad = (query: Record<string, string | number>) => api().get('/api/v1/disponibilidad').query(query);

  /** A priced round trip BOG-SCL-BOG built as an offer; returns what the next steps need. */
  async function nuevaOferta(token: string, opciones: { mercado?: string; familia?: string; pasajeros?: { adultos: number; ninos?: number; infantes?: number }; key?: string; fechas?: { out: string; back: string } } = {}) {
    // `fechas` lets two offers target the very same flights (seat contention); otherwise each offer gets fresh days.
    const out = opciones.fechas?.out ?? dayAhead(cursor);
    const back = opciones.fechas?.back ?? dayAhead(cursor + 7);
    if (!opciones.fechas) cursor += 1;
    const pasajeros = opciones.pasajeros ?? { adultos: 1, ninos: 1 };
    const mercado = opciones.mercado ?? 'ec';

    const search = await disponibilidad({
      origin: 'BOG',
      destination: 'SCL',
      outbound: out,
      inbound: back,
      adt: pasajeros.adultos,
      chd: pasajeros.ninos ?? 0,
      inf: pasajeros.infantes ?? 0,
      sort: 'MAS_BARATOS',
      mercado,
    }).expect(200);
    const ida: Itinerario = search.body.trayectos[0].itinerarios[0];
    const vuelta: Itinerario = search.body.trayectos[1].itinerarios[0];

    const res = await api()
      .post('/api/v1/ofertas')
      .set(bearer(token))
      .set('Idempotency-Key', opciones.key ?? randomUUID())
      .send({
        mercado,
        selecciones: [
          { itinerarioId: ida.itinerarioId, familia: opciones.familia ?? 'LIGHT' },
          { itinerarioId: vuelta.itinerarioId, familia: opciones.familia ?? 'LIGHT' },
        ],
        pasajeros: { adultos: pasajeros.adultos, ninos: pasajeros.ninos ?? 0, infantes: pasajeros.infantes ?? 0 },
      });
    return { res, out, back, ida, vuelta, pasajeros };
  }

  const pasajero = (id: string, tipo: string, nacimiento: string, extra: Record<string, unknown> = {}) => ({
    id,
    tipo,
    nombres: id === 'a1' ? 'María José' : `Niño${id}`,
    apellidos: 'Peña Tapia',
    fechaNacimiento: nacimiento,
    genero: 'F',
    nacionalidad: 'EC',
    documento: { tipo: 'PASSPORT', numero: `AB${id.toUpperCase()}12345`, vencimiento: '2040-01-01' },
    ...extra,
  });

  async function completarCheckout(token: string, ofertaId: string, salida: string, mercado = 'ec', composicion = { adultos: 1, ninos: 1 }) {
    const pasajeros = [pasajero('a1', 'ADULT', yearsBefore(35, salida))];
    if (composicion.ninos) pasajeros.push(pasajero('c1', 'CHILD', yearsBefore(8, salida)));
    await api().put(`/api/v1/ofertas/${ofertaId}/pasajeros`).set(bearer(token)).send({ pasajeros, contacto: { correo: 'comprador@example.com', telefono: '+593999999999' } }).expect(200);

    const facturacion = { tipoIdentificacion: 'CEDULA', numeroIdentificacion: '1712345678', razonSocial: 'María Peña', direccion: 'Av. Amazonas 123', pais: 'EC' };
    await api().put(`/api/v1/ofertas/${ofertaId}/facturacion`).set(bearer(token)).send(facturacion).expect(200);
    await api().post(`/api/v1/ofertas/${ofertaId}/condiciones`).set(bearer(token)).send({ versionTerminos: '2026-10', versionCondicionesTransporte: '2026-10' }).expect(200);
  }

  const comprar = (token: string, ofertaId: string, body: Record<string, unknown> = {}, key: string = randomUUID()) =>
    api()
      .post(`/api/v1/ofertas/${ofertaId}/compra`)
      .set(bearer(token))
      .set('Idempotency-Key', key)
      .send({ medio: { tipo: 'TARJETA', token: 'tok_visa_ok', marca: 'VISA' }, ...body });

  /** offer + complete checkout, ready to be paid. */
  async function ofertaLista(token: string, opciones: Parameters<typeof nuevaOferta>[1] = {}) {
    const { res, out, ...resto } = await nuevaOferta(token, opciones);
    expect(res.status).toBe(201);
    await completarCheckout(token, res.body.ofertaId, out, opciones.mercado ?? 'ec', opciones.pasajeros ? { adultos: opciones.pasajeros.adultos, ninos: opciones.pasajeros.ninos ?? 0 } : undefined);
    return { ofertaId: res.body.ofertaId as string, oferta: res.body, out, ...resto };
  }

  const pagos = (ofertaId: string) => ds.getRepository(Pago).find({ where: { ofertaId }, order: { creadoEn: 'ASC' } });
  const ordenes = (ofertaId: string) => ds.getRepository(Orden).find({ where: { ofertaId }, order: { creadaEn: 'ASC' } });
  const ofertaRow = (ofertaId: string) => ds.getRepository(Oferta).findOneByOrFail({ ofertaId });

  beforeAll(async () => {
    ctx = await createIntegrationApp();
    app = ctx.app;
    ds = ctx.dataSource;
    await seedFlights(ds);
    await seedEcommerce(ds, ADMIN);
    adminToken = (await api().post('/api/v1/auth/login').send(ADMIN).expect(200)).body.accessToken;
  });

  afterAll(async () => {
    await ctx?.close();
  });

  // ------------------------------------------------------------------------------------------------
  describe('D02 mercados y D19 configuración', () => {
    it('publishes the market configuration and rejects unknown or malformed codes', async () => {
      const ec = await api().get('/api/v1/mercados/ec').expect(200);
      expect(ec.body).toMatchObject({ codigo: 'ec', moneda: 'USD', decimalesMoneda: 2 });
      expect(ec.body.mediosPago[0].marcas).toEqual(expect.arrayContaining(['VISA', 'DINERS']));
      expect(ec.body.tipoCambioDesdeUsd).toBeUndefined(); // the conversion rate stays server-side

      await api().get('/api/v1/mercados/co').expect(404); // USD only: there is no second market

      await api().get('/api/v1/mercados/xx').expect(404);
      await api().get('/api/v1/mercados/NOT_A_MARKET!').expect(400);
    });

    it('lets only an administrator edit a market, with optimistic locking and an audit trail', async () => {
      const { token } = await customer();
      const edit = (headers: Record<string, string>, body: object) => api().put('/api/v1/admin/mercados/ec').set(headers).send(body);
      const current = (await api().get('/api/v1/mercados/ec')).body.version as number;

      await edit({}, { versionEsperada: current, activo: true }).expect(401);
      await edit(bearer(token), { versionEsperada: current, activo: true }).expect(403);

      const ok = await edit(bearer(adminToken), { versionEsperada: current, productosBuscador: ['VUELOS', 'ESIM'] }).expect(200);
      expect(ok.body).toMatchObject({ version: current + 1, productosBuscador: ['VUELOS', 'ESIM'] });

      const stale = await edit(bearer(adminToken), { versionEsperada: current, activo: true }).expect(409);
      expect(stale.body.code).toBe('CONFLICT');
      await edit(bearer(adminToken), { versionEsperada: current + 1 }).expect(400); // nothing to change
      await edit(bearer(adminToken), { versionEsperada: current + 1, identificacionesFiscales: [{ tipo: 'RUC', etiqueta: 'RUC', patron: '(' }] }).expect(400);

      const audit = await api().get('/api/v1/admin/auditoria').query({ entidad: 'mercado', id: 'ec' }).set(bearer(adminToken)).expect(200);
      expect(audit.body[0]).toMatchObject({ entidad: 'mercado', entidadId: 'ec', accion: 'ACTUALIZAR', despues: { productosBuscador: ['VUELOS', 'ESIM'] } });
      await api().get('/api/v1/admin/auditoria').query({ entidad: 'mercado', id: 'ec' }).set(bearer(token)).expect(403);
    });
  });

  // ------------------------------------------------------------------------------------------------
  describe('D01 identidad', () => {
    it('registers an account, links a LATAM Pass number, and verifies the e-mail with a one-time token', async () => {
      const correo = `Ana.${randomUUID().slice(0, 6)}@Example.com`;
      const res = await register(correo, { consentimientoMarketing: false }).expect(201);

      expect(res.body).toMatchObject({ correo: correo.toLowerCase(), correoVerificado: false, consentimientoMarketing: false, mercado: 'ec' });
      expect(res.body.numeroSocio).toMatch(/^LP\d{9}$/);
      expect(JSON.stringify(res.body)).not.toContain(PASSWORD);

      const mails = await api().get('/api/v1/admin/notificaciones').query({ referencia: res.body.clienteId }).set(bearer(adminToken)).expect(200);
      expect(mails.body[0]).toMatchObject({ tipo: 'VERIFICACION_CORREO', destinatario: correo.toLowerCase(), estado: 'ENVIADO' });
      const token = /token=([A-Za-z0-9_-]+)/.exec(mails.body[0].cuerpo)![1];

      await api().post('/api/v1/auth/verificar-correo').send({ token }).expect(204);
      await api().post('/api/v1/auth/verificar-correo').send({ token }).expect(400); // one-time
      expect((await ds.getRepository(Cliente).findOneByOrFail({ clienteId: res.body.clienteId })).correoVerificado).toBe(true);
    });

    it('stores only a hash of the password and refuses duplicates case-insensitively, weak passwords and missing consent', async () => {
      const correo = `dup-${randomUUID().slice(0, 6)}@example.com`;
      const first = await register(correo).expect(201);
      const stored = await ds.getRepository(Cliente).findOneByOrFail({ clienteId: first.body.clienteId });
      expect(stored.hashContrasena).toMatch(/^scrypt\$/);
      expect(stored.hashContrasena).not.toContain(PASSWORD);

      const dup = await register(correo.toUpperCase()).expect(409);
      expect(dup.body.code).toBe('EMAIL_ALREADY_REGISTERED');
      await register(`x-${randomUUID().slice(0, 6)}@example.com`, { contrasena: 'short1' }).expect(400);
      await register(`x-${randomUUID().slice(0, 6)}@example.com`, { contrasena: 'onlyletterspassword' }).expect(400);
      await register(`x-${randomUUID().slice(0, 6)}@example.com`, { aceptaTerminos: false }).expect(400);
      await register(`x-${randomUUID().slice(0, 6)}@example.com`, { mercado: 'xx' }).expect(404);
    });

    it('answers a wrong password and an unknown e-mail identically, then locks the account after repeated failures', async () => {
      const { correo, clienteId } = await customer();
      const wrong = await api().post('/api/v1/auth/login').send({ correo, contrasena: 'Wrong-pass-123' }).expect(401);
      const unknown = await api().post('/api/v1/auth/login').send({ correo: 'nobody@example.com', contrasena: 'Wrong-pass-123' }).expect(401);
      expect(wrong.body).toEqual(unknown.body);
      expect(wrong.body.code).toBe('INVALID_CREDENTIALS');

      for (let i = 0; i < 4; i++) await api().post('/api/v1/auth/login').send({ correo, contrasena: 'Wrong-pass-123' }).expect(401);
      const locked = await api().post('/api/v1/auth/login').send({ correo, contrasena: PASSWORD }).expect(423);
      expect(locked.body.code).toBe('ACCOUNT_LOCKED');

      const mails = await api().get('/api/v1/admin/notificaciones').query({ referencia: clienteId }).set(bearer(adminToken)).expect(200);
      expect(mails.body.map((m: { tipo: string }) => m.tipo)).toContain('CUENTA_BLOQUEADA');
    });

    it('issues guest sessions that cannot read a profile, and keeps profiles private', async () => {
      const g = await guest();
      await api().get('/api/v1/clientes/me').set(bearer(g)).expect(403);

      const a = await customer();
      const b = await customer();
      const me = await api().get('/api/v1/clientes/me').set(bearer(a.token)).expect(200);
      expect(me.body.clienteId).toBe(a.clienteId);
      await api().get(`/api/v1/clientes/${b.clienteId}`).set(bearer(a.token)).expect(403);
      await api().get('/api/v1/clientes/me').expect(401);
    });

    it('updates preferences, validating the language against the market, and records consent changes', async () => {
      const { token } = await customer();
      const ok = await api().put('/api/v1/clientes/me/preferencias').set(bearer(token)).send({ canalNotificacion: 'SMS', consentimientoMarketing: true }).expect(200);
      expect(ok.body).toMatchObject({ canalNotificacion: 'SMS', consentimientoMarketing: true });
      await api().put('/api/v1/clientes/me/preferencias').set(bearer(token)).send({ idioma: 'en' }).expect(422); // Ecuador offers Spanish only
      await api().put('/api/v1/clientes/me/preferencias').set(bearer(token)).send({ canalNotificacion: 'FAX' }).expect(400);
    });
  });

  // ------------------------------------------------------------------------------------------------
  describe('D04/D05 búsqueda y precios', () => {
    it('suggests places by prefix, ignoring accents and case, treating wildcards literally', async () => {
      const byCode = await api().get('/api/v1/localidades').query({ q: 'bog' }).expect(200);
      expect(byCode.body[0]).toMatchObject({ iata: 'BOG', ciudad: 'Bogotá', zonaHoraria: 'America/Bogota' });

      const accents = await api().get('/api/v1/localidades').query({ q: 'MEDELLIN' }).expect(200);
      expect(accents.body.map((l: { iata: string }) => l.iata)).toContain('MDE');
      const airport = await api().get('/api/v1/localidades').query({ q: 'jose joaquin' }).expect(200);
      expect(airport.body[0].iata).toBe('GYE');

      expect((await api().get('/api/v1/localidades').query({ q: '%' }).expect(200)).body).toEqual([]);
      expect((await api().get('/api/v1/localidades').expect(200)).body.length).toBeGreaterThan(5); // q optional: whole list
    });

    it('lists availability with operators, badges, the lowest price and every sort order', async () => {
      const date = dayAhead(40);
      const base = { origin: 'BOG', destination: 'SCL', outbound: date, adt: 1 };

      const res = await disponibilidad(base).expect(200);
      expect(res.body).toMatchObject({ mercado: 'ec', moneda: 'USD', sinDisponibilidad: false });
      const items: Itinerario[] = res.body.trayectos[0].itinerarios;
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items[0]).toMatchObject({ escalas: 0, operador: { codigo: 'LA' }, origen: { iata: 'BOG', ciudad: 'Bogotá' } });
      expect(items.flatMap((i) => i.distintivos)).toEqual(expect.arrayContaining(['RECOMENDADO', 'MAS_ECONOMICO', 'MAS_RAPIDO']));

      const cheapest = (await disponibilidad({ ...base, sort: 'MAS_BARATOS' })).body.trayectos[0].itinerarios as Itinerario[];
      expect(cheapest.map((i) => money(i.precioDesde))).toEqual([...cheapest.map((i) => money(i.precioDesde))].sort((a, b) => a - b));
      const early = (await disponibilidad({ ...base, sort: 'SALIDA_TEMPRANO' })).body.trayectos[0].itinerarios as Itinerario[];
      expect(early.map((i) => i.salida)).toEqual([...early.map((i) => i.salida)].sort());
      const late = (await disponibilidad({ ...base, sort: 'SALIDA_TARDE' })).body.trayectos[0].itinerarios as Itinerario[];
      expect(late.map((i) => i.salida)).toEqual([...late.map((i) => i.salida)].sort().reverse());
      for (const sort of ['MAS_RAPIDOS', 'LLEGADA_TEMPRANO', 'LLEGADA_TARDE', 'RECOMENDADO']) await disponibilidad({ ...base, sort }).expect(200);
      await disponibilidad({ ...base, sort: 'BOGUS' }).expect(400);
    });

    it('supports round trips and flags scarcity', async () => {
      const out = dayAhead(41);
      const rt = await disponibilidad({ origin: 'BOG', destination: 'SCL', outbound: out, inbound: dayAhead(48), adt: 1 }).expect(200);
      expect(rt.body.trayectos.map((t: { sentido: string }) => t.sentido)).toEqual(['IDA', 'VUELTA']);
      expect(rt.body.trayectos[1]).toMatchObject({ origen: 'SCL', destino: 'BOG' });

      const items: (Itinerario & { numeroVuelo: string; ultimosAsientos: boolean })[] = rt.body.trayectos[0].itinerarios;
      expect(items.find((i) => i.numeroVuelo === 'LA1500')!.ultimosAsientos).toBe(true); // 5 seats left
      expect(items.find((i) => i.numeroVuelo === 'LA800')!.ultimosAsientos).toBe(false);
    });

    it('quotes in USD with two decimals', async () => {
      const date = dayAhead(42);
      const one = (await disponibilidad({ origin: 'BOG', destination: 'SCL', outbound: date, adt: 1, sort: 'MAS_BARATOS' })).body.trayectos[0].itinerarios[0];

      expect(one.precioDesde.moneda).toBe('USD');
      expect(one.precioDesde.monto).toMatch(/^\d+\.\d{2}$/);
    });

    it('returns an empty result with nearby dates instead of an error when a day has no flights (RF-SHP-024)', async () => {
      const date = dayAhead(35);
      const start = new Date(`${date}T00:00:00.000Z`);
      await ds.getRepository(Vuelo).createQueryBuilder().delete().where('"codigoVuelo" = :n AND "fechaSalida" >= :a AND "fechaSalida" < :b', { n: 'LA2402', a: start, b: new Date(start.getTime() + 86_400_000) }).execute();

      const res = await disponibilidad({ origin: 'UIO', destination: 'GYE', outbound: date, adt: 1 }).expect(200);
      expect(res.body.sinDisponibilidad).toBe(true);
      expect(res.body.trayectos[0].itinerarios).toEqual([]);
      const alternatives: { fecha: string }[] = res.body.trayectos[0].fechasAlternativas;
      expect(alternatives.length).toBeGreaterThan(0);
      expect(alternatives.map((a) => a.fecha)).not.toContain(date);

      const none = await disponibilidad({ origin: 'CUZ', destination: 'MAD', outbound: date, adt: 1 }).expect(200); // a route nobody flies
      expect(none.body).toMatchObject({ sinDisponibilidad: true });
      expect(none.body.trayectos[0].fechasAlternativas).toEqual([]);
    });

    it('needs no criteria to browse: omitted date, origin and destination fall back to sensible defaults', async () => {
      const all = await disponibilidad({}).expect(200);
      expect(all.body.trayectos[0]).toMatchObject({ sentido: 'IDA', origen: null, destino: null });
      expect(all.body.trayectos[0].itinerarios.length).toBeGreaterThan(3);
      const fromBog = await disponibilidad({ origin: 'BOG' }).expect(200);
      expect(fromBog.body.trayectos[0].itinerarios.every((i: { origen: { iata: string } }) => i.origen.iata === 'BOG')).toBe(true);
      await api().get('/api/v1/admin/auditoria').set(bearer(adminToken)).expect(200);
      await api().get('/api/v1/admin/notificaciones').set(bearer(adminToken)).expect(200);
    });

    it('validates the criteria: rules, cabin, trip type and deep-link parameters', async () => {
      const base = { origin: 'BOG', destination: 'SCL', outbound: dayAhead(40), adt: 1 };
      await disponibilidad({ ...base, destination: 'BOG' }).expect(400);
      await disponibilidad({ ...base, outbound: '2020-01-01' }).expect(400);
      await disponibilidad({ ...base, inf: 2 }).expect(422);
      await disponibilidad({ ...base, adt: 9, chd: 1 }).expect(422);
      await disponibilidad({ ...base, cabin: 'BUSINESS' }).expect(422);
      await disponibilidad({ ...base, trip: 'RT' }).expect(400);
      await disponibilidad({ ...base, trip: 'OW', inbound: dayAhead(45) }).expect(400);
      await disponibilidad({ ...base, inbound: dayAhead(39) }).expect(400); // return before outbound
      await disponibilidad({ ...base, mercado: 'xx' }).expect(404);
      await disponibilidad({ ...base, unknownParam: 'x' }).expect(400);
    });

    it('compares every fare family of an itinerary with structured conditions and a validity (RF-PRC)', async () => {
      const it0 = (await disponibilidad({ origin: 'BOG', destination: 'SCL', outbound: dayAhead(40), adt: 2, chd: 1 })).body.trayectos[0].itinerarios[0] as Itinerario;
      const res = await api().get(`/api/v1/itinerarios/${it0.itinerarioId}/tarifas`).query({ adt: 2, chd: 1 }).expect(200);

      expect(res.body.familias.map((f: { codigo: string }) => f.codigo).sort()).toEqual(['BASIC', 'FULL', 'LIGHT']);
      const full = res.body.familias.find((f: { codigo: string }) => f.codigo === 'FULL');
      expect(full.condiciones).toMatchObject({ equipajeBodega: { piezas: 1 }, cambio: { permitido: true }, devolucion: { permitida: true }, seleccionAsiento: { incluida: true } });
      expect(full.precioPorPasajero.map((p: { tipo: string }) => p.tipo).sort()).toEqual(['ADULT', 'CHILD']);
      const adult = full.precioPorPasajero.find((p: { tipo: string }) => p.tipo === 'ADULT');
      expect(money(adult.total)).toBeCloseTo(money(adult.base) + money(adult.tasas), 2); // RN-07: taxes included, parts add up
      expect(new Date(res.body.vigenteHasta).getTime()).toBeGreaterThan(Date.now());

      await api().get(`/api/v1/itinerarios/${randomUUID()}/tarifas`).expect(404);
      await api().get('/api/v1/itinerarios/not-a-uuid/tarifas').expect(400);
    });
  });

  // ------------------------------------------------------------------------------------------------
  describe('D06/D07 ofertas y checkout', () => {
    it('builds an offer that holds real inventory, in the market currency, and replays on a retried key', async () => {
      const token = await guest();
      const key = randomUUID();
      const { res, ida } = await nuevaOferta(token, { key });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ estado: 'ABIERTA', mercado: 'ec', moneda: 'USD', pasajeros: { adultos: 1, ninos: 1 } });
      expect(res.body.trayectos).toHaveLength(2);
      expect(res.body.faltantes).toEqual(['PASAJEROS', 'FACTURACION', 'CONDICIONES']);
      expect(res.body.segundosRestantes).toBeGreaterThan(800);

      const row = await ofertaRow(res.body.ofertaId);
      const hold = await ds.getRepository(FlightHold).findOneByOrFail({ holdId: row.holdId });
      expect(hold.status).toBe('HELD');
      expect(hold.inventory.reduce((s, i) => s + i.seats, 0)).toBe(4); // 2 seats x 2 legs (the infant-less party of 2)

      const seatsAfter = (await ds.getRepository(Vuelo).findOneByOrFail({ id: ida.itinerarioId })).asientosDisponibles;
      const replay = await api().post('/api/v1/ofertas').set(bearer(token)).set('Idempotency-Key', key).send({
        mercado: 'ec',
        selecciones: res.body.trayectos.map((t: { itinerarioId: string }) => ({ itinerarioId: t.itinerarioId, familia: 'LIGHT' })),
        pasajeros: { adultos: 1, ninos: 1, infantes: 0 },
      });
      expect(replay.status).toBe(201);
      expect(replay.body.ofertaId).toBe(res.body.ofertaId);
      expect((await ds.getRepository(Vuelo).findOneByOrFail({ id: ida.itinerarioId })).asientosDisponibles).toBe(seatsAfter);
    });

    it('requires a session and an Idempotency-Key, and rejects bad round trips', async () => {
      const token = await guest();
      const { res, ida, vuelta } = await nuevaOferta(token);
      expect(res.status).toBe(201);
      const body = { mercado: 'ec', selecciones: [{ itinerarioId: ida.itinerarioId, familia: 'LIGHT' }], pasajeros: { adultos: 1 } };

      await api().post('/api/v1/ofertas').set('Idempotency-Key', randomUUID()).send(body).expect(401);
      await api().post('/api/v1/ofertas').set(bearer(token)).send(body).expect(400);
      await api().post('/api/v1/ofertas').set(bearer(token)).set('Idempotency-Key', randomUUID()).send({ ...body, selecciones: [{ itinerarioId: ida.itinerarioId, familia: 'NOPE' }] }).expect(422);
      await api().post('/api/v1/ofertas').set(bearer(token)).set('Idempotency-Key', randomUUID()).send({ ...body, selecciones: [{ itinerarioId: randomUUID(), familia: 'LIGHT' }] }).expect(404);
      await api().post('/api/v1/ofertas').set(bearer(token)).set('Idempotency-Key', randomUUID()).send({ ...body, selecciones: [{ itinerarioId: vuelta.itinerarioId, familia: 'LIGHT' }, { itinerarioId: ida.itinerarioId, familia: 'LIGHT' }] }).expect(422); // return before outbound
      await api().post('/api/v1/ofertas').set(bearer(token)).set('Idempotency-Key', randomUUID()).send({ ...body, pasajeros: { adultos: 1, infantes: 2 } }).expect(422);
      await api().post('/api/v1/ofertas').set(bearer(token)).set('Idempotency-Key', randomUUID()).send({ ...body, mercado: 'xx' }).expect(404);
    });

    it('validates passengers: party, age vs type, duplicates, infants, names, international documents', async () => {
      const token = await guest();
      const { res, out } = await nuevaOferta(token, { pasajeros: { adultos: 1, infantes: 1 } });
      const id = res.body.ofertaId as string;
      const put = (pasajeros: object[], contacto: object = { correo: 'a@example.com', telefono: '+593999999999' }) =>
        api().put(`/api/v1/ofertas/${id}/pasajeros`).set(bearer(token)).send({ pasajeros, contacto });
      const adult = pasajero('a1', 'ADULT', yearsBefore(35, out));
      const infant = pasajero('i1', 'INFANT', yearsBefore(0, out).replace(/-\d\d-\d\d$/, '-01-01'), { asociadoA: 'a1', documento: { tipo: 'PASSPORT', numero: 'INFANT0001', vencimiento: '2040-01-01' } });

      await put([adult]).expect(422); // the held party includes an infant
      await put([adult, { ...infant, asociadoA: undefined }]).expect(422); // infant without an adult
      await put([{ ...adult, fechaNacimiento: yearsBefore(5, out) }, infant]).expect(422); // a 5-year-old declared adult
      await put([adult, { ...infant, id: 'a1' }]).expect(422); // duplicate id
      await put([adult, { ...infant, documento: { ...infant.documento, vencimiento: undefined } }]).expect(422); // international: expiry required
      await put([adult, { ...infant, documento: { ...infant.documento, vencimiento: dayAhead(1) } }]).expect(422); // expires before the trip ends
      await put([adult, infant], { correo: 'not-an-email', telefono: '12' }).expect(400);
      await put([{ ...adult, nombres: '12345' }, infant]).expect(422); // no valid characters

      const ok = await put([adult, infant]).expect(200);
      expect(ok.body.advertencias[0]).toContain('MARIA JOSE'); // RF-CHK-003: accents stripped, upper-cased
      expect(ok.body.pasajerosRegistrados[0]).toMatchObject({ id: 'a1', nombres: 'MARIA JOSE', apellidos: 'PENA TAPIA' });
      expect(JSON.stringify(ok.body)).not.toContain('ABA112345'); // documents are never echoed back
      expect(JSON.stringify(ok.body)).not.toContain('INFANT0001');
      expect(ok.body.faltantes).toEqual(['FACTURACION', 'CONDICIONES']);
    });

    it('validates billing against the market configuration and the conditions against the version in force', async () => {
      const token = await guest();
      const { res } = await nuevaOferta(token);
      const id = res.body.ofertaId as string;
      const bill = (body: object) => api().put(`/api/v1/ofertas/${id}/facturacion`).set(bearer(token)).send(body);
      const ok = { tipoIdentificacion: 'CEDULA', numeroIdentificacion: '1712345678', razonSocial: 'María Peña', direccion: 'Av. Amazonas 123', pais: 'EC' };

      await bill({ ...ok, tipoIdentificacion: 'NIT' }).expect(422); // NIT is Colombian
      await bill({ ...ok, numeroIdentificacion: '123' }).expect(422); // not 10 digits
      await bill({ ...ok, numeroIdentificacion: '17123456789012' }).expect(422); // 14 digits is no Ecuadorian id
      await bill({ ...ok, numeroIdentificacion: 'bad id!' }).expect(400);
      await bill(ok).expect(200);

      const cond = (versionTerminos: string) => api().post(`/api/v1/ofertas/${id}/condiciones`).set(bearer(token)).send({ versionTerminos, versionCondicionesTransporte: '2026-10' });
      expect((await cond('1999-01')).status).toBe(409);
      const accepted = await cond('2026-10').expect(200);
      expect(accepted.body.condicionesAceptadas).toMatchObject({ terminos: '2026-10', condicionesTransporte: '2026-10' });
    });

    it('lists the payment methods of the market and restricts the offer to its owner', async () => {
      const owner = await guest();
      const other = await guest();
      const { res } = await nuevaOferta(owner);
      const id = res.body.ofertaId as string;

      const medios = await api().get(`/api/v1/ofertas/${id}/medios-pago`).set(bearer(owner)).expect(200);
      expect(medios.body[0]).toMatchObject({ tipo: 'TARJETA', cuotasPermitidas: [1, 3, 6, 12] });

      await api().get(`/api/v1/ofertas/${id}`).set(bearer(other)).expect(403);
      await api().delete(`/api/v1/ofertas/${id}`).set(bearer(other)).expect(403);
      await api().put(`/api/v1/ofertas/${id}/facturacion`).set(bearer(other)).send({ tipoIdentificacion: 'CEDULA', numeroIdentificacion: '1712345678', razonSocial: 'x y', direccion: 'abc', pais: 'EC' }).expect(403);
      await comprar(other, id).expect(403);
      await api().get(`/api/v1/ofertas/${id}`).expect(401);
      await api().get(`/api/v1/ofertas/${randomUUID()}`).set(bearer(owner)).expect(404);
    });

    it('releases the inventory when an offer is discarded', async () => {
      const token = await guest();
      const { res, ida } = await nuevaOferta(token);
      const seats = () => ds.getRepository(Vuelo).findOneByOrFail({ id: ida.itinerarioId }).then((v) => v.asientosDisponibles);
      const held = await seats();

      await api().delete(`/api/v1/ofertas/${res.body.ofertaId}`).set(bearer(token)).expect(204);
      expect(await seats()).toBe(held + 2);
      expect((await ofertaRow(res.body.ofertaId)).estado).toBe('CANCELADA');
      await api().delete(`/api/v1/ofertas/${res.body.ofertaId}`).set(bearer(token)).expect(409);
    });

    it('expires an overdue offer, returns its seats, and refuses to sell it (RF-CRT-005)', async () => {
      const token = await guest();
      const { res, ida } = await nuevaOferta(token);
      const before = (await ds.getRepository(Vuelo).findOneByOrFail({ id: ida.itinerarioId })).asientosDisponibles;
      const row = await ofertaRow(res.body.ofertaId);
      const past = new Date(Date.now() - 60_000);
      await ds.query(`UPDATE ${q('vuelos_flight_holds')} SET "expiresAt" = $1 WHERE "holdId" = $2`, [past, row.holdId]);
      await ds.query(`UPDATE ${q('ecom_ofertas')} SET "venceEn" = $1 WHERE "ofertaId" = $2`, [past, row.ofertaId]);

      const seen = await api().get(`/api/v1/ofertas/${row.ofertaId}`).set(bearer(token)).expect(200);
      expect(seen.body).toMatchObject({ estado: 'VENCIDA', segundosRestantes: 0 });
      expect((await ds.getRepository(Vuelo).findOneByOrFail({ id: ida.itinerarioId })).asientosDisponibles).toBe(before + 2);
      const sale = await comprar(token, row.ofertaId).expect(410);
      expect(sale.body.code).toBe('OFFER_EXPIRED');
    });

    it('marks the offer expired when the flight core sweeps its hold (event-driven)', async () => {
      const token = await guest();
      const { res } = await nuevaOferta(token);
      const row = await ofertaRow(res.body.ofertaId);
      await ds.query(`UPDATE ${q('vuelos_flight_holds')} SET "expiresAt" = $1 WHERE "holdId" = $2`, [new Date(Date.now() - 60_000), row.holdId]);

      await app.get(OffersService).expireDueHolds();

      expect((await ofertaRow(row.ofertaId)).estado).toBe('VENCIDA');
    });
  });

  // ------------------------------------------------------------------------------------------------
  describe('D08/D09 compra: pago, emisión y orden', () => {
    it('buys as a guest: pays, issues the booking and e-tickets, captures, notifies, and the trip can be recovered', async () => {
      const token = await guest();
      const { ofertaId, oferta, out } = await ofertaLista(token);

      const incomplete = await nuevaOferta(token);
      const missing = await comprar(token, incomplete.res.body.ofertaId).expect(422); // nothing filled in yet
      expect(missing.body.code).toBe('OFFER_INCOMPLETE');

      const res = await comprar(token, ofertaId).expect(201);
      expect(res.body).toMatchObject({ estado: 'EMITIDA', mercado: 'ec', total: oferta.total });
      expect(res.body.numeroOrden).toMatch(/^ORD-[A-Z2-9]{10}$/);
      expect(res.body.pnr).toMatch(/^[A-Z2-9]{6}$/);
      expect(res.body.numeroOrden).not.toBe(res.body.pnr); // RF-ORD-001: two different identifiers
      expect(res.body.pasajeros).toHaveLength(2);
      expect(res.body.pasajeros.every((p: { eTicket: string }) => /^\d{13}$/.test(p.eTicket))).toBe(true);
      expect(res.body.historial.map((h: { estado: string }) => h.estado)).toEqual(['PENDIENTE_PAGO', 'PAGADA', 'EMITIDA']);
      expect(res.body.pago).toEqual({ marca: 'VISA', ultimos4: '4242', cuotas: 1 });

      // Everything downstream agrees.
      expect((await ofertaRow(ofertaId)).estado).toBe('PAGADA');
      const [pago] = await pagos(ofertaId);
      expect(pago).toMatchObject({ estado: 'CAPTURADO', montoMinor: oferta.total.monto.replace('.', '') * 1, moneda: 'USD' });
      expect(pago.ordenId).toBe(res.body.ordenId);
      const booking = await ds.getRepository(Booking).findOneByOrFail({ pnr: res.body.pnr });
      expect(booking).toMatchObject({ ownerId: (await ofertaRow(ofertaId)).ownerId, paymentReference: pago.autorizacionRef });
      expect((await ds.getRepository(FlightHold).findOneByOrFail({ holdId: (await ofertaRow(ofertaId)).holdId })).status).toBe('CONSUMED');

      const mails = await api().get('/api/v1/admin/notificaciones').query({ referencia: res.body.numeroOrden }).set(bearer(adminToken)).expect(200);
      expect(mails.body[0]).toMatchObject({ tipo: 'CONFIRMACION_COMPRA', destinatario: 'comprador@example.com', estado: 'ENVIADO' });
      expect(mails.body[0].cuerpo).toContain(res.body.pnr);
      expect(mails.body[0].cuerpo).toContain(res.body.pasajeros[0].eTicket);
      expect(mails.body[0].cuerpo).toContain('RAM Alliance'); // the market's legal entity

      // The owner and the public recovery both see it; wrong data answers like a missing order.
      await api().get(`/api/v1/ordenes/${res.body.numeroOrden}`).set(bearer(token)).expect(200);
      await api().get(`/api/v1/ordenes/${res.body.numeroOrden}`).set(bearer(await guest())).expect(404);
      const byNumber = await api().get('/api/v1/ordenes').query({ numero: res.body.numeroOrden, apellido: 'peña' }).expect(200);
      expect(byNumber.body.numeroOrden).toBe(res.body.numeroOrden);
      expect(byNumber.body.contacto).toBeUndefined();
      await api().get('/api/v1/ordenes').query({ pnr: res.body.pnr.toLowerCase(), apellido: 'PENA TAPIA' }).expect(200);
      await api().get('/api/v1/ordenes').query({ numero: res.body.numeroOrden, apellido: 'Gomez' }).expect(404);
      await api().get('/api/v1/ordenes').query({ numero: res.body.numeroOrden, pnr: res.body.pnr, apellido: 'peña' }).expect(400);
      await api().get('/api/v1/ordenes').query({ apellido: 'peña' }).expect(400);
      expect(out).toBeDefined();
    });

    it('refunds through the gateway when the booking is cancelled and the order follows (REEMBOLSADA)', async () => {
      const { token } = await customer();
      // Same days as the first purchase: the seed only covers 45 days, so this test does not spend a fresh pair.
      const { ofertaId } = await ofertaLista(token, { familia: 'FULL', fechas: { out: dayAhead(2), back: dayAhead(9) } });
      const compra = await comprar(token, ofertaId).expect(201);

      // The owner's view links the order to the booking behind it.
      const orden = await api().get(`/api/v1/ordenes/${compra.body.numeroOrden}`).set(bearer(token)).expect(200);
      const bookingId = orden.body.bookingId as string;
      expect(bookingId).toBeDefined();
      expect(orden.body._links.reserva).toBe(`/api/v1/bookings/${bookingId}`);

      const quote = await api().get(`/api/v1/bookings/${bookingId}/cancellation-quote`).set(bearer(token)).expect(200);
      expect(quote.body.isRefundable).toBe(true);
      await api()
        .post(`/api/v1/bookings/${bookingId}/cancel`)
        .set(bearer(token))
        .set('Idempotency-Key', randomUUID())
        .send({ quoteId: quote.body.quoteId, reason: 'Cambio de planes' })
        .expect(200);

      // The events are handled in-process: the payment went back to the card and the order was closed.
      const [pago] = await pagos(ofertaId);
      expect(pago.estado).toBe('REEMBOLSADO');
      expect(pago.reembolsoMinor).toBe(Math.round(Number(quote.body.refundAmount) * 100));
      const final = await api().get(`/api/v1/ordenes/${compra.body.numeroOrden}`).set(bearer(token)).expect(200);
      expect(final.body.estado).toBe('REEMBOLSADA');
      expect(final.body.historial.map((h: { estado: string }) => h.estado)).toEqual(['PENDIENTE_PAGO', 'PAGADA', 'EMITIDA', 'DEVOLUCION_EN_CURSO', 'REEMBOLSADA']);
    });

    it('never charges twice: a retried key replays the result, and a new key resumes the existing order', async () => {
      const token = await guest();
      const { ofertaId } = await ofertaLista(token);
      const key = randomUUID();

      const first = await comprar(token, ofertaId, {}, key).expect(201);
      const replay = await comprar(token, ofertaId, {}, key).expect(201);
      expect(replay.body).toEqual(first.body);

      const fresh = await comprar(token, ofertaId, {}, randomUUID()).expect(201); // a new key after success
      expect(fresh.body.numeroOrden).toBe(first.body.numeroOrden);

      expect(await pagos(ofertaId)).toHaveLength(1);
      expect(await ordenes(ofertaId)).toHaveLength(1);
      expect(await ds.getRepository(Booking).count({ where: { pnr: first.body.pnr } })).toBe(1);
    });

    it('answers a different body on the same key with 422 instead of replaying the first purchase', async () => {
      const token = await guest();
      const { ofertaId } = await ofertaLista(token);
      const key = randomUUID();
      await comprar(token, ofertaId, { medio: { tipo: 'TARJETA', token: 'tok_declined', marca: 'VISA' } }, key).expect(402);

      await comprar(token, ofertaId, { medio: { tipo: 'TARJETA', token: 'tok_visa_ok', marca: 'VISA' } }, key).expect(422);
    });

    it('keeps the offer payable after a declined card and replays the decline without calling the gateway again', async () => {
      const token = await guest();
      const { ofertaId } = await ofertaLista(token);
      const declined = { medio: { tipo: 'TARJETA', token: 'tok_declined', marca: 'VISA' } };
      const key = randomUUID();

      const first = await comprar(token, ofertaId, declined, key).expect(402);
      expect(first.headers['content-type']).toContain('application/problem+json');
      expect(first.body).toMatchObject({ code: 'PAYMENT_DECLINED', status: 402 });
      expect((await ofertaRow(ofertaId)).estado).toBe('ABIERTA'); // RF-PAY-009

      const replay = await comprar(token, ofertaId, declined, key).expect(402);
      expect(replay.body).toEqual(first.body);
      expect(await pagos(ofertaId)).toHaveLength(1); // the replay did not reach the gateway

      const insufficient = await comprar(token, ofertaId, { medio: { tipo: 'TARJETA', token: 'tok_insufficient', marca: 'VISA' } }).expect(402);
      expect(insufficient.body.code).toBe('PAYMENT_DECLINED');

      const paid = await comprar(token, ofertaId, { medio: { tipo: 'TARJETA', token: 'tok_mastercard_ok', marca: 'MASTERCARD' } }).expect(201);
      expect(paid.body.pago).toMatchObject({ marca: 'MASTERCARD', ultimos4: '5454' });
      expect((await pagos(ofertaId)).map((p) => p.estado)).toEqual(['RECHAZADO', 'RECHAZADO', 'CAPTURADO']);
    });

    it('rejects risky payments through the fraud port, and refuses brands and instalments the market does not offer', async () => {
      const token = await guest();
      const { ofertaId } = await ofertaLista(token);

      const fraud = await comprar(token, ofertaId, { medio: { tipo: 'TARJETA', token: 'tok_fraud', marca: 'VISA' } }).expect(402);
      expect(fraud.body.code).toBe('PAYMENT_REJECTED_BY_FRAUD');
      await comprar(token, ofertaId, { medio: { tipo: 'TARJETA', token: 'tok_review', marca: 'VISA' } }).expect(402);
      const rows = await pagos(ofertaId);
      expect(rows.map((p) => p.estado)).toEqual(['RECHAZADO_ANTIFRAUDE', 'RECHAZADO_ANTIFRAUDE']);
      expect(rows[0].antifraude).toMatchObject({ veredicto: 'RECHAZAR', motivos: ['blocked_token'] });

      const brand = await comprar(token, ofertaId, { medio: { tipo: 'TARJETA', token: 'tok_visa_ok', marca: 'HIPERCARD' } }).expect(422);
      expect(brand.body.code).toBe('PAYMENT_METHOD_NOT_ALLOWED');
      await comprar(token, ofertaId, { cuotas: 24 }).expect(422);
      await comprar(token, ofertaId, { medio: { tipo: 'TARJETA', token: '4111111111111111', marca: 'VISA' } }).expect(400); // a card number is not a token (RN-18)
      await comprar(token, ofertaId, { medio: { tipo: 'TARJETA', token: 'tok_visa_ok', marca: 'MASTERCARD' } }).expect(402); // brand mismatch at the gateway
      expect((await ofertaRow(ofertaId)).estado).toBe('ABIERTA');
    });

    it('blocks the card after repeated failures on the same offer (velocity rule)', async () => {
      const token = await guest();
      const { ofertaId } = await ofertaLista(token);
      for (let i = 0; i < 3; i++) await comprar(token, ofertaId, { medio: { tipo: 'TARJETA', token: 'tok_declined', marca: 'VISA' } }).expect(402);

      const fourth = await comprar(token, ofertaId).expect(402);
      expect(fourth.body.code).toBe('PAYMENT_REJECTED_BY_FRAUD'); // even a good card is refused now
    });

    it('COMPENSATES when issuance fails after the payment was authorised: voids it, records the failure, keeps the offer retryable', async () => {
      const token = await guest();
      const { ofertaId } = await ofertaLista(token);
      const spy = jest.spyOn(app.get(BookingsService), 'createBookingWithin').mockRejectedValueOnce(new Error('PSS unavailable'));

      const res = await comprar(token, ofertaId).expect(502);
      spy.mockRestore();

      expect(res.body).toMatchObject({ code: 'ISSUANCE_FAILED_COMPENSATED', status: 502 });
      const [failed] = await ordenes(ofertaId);
      expect(failed).toMatchObject({ estado: 'FALLIDA_COMPENSADA', pnr: null });
      expect(res.body.detail).toContain(failed.numeroOrden);
      expect(failed.historial.map((h) => h.estado)).toEqual(['PENDIENTE_PAGO', 'PAGADA', 'FALLIDA_COMPENSADA']);
      expect((await pagos(ofertaId)).map((p) => p.estado)).toEqual(['ANULADO']); // the authorisation was released
      expect(await ds.getRepository(Booking).count({ where: { ownerId: (await ofertaRow(ofertaId)).ownerId } })).toBe(0); // atomic: nothing leaked
      expect((await ofertaRow(ofertaId)).estado).toBe('ABIERTA'); // the hold survived, so the customer can try again
      expect((await ds.getRepository(FlightHold).findOneByOrFail({ holdId: (await ofertaRow(ofertaId)).holdId })).status).toBe('HELD');

      const mails = await api().get('/api/v1/admin/notificaciones').query({ referencia: failed.numeroOrden }).set(bearer(adminToken)).expect(200);
      expect(mails.body[0]).toMatchObject({ tipo: 'EMISION_FALLIDA', estado: 'ENVIADO' });

      // The customer retries and this time it works; the failed attempt stays as history.
      const retry = await comprar(token, ofertaId).expect(201);
      expect(retry.body.estado).toBe('EMITIDA');
      expect((await ordenes(ofertaId)).map((o) => o.estado)).toEqual(['FALLIDA_COMPENSADA', 'EMITIDA']);
      expect((await pagos(ofertaId)).map((p) => p.estado)).toEqual(['ANULADO', 'CAPTURADO']);
    });

    it('still answers the compensated outcome when the market cannot be read while compensating (A4)', async () => {
      const token = await guest();
      // Fixed days: every offer built with the shared cursor moves later tests toward the end of the seeded horizon.
      const { ofertaId } = await ofertaLista(token, { fechas: { out: dayAhead(3), back: dayAhead(10) } });
      const mercados = app.get(MercadosService);
      const realObtener = mercados.obtener.bind(mercados);
      let issuanceFailed = false;
      const bookingSpy = jest.spyOn(app.get(BookingsService), 'createBookingWithin').mockImplementationOnce(async () => {
        issuanceFailed = true;
        throw new Error('PSS unavailable');
      });
      // The market reads fine for the whole purchase and vanishes only once compensation starts.
      const marketSpy = jest.spyOn(mercados, 'obtener').mockImplementation(async (codigo: string) => {
        if (issuanceFailed) throw new Error('market vanished');
        return realObtener(codigo);
      });

      let res: request.Response;
      try {
        res = await comprar(token, ofertaId).expect(502);
      } finally {
        bookingSpy.mockRestore();
        marketSpy.mockRestore();
      }

      expect(res.body.code).toBe('ISSUANCE_FAILED_COMPENSATED');
      const failed = await ordenes(ofertaId);
      expect(failed.map((o) => o.estado)).toEqual(['FALLIDA_COMPENSADA']); // recorded once, not lost and not duplicated
      expect((await pagos(ofertaId)).map((p) => p.estado)).toEqual(['ANULADO']);
      expect((await ofertaRow(ofertaId)).estado).toBe('ABIERTA'); // still retryable (not bought again here: seats are scarce on the cheapest flights)
      await api().delete(`/api/v1/ofertas/${ofertaId}`).set(bearer(token)).expect(204); // give the held seat back: the cheapest flights have few
    });

    it('passes a known issuance problem through (409) while still compensating', async () => {
      const token = await guest();
      const { ofertaId } = await ofertaLista(token);
      const spy = jest
        .spyOn(app.get(BookingsService), 'createBookingWithin')
        .mockRejectedValueOnce(new ProblemDetailsException(HttpStatus.CONFLICT, 'SEAT_TAKEN', 'Seat already taken', 'x'));

      const res = await comprar(token, ofertaId).expect(409);
      spy.mockRestore();

      expect(res.body.code).toBe('ISSUANCE_FAILED_COMPENSATED');
      expect(res.body.detail).toContain('SEAT_TAKEN');
      expect((await pagos(ofertaId)).map((p) => p.estado)).toEqual(['ANULADO']);
    });

    it('records an issued order whose capture failed as CAPTURA_PENDIENTE for reconciliation, without failing the sale', async () => {
      const token = await guest();
      const { ofertaId } = await ofertaLista(token);

      const res = await comprar(token, ofertaId, { medio: { tipo: 'TARJETA', token: 'tok_visa_capture_fail', marca: 'VISA' } }).expect(201);

      expect(res.body.estado).toBe('EMITIDA');
      expect((await pagos(ofertaId))[0].estado).toBe('CAPTURA_PENDIENTE');
    });

    it('records the compensated order even when the gateway cannot void, and the reconciler releases it later (C2)', async () => {
      const token = await guest();
      const { ofertaId } = await ofertaLista(token);
      const gateway = app.get<PasarelaPago>(PASARELA_PAGO);
      const issuance = jest.spyOn(app.get(BookingsService), 'createBookingWithin').mockRejectedValueOnce(new Error('PSS unavailable'));
      const voiding = jest.spyOn(gateway, 'anular').mockRejectedValue(new Error('gateway timeout'));

      const res = await comprar(token, ofertaId).expect(502);
      issuance.mockRestore();
      voiding.mockRestore();

      expect(res.body.code).toBe('ISSUANCE_FAILED_COMPENSATED');
      expect(res.body.detail).toContain('being released');
      expect((await ordenes(ofertaId)).map((o) => o.estado)).toEqual(['FALLIDA_COMPENSADA']); // recorded despite the failed void
      expect((await pagos(ofertaId)).map((p) => p.estado)).toEqual(['ANULACION_PENDIENTE']);
      expect((await ofertaRow(ofertaId)).estado).not.toBe('EN_PAGO'); // the offer is not left locked

      await app.get(ReconciliacionService).reconciliar();
      expect((await pagos(ofertaId)).map((p) => p.estado)).toEqual(['ANULADO']);
    });

    it('captures a payment left pending by a gateway outage once the reconciler runs (C4)', async () => {
      const token = await guest();
      const { ofertaId } = await ofertaLista(token);
      const capture = jest.spyOn(app.get<PasarelaPago>(PASARELA_PAGO), 'capturar').mockRejectedValue(new Error('gateway down'));

      await comprar(token, ofertaId).expect(201);
      capture.mockRestore();
      expect((await pagos(ofertaId))[0].estado).toBe('CAPTURA_PENDIENTE');

      await app.get(ReconciliacionService).reconciliar();
      expect((await pagos(ofertaId))[0].estado).toBe('CAPTURADO');
    });

    it('announces an issued order again when its confirmation e-mail never happened (C5)', async () => {
      const token = await guest();
      const { ofertaId } = await ofertaLista(token);
      const res = await comprar(token, ofertaId).expect(201);
      const numeroOrden = res.body.numeroOrden as string;
      const mails = () => ds.query(`SELECT 1 FROM ${q('ecom_notificaciones')} WHERE "referencia" = $1 AND "tipo" = 'CONFIRMACION_COMPRA'`, [numeroOrden]);
      expect(await mails()).toHaveLength(1);

      // Simulate a crash between commit and publish: the order is old enough and has no notification.
      await ds.query(`DELETE FROM ${q('ecom_notificaciones')} WHERE "referencia" = $1`, [numeroOrden]);
      await ds.getRepository(Orden).update({ ofertaId }, { creadaEn: new Date(Date.now() - 5 * 60_000) });

      const reconciler = app.get(ReconciliacionService);
      expect(await reconciler.reanunciarEmisiones()).toBeGreaterThanOrEqual(1);
      expect(await mails()).toHaveLength(1);
      await reconciler.reanunciarEmisiones(); // idempotent: nothing more to announce for this order
      expect(await mails()).toHaveLength(1);
    });

    it('limits purchase attempts per customer (A10)', async () => {
      const token = await guest();
      const attempt = () => comprar(token, randomUUID());
      for (let i = 0; i < 10; i++) await attempt().expect(404);
      const limited = await attempt().expect(429);
      expect(limited.body.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('lets two parallel purchases of one offer produce exactly one order and one charge', async () => {
      const token = await guest();
      const { ofertaId } = await ofertaLista(token);

      const [a, b] = await Promise.all([comprar(token, ofertaId), comprar(token, ofertaId)]);

      expect([a.status, b.status].filter((s) => s === 201).length).toBeGreaterThanOrEqual(1);
      expect([a.status, b.status].every((s) => s === 201 || s === 409)).toBe(true);
      expect((await ordenes(ofertaId)).filter((o) => o.estado === 'EMITIDA')).toHaveLength(1);
      expect((await pagos(ofertaId)).filter((p) => ['AUTORIZADO', 'CAPTURADO'].includes(p.estado))).toHaveLength(1);
    });

    it('stops at a price change: the customer must accept the new total before paying (RN-12)', async () => {
      const { token } = await customer();
      const { ofertaId, oferta } = await ofertaLista(token);
      expect(oferta.moneda).toBe('USD');

      const reval = await api().post(`/api/v1/ofertas/${ofertaId}/revalidacion`).set(bearer(token)).expect(200);
      expect(reval.body).toMatchObject({ vigente: true, cambioDePrecio: false });

      // The market's exchange rate moves: every quote changes.
      const version = (await api().get('/api/v1/mercados/ec')).body.version as number;
      await api().put('/api/v1/admin/mercados/ec').set(bearer(adminToken)).send({ versionEsperada: version, tipoCambioDesdeUsd: 1.1 }).expect(200);

      const changed = await api().post(`/api/v1/ofertas/${ofertaId}/revalidacion`).set(bearer(token)).expect(200);
      expect(changed.body.cambioDePrecio).toBe(true);
      expect(Number(changed.body.precioNuevo.monto)).toBeGreaterThan(Number(changed.body.precioAnterior.monto));

      const blocked = await comprar(token, ofertaId, { medio: { tipo: 'TARJETA', token: 'tok_visa_ok', marca: 'VISA' } }).expect(409);
      expect(blocked.body.code).toBe('PRICE_CHANGED');
      expect((await ofertaRow(ofertaId)).estado).toBe('EN_REVISION_PRECIO');
      expect((await api().get(`/api/v1/ofertas/${ofertaId}`).set(bearer(token))).body.faltantes).toContain('ACEPTAR_PRECIO');
      expect(await pagos(ofertaId)).toHaveLength(0); // nothing was charged

      await api().post(`/api/v1/ofertas/${ofertaId}/aceptacion-precio`).set(bearer(token)).send({ totalAceptado: '1' }).expect(409);
      const accepted = await api().post(`/api/v1/ofertas/${ofertaId}/aceptacion-precio`).set(bearer(token)).send({ totalAceptado: changed.body.precioNuevo.monto }).expect(200);
      expect(accepted.body).toMatchObject({ estado: 'ABIERTA', total: changed.body.precioNuevo });

      const paid = await comprar(token, ofertaId).expect(201);
      expect(paid.body.total).toEqual(changed.body.precioNuevo);
      expect((await pagos(ofertaId))[0]).toMatchObject({ moneda: 'USD', montoMinor: Math.round(Number(changed.body.precioNuevo.monto) * 100) });

      await api().put('/api/v1/admin/mercados/ec').set(bearer(adminToken)).send({ versionEsperada: version + 1, tipoCambioDesdeUsd: 1 }).expect(200);
    });

    it('refuses to sell into a market that was closed after the offer was built', async () => {
      const token = await guest();
      const { ofertaId } = await ofertaLista(token);
      const version = (await api().get('/api/v1/mercados/ec')).body.version as number;
      await api().put('/api/v1/admin/mercados/ec').set(bearer(adminToken)).send({ versionEsperada: version, activo: false }).expect(200);

      const res = await comprar(token, ofertaId).expect(422);
      expect(res.body.code).toBe('MARKET_NOT_AVAILABLE');
      await disponibilidad({ origin: 'BOG', destination: 'SCL', outbound: dayAhead(40), adt: 1 }).expect(422);

      await api().put('/api/v1/admin/mercados/ec').set(bearer(adminToken)).send({ versionEsperada: version + 1, activo: true }).expect(200);
      await comprar(token, ofertaId).expect(201);
    });
  });

  // ------------------------------------------------------------------------------------------------
  describe('código QR por pasajero', () => {
    const verificar = (codigo: string) => api().get('/api/v1/tickets/verificar').query({ codigo });

    // One purchase serves the first two tests: every offer of this suite uses up a pair of the seeded flight days.
    let compra: { token: string; ofertaId: string; res: request.Response } | undefined;
    const compraDeQr = async () => {
      if (!compra) {
        const token = await guest();
        const { ofertaId } = await ofertaLista(token);
        compra = { token, ofertaId, res: await comprar(token, ofertaId).expect(201) };
      }
      return compra;
    };

    it('gives each passenger a signed code on the order, the same one the flight core reports for the ticket', async () => {
      const { token, ofertaId, res } = await compraDeQr();

      const codes: string[] = res.body.pasajeros.map((p: { qr: string }) => p.qr);
      expect(codes).toHaveLength(2);
      expect(new Set(codes).size).toBe(2); // one per ticket
      for (const [i, code] of codes.entries()) {
        expect(code).toBe(`v1.${res.body.pasajeros[i].eTicket}.${res.body.pnr}.${code.split('.')[3]}`);
        expect(code).not.toMatch(/Peña|Niño|María/); // no personal data
      }

      // The core's own ticket endpoint reports the very same text, and it is stable between reads.
      const orden = await ds.getRepository(Orden).findOneByOrFail({ ofertaId });
      const tickets = await api().get(`/api/v1/bookings/${orden.bookingId}/tickets`).set(bearer(token)).expect(200);
      const first = tickets.body.map((t: { qrPayload: string }) => t.qrPayload).sort();
      expect(first).toEqual([...codes].sort());
      const again = await api().get(`/api/v1/bookings/${orden.bookingId}/tickets`).set(bearer(token)).expect(200);
      expect(again.body.map((t: { qrPayload: string }) => t.qrPayload).sort()).toEqual(first);

      // Public recovery shows it too.
      const recovered = await api().get('/api/v1/ordenes').query({ pnr: res.body.pnr, apellido: 'Peña' }).expect(200);
      expect(recovered.body.pasajeros.map((p: { qr: string }) => p.qr).sort()).toEqual([...codes].sort());
    });

    it('verifies a genuine code publicly (flight and state only) and answers valido:false to anything else', async () => {
      const { res } = await compraDeQr();
      const code: string = res.body.pasajeros[0].qr;

      const ok = await verificar(code).expect(200);
      expect(ok.body).toMatchObject({ valido: true, estado: 'ISSUED', pnr: res.body.pnr });
      expect(ok.body.itinerarios).toHaveLength(2);
      expect(JSON.stringify(ok.body)).not.toMatch(/Peña|Niño|María|comprador@example\.com/);

      const altered = code.replace(/\.[A-Za-z0-9_-]{22}$/, '.' + 'A'.repeat(22));
      expect((await verificar(altered).expect(200)).body).toEqual({ valido: false });
      expect((await verificar('v1.0000000000000.ABC234.' + 'A'.repeat(22)).expect(200)).body).toEqual({ valido: false });
      expect((await verificar('not-a-code').expect(200)).body).toEqual({ valido: false });
      await api().get('/api/v1/tickets/verificar').expect(400); // the parameter is required
    });

    it('limits the public check per address', async () => {
      let limited: number | undefined;
      for (let i = 0; i < 40 && !limited; i += 1) {
        const r = await verificar('not-a-code');
        if (r.status === 429) limited = r.status;
      }
      expect(limited).toBe(429);
    });
  });

  // ------------------------------------------------------------------------------------------------
  describe('selección de asientos', () => {
    const seatPlan = (token: string, ofertaId: string, pasajeros: Record<string, unknown>[]) =>
      api().put(`/api/v1/ofertas/${ofertaId}/pasajeros`).set(bearer(token)).send({ pasajeros, contacto: { correo: 'comprador@example.com', telefono: '+593999999999' } });

    const mapa = (token: string, ofertaId: string, trayectoId: string) =>
      api().get(`/api/v1/ofertas/${ofertaId}/asientos`).query({ trayectoId }).set(bearer(token));

    /** The same trip dates as an existing offer, so both target the very same flights. */
    const mismasFechas = (out: string) => ({ out, back: dayAhead(Math.round((new Date(`${out}T00:00:00Z`).getTime() - Date.now()) / 86_400_000) + 7) });

    /** An offer with an adult (and a child) whose seats on the outbound leg are the ones given; ready to pay. */
    async function ofertaConAsientos(token: string, asientos: { adulto?: string; nino?: string }, fechas?: { out: string; back: string }) {
      const { res, out, ida, vuelta } = await nuevaOferta(token, { fechas });
      expect(res.status).toBe(201);
      const ofertaId = res.body.ofertaId as string;
      const pick = (seat?: string) => (seat ? { asientos: [{ trayectoId: ida.itinerarioId, asiento: seat }] } : {});
      await seatPlan(token, ofertaId, [pasajero('a1', 'ADULT', yearsBefore(35, out), pick(asientos.adulto)), pasajero('c1', 'CHILD', yearsBefore(8, out), pick(asientos.nino))]).expect(200);
      await api().put(`/api/v1/ofertas/${ofertaId}/facturacion`).set(bearer(token)).send({ tipoIdentificacion: 'CEDULA', numeroIdentificacion: '1712345678', razonSocial: 'María Peña', direccion: 'Av. Amazonas 123', pais: 'EC' }).expect(200);
      await api().post(`/api/v1/ofertas/${ofertaId}/condiciones`).set(bearer(token)).send({ versionTerminos: '2026-10', versionCondicionesTransporte: '2026-10' }).expect(200);
      return { ofertaId, out, ida, vuelta };
    }

    // The map test and the validation test share one offer (each offer uses up a pair of the seeded flight days).
    let abierta: (Awaited<ReturnType<typeof nuevaOferta>> & { token: string }) | undefined;
    const ofertaAbierta = async () => {
      if (!abierta) {
        const token = await guest();
        abierta = { ...(await nuevaOferta(token)), token };
      }
      return abierta;
    };

    it('serves the seat map only to the owner, for a leg of that offer', async () => {
      const { token, res, ida } = await ofertaAbierta();
      const ofertaId = res.body.ofertaId as string;

      const map = await mapa(token, ofertaId, ida.itinerarioId).expect(200);
      expect(map.body.trayectoId).toBe(ida.itinerarioId);
      expect(map.body.filas.length).toBeGreaterThan(5);
      expect(map.body.filas[0].seats[0]).toMatchObject({ seatNumber: '1A', isAvailable: true });

      await api().get(`/api/v1/ofertas/${ofertaId}/asientos`).query({ trayectoId: ida.itinerarioId }).expect(401);
      const other = await mapa(await guest(), ofertaId, ida.itinerarioId);
      expect([403, 404]).toContain(other.status);
      await mapa(token, ofertaId, randomUUID()).expect(400);
    });

    it('rejects bad seat picks before any payment: missing seat, repeated seat, two seats on a leg, a lap infant', async () => {
      const { token, res, out, ida } = await ofertaAbierta();
      const ofertaId = res.body.ofertaId as string;
      const seat = (asiento: string, trayectoId = ida.itinerarioId) => ({ asientos: [{ trayectoId, asiento }] });
      const adult = (extra = {}) => pasajero('a1', 'ADULT', yearsBefore(35, out), extra);
      const child = (extra = {}) => pasajero('c1', 'CHILD', yearsBefore(8, out), extra);

      const missing = await seatPlan(token, ofertaId, [adult(seat('999F')), child()]).expect(422);
      expect(missing.body.code).toBe('SEAT_CABIN_MISMATCH');

      const repeated = await seatPlan(token, ofertaId, [adult(seat('3C')), child(seat('3C'))]).expect(409);
      expect(repeated.body.code).toBe('SEAT_TAKEN');

      const twice = await seatPlan(token, ofertaId, [adult({ asientos: [{ trayectoId: ida.itinerarioId, asiento: '4A' }, { trayectoId: ida.itinerarioId, asiento: '4B' }] }), child()]).expect(422);
      expect(twice.body.code).toBe('VALIDATION_FAILED');

      const foreignLeg = await seatPlan(token, ofertaId, [adult(seat('4A', randomUUID())), child()]).expect(400);
      expect(foreignLeg.body.code).toBe('VALIDATION_FAILED');

      // A lap infant takes no seat.
      const withInfant = await nuevaOferta(token, { pasajeros: { adultos: 1, ninos: 0, infantes: 1 } });
      expect(withInfant.res.status).toBe(201);
      const infantPlan = await seatPlan(token, withInfant.res.body.ofertaId, [
        pasajero('a1', 'ADULT', yearsBefore(35, withInfant.out)),
        pasajero('i1', 'INFANT', yearsBefore(1, withInfant.out), { asociadoA: 'a1', asientos: [{ trayectoId: withInfant.ida.itinerarioId, asiento: '5A' }] }),
      ]).expect(422);
      expect(infantPlan.body.code).toBe('INFANT_SEAT_NOT_ALLOWED');
    });

    it('buys with seats: the order shows them, the inventory records them, and the map marks them taken', async () => {
      const token = await guest();
      const { ofertaId, out, ida } = await ofertaConAsientos(token, { adulto: '10A', nino: '10B' });

      const res = await comprar(token, ofertaId).expect(201);
      const seatsOf = (id: string) => res.body.pasajeros.find((p: { id: string }) => p.id === id).asientos;
      expect(seatsOf('a1')).toEqual([{ numeroVuelo: expect.any(String), asiento: '10A' }]);
      expect(seatsOf('c1')).toEqual([{ numeroVuelo: expect.any(String), asiento: '10B' }]);

      const rows = await ds.getRepository(SeatAssignment).find({ where: { vueloId: ida.itinerarioId }, order: { seatNumber: 'ASC' } });
      expect(rows.map((r) => r.seatNumber)).toEqual(['10A', '10B']);

      // Another visitor shopping for the same flight sees them occupied.
      const rival = await guest();
      const { res: rivalOffer, ida: rivalIda } = await nuevaOferta(rival, { fechas: mismasFechas(out) });
      expect(rivalIda.itinerarioId).toBe(ida.itinerarioId);
      const map = await mapa(rival, rivalOffer.body.ofertaId, ida.itinerarioId).expect(200);
      const seats = map.body.filas.flatMap((f: { seats: { seatNumber: string; isAvailable: boolean }[] }) => f.seats);
      expect(seats.find((s: { seatNumber: string }) => s.seatNumber === '10A').isAvailable).toBe(false);
      expect(seats.find((s: { seatNumber: string }) => s.seatNumber === '10C').isAvailable).toBe(true);
    });

    it('reports a seat taken meanwhile BEFORE charging, and the customer can pick another and still buy', async () => {
      const first = await guest();
      const a = await ofertaConAsientos(first, { adulto: '12C' });

      const second = await guest();
      const b = await ofertaConAsientos(second, { adulto: '12C' }, mismasFechas(a.out)); // still free when picked
      expect(b.ida.itinerarioId).toBe(a.ida.itinerarioId);

      await comprar(first, a.ofertaId).expect(201);

      const blocked = await comprar(second, b.ofertaId).expect(409);
      expect(blocked.body.code).toBe('SEAT_TAKEN');
      expect(await pagos(b.ofertaId)).toHaveLength(0); // nothing was authorised, so nothing to void

      await seatPlan(second, b.ofertaId, [
        pasajero('a1', 'ADULT', yearsBefore(35, b.out), { asientos: [{ trayectoId: b.ida.itinerarioId, asiento: '12D' }] }),
        pasajero('c1', 'CHILD', yearsBefore(8, b.out)),
      ]).expect(200);
      await comprar(second, b.ofertaId).expect(201);
    });

    it('two purchases racing for one seat: exactly one is issued and the other is never captured', async () => {
      const first = await guest();
      const a = await ofertaConAsientos(first, { adulto: '15A' });
      const second = await guest();
      const b = await ofertaConAsientos(second, { adulto: '15A' }, mismasFechas(a.out));

      const results = await Promise.all([comprar(first, a.ofertaId), comprar(second, b.ofertaId)]);
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.find((r) => r.status !== 201)!.status).toBeGreaterThanOrEqual(400);

      const rows = await ds.getRepository(SeatAssignment).find({ where: { vueloId: a.ida.itinerarioId, seatNumber: '15A' } });
      expect(rows).toHaveLength(1);

      const loserOffer = results[0].status === 201 ? b.ofertaId : a.ofertaId;
      expect((await pagos(loserOffer)).filter((p) => p.estado === 'CAPTURADO')).toHaveLength(0);
    });
  });

  // Same shape as the seat tests' helper (which lives inside their own describe), kept here for the admin checks.
  async function ofertaConAsientosAdmin(token: string, asientos: { adulto: string; nino: string }) {
    const { res, out, ida } = await nuevaOferta(token);
    expect(res.status).toBe(201);
    const ofertaId = res.body.ofertaId as string;
    const pick = (seat: string) => ({ asientos: [{ trayectoId: ida.itinerarioId, asiento: seat }] });
    await api()
      .put(`/api/v1/ofertas/${ofertaId}/pasajeros`)
      .set(bearer(token))
      .send({
        pasajeros: [pasajero('a1', 'ADULT', yearsBefore(35, out), pick(asientos.adulto)), pasajero('c1', 'CHILD', yearsBefore(8, out), pick(asientos.nino))],
        contacto: { correo: 'comprador@example.com', telefono: '+593999999999' },
      })
      .expect(200);
    await api().put(`/api/v1/ofertas/${ofertaId}/facturacion`).set(bearer(token)).send({ tipoIdentificacion: 'CEDULA', numeroIdentificacion: '1712345678', razonSocial: 'María Peña', direccion: 'Av. Amazonas 123', pais: 'EC' }).expect(200);
    await api().post(`/api/v1/ofertas/${ofertaId}/condiciones`).set(bearer(token)).send({ versionTerminos: '2026-10', versionCondicionesTransporte: '2026-10' }).expect(200);
    return { ofertaId, ida };
  }

  // ------------------------------------------------------------------------------------------------
  describe('observabilidad del admin', () => {
    it('refuses everyone but an ADMIN (401 anonymous, 403 guest and customer); /health is public', async () => {
      const mine = await sharedCustomer();
      const guestToken = await guest();
      for (const path of ['/api/v1/admin/observabilidad/resumen', '/api/v1/admin/observabilidad/runtime']) {
        await api().get(path).expect(401);
        await api().get(path).set(bearer(guestToken)).expect(403);
        await api().get(path).set(bearer(mine.token)).expect(403);
      }
      const health = await api().get('/api/v1/health').expect(200);
      expect(health.body).toMatchObject({ status: 'UP', db: 'UP' });
      expect(health.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('validates the window', async () => {
      await api().get('/api/v1/admin/observabilidad/resumen').query({ ventana: '1h' }).set(bearer(adminToken)).expect(400);
    });

    it('summarises what the database holds, with no personal data', async () => {
      // Orders were bought by the tests above. First read of the 7-day window in this suite, so it is not served from the short cache.
      const res = await api().get('/api/v1/admin/observabilidad/resumen').query({ ventana: '7d' }).set(bearer(adminToken)).expect(200);
      const s = res.body;
      const desde = new Date(s.desde);

      const emitidas = await ds.getRepository(Orden).createQueryBuilder('o').where('o."estado" = :e AND o."creadaEn" >= :d', { e: 'EMITIDA', d: desde }).getCount();
      expect(s.ventana).toBe('7d');
      expect(s.ordenes.porEstado.EMITIDA).toBe(emitidas);
      expect(s.ordenes.total).toBe(Object.values(s.ordenes.porEstado as Record<string, number>).reduce((a, b) => a + b, 0));

      const capturados = await ds.getRepository(Pago).createQueryBuilder('p').where('p."estado" = :e AND p."creadoEn" >= :d', { e: 'CAPTURADO', d: desde }).getCount();
      expect(s.pagos.porEstado.CAPTURADO).toBe(capturados);

      const usd = s.ingresos.find((i: { moneda: string }) => i.moneda === 'USD');
      const sumRow = await ds
        .getRepository(Orden)
        .createQueryBuilder('o')
        .select('COALESCE(SUM(o."totalMinor"), 0)::text', 'total')
        .where('o."estado" IN (:...e) AND o."creadaEn" >= :d', { e: ['EMITIDA', 'MODIFICADA', 'EN_VIAJE', 'COMPLETADA'], d: desde })
        .getRawOne<{ total: string }>();
      expect(Number(usd.monto.replace('.', ''))).toBe(Number(sumRow!.total));

      expect(s.tasas.rechazoDePago === null || (s.tasas.rechazoDePago >= 0 && s.tasas.rechazoDePago <= 1)).toBe(true);
      expect(s.inventario.capacidad).toBeGreaterThan(0);
      expect(s.inventario.ocupacion).toBeGreaterThanOrEqual(0);
      for (const key of ['capturaPendiente', 'anulacionPendiente', 'autorizadoSinCaptura', 'emitidasSinConfirmacion']) {
        expect(typeof s.pendientes[key]).toBe('number');
      }
      expect(typeof s.holds.vencidosSinLiberar).toBe('number');

      // Aggregates only: nothing that identifies a traveller.
      expect(JSON.stringify(s)).not.toMatch(/Peña|Niño|María|comprador@example\.com|ORD-[A-Z0-9]{10}/);
    });

    it('reports live process metrics: traffic by route, events and the last reconciliation run', async () => {
      await app.get(ReconciliacionService).reconciliar();

      const res = await api().get('/api/v1/admin/observabilidad/runtime').set(bearer(adminToken)).expect(200);
      const s = res.body;
      expect(s.requests.total).toBeGreaterThan(0);
      expect(s.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(s.routes.some((r: { route: string; count: number }) => /\/ofertas\/:id\/compra$/.test(r.route) && r.count > 0)).toBe(true);
      expect(s.routes.every((r: { route: string }) => !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(r.route))).toBe(true); // patterns, not raw ids
      expect(s.events.OrdenEmitida).toBeGreaterThan(0);
      expect(s.jobs.reconciliacion).toMatchObject({ lastError: null });
      expect(s.jobs.reconciliacion.lastRunAt).toEqual(expect.any(String));
      expect(s.problemCodes).toBeDefined();
    });
  });

  // ------------------------------------------------------------------------------------------------
  describe('back-office: only an ADMIN reads across customers', () => {
    it('refuses everyone but an ADMIN (401 anonymous, 403 guest and customer) on every admin read', async () => {
      const mine = await sharedCustomer();
      const guestToken = await guest();
      for (const path of ['/api/v1/admin/ordenes', '/api/v1/admin/ordenes/ORD-AAAAAAAAAA', '/api/v1/admin/vuelos', `/api/v1/admin/vuelos/${randomUUID()}/asientos`]) {
        await api().get(path).expect(401);
        await api().get(path).set(bearer(guestToken)).expect(403);
        await api().get(path).set(bearer(mine.token)).expect(403);
      }
    });

    it('lists and filters orders of all customers for an ADMIN, and shows the full detail', async () => {
      const buyer = await customer();
      const { ofertaId } = await ofertaLista(buyer.token);
      const bought = (await comprar(buyer.token, ofertaId).expect(201)).body;

      const list = await api().get('/api/v1/admin/ordenes').query({ estado: 'EMITIDA', limit: 100 }).set(bearer(adminToken)).expect(200);
      const found = list.body.items.find((o: { numeroOrden: string }) => o.numeroOrden === bought.numeroOrden);
      expect(found).toMatchObject({ comprador: 'cliente', clienteId: buyer.clienteId, estado: 'EMITIDA' });
      expect(found.contacto).toBeDefined(); // the back office sees the contact

      const byPnr = await api().get('/api/v1/admin/ordenes').query({ pnr: bought.pnr }).set(bearer(adminToken)).expect(200);
      expect(byPnr.body.items.map((o: { numeroOrden: string }) => o.numeroOrden)).toEqual([bought.numeroOrden]);

      const detail = await api().get(`/api/v1/admin/ordenes/${bought.numeroOrden}`).set(bearer(adminToken)).expect(200);
      expect(detail.body.numeroOrden).toBe(bought.numeroOrden);
      await api().get('/api/v1/admin/ordenes/ORD-AAAAAAAAAA').set(bearer(adminToken)).expect(404);

      // The customer API stays owner-only: another customer cannot read it.
      const other = await customer();
      await api().get(`/api/v1/ordenes/${bought.numeroOrden}`).set(bearer(other.token)).expect(404);
    });

    it('pages orders by cursor and validates the filters', async () => {
      const page1 = await api().get('/api/v1/admin/ordenes').query({ limit: 1 }).set(bearer(adminToken)).expect(200);
      expect(page1.body.items).toHaveLength(1);
      expect(page1.body.nextCursor).toBeDefined();
      const page2 = await api().get('/api/v1/admin/ordenes').query({ limit: 1, cursor: page1.body.nextCursor }).set(bearer(adminToken)).expect(200);
      expect(page2.body.items[0].numeroOrden).not.toBe(page1.body.items[0].numeroOrden);

      await api().get('/api/v1/admin/ordenes').query({ estado: 'NOPE' }).set(bearer(adminToken)).expect(400);
      await api().get('/api/v1/admin/ordenes').query({ cursor: 'garbage' }).set(bearer(adminToken)).expect(400);
    });

    it('lists flights with their inventory, filtered by route and flight number', async () => {
      const route = await api().get('/api/v1/admin/vuelos').query({ origen: 'BOG', destino: 'SCL', limit: 5 }).set(bearer(adminToken)).expect(200);
      expect(route.body.items.length).toBeGreaterThan(0);
      for (const v of route.body.items) expect(v).toMatchObject({ origen: 'BOG', destino: 'SCL' });
      expect(route.body.items[0]).toEqual(expect.objectContaining({ asientosDisponibles: expect.any(Number), capacidadTotal: expect.any(Number), precioBaseUsd: expect.any(Number) }));

      const one = await api().get('/api/v1/admin/vuelos').query({ vuelo: 'LA1500', fecha: dayAhead(20) }).set(bearer(adminToken)).expect(200);
      expect(one.body.items).toHaveLength(1);
      expect(one.body.items[0].codigoVuelo).toBe('LA1500');
    });

    it('shows the admin the QR and seats of each ticket on an order, and the reserved seats of a flight', async () => {
      const buyer = await guest();
      const { ofertaId, ida } = await ofertaConAsientosAdmin(buyer, { adulto: '20C', nino: '20D' });
      const bought = (await comprar(buyer, ofertaId).expect(201)).body;

      // Order detail: one signed QR per passenger, the same text the customer gets, plus the chosen seats.
      const detail = await api().get(`/api/v1/admin/ordenes/${bought.numeroOrden}`).set(bearer(adminToken)).expect(200);
      expect(detail.body.pasajeros).toHaveLength(2);
      for (const [i, p] of detail.body.pasajeros.entries()) {
        expect(p.qr).toBe(bought.pasajeros[i].qr);
        expect(p.qr).toMatch(/^v1\.\d{13}\.[A-Z0-9]{6}\.[A-Za-z0-9_-]{22}$/);
      }
      expect(detail.body.pasajeros.map((p: { asientos: { asiento: string }[] }) => p.asientos[0].asiento).sort()).toEqual(['20C', '20D']);

      // Flight list: how many numbered seats are already taken.
      const list = await api().get('/api/v1/admin/vuelos').query({ vuelo: bought.itinerarios[0].numeroVuelo, fecha: bought.itinerarios[0].salida.slice(0, 10) }).set(bearer(adminToken)).expect(200);
      const row = list.body.items.find((f: { vueloId: string }) => f.vueloId === ida.itinerarioId);
      expect(row.asientosReservados).toBe(2);

      // The cabin of that flight: reserved seats with their locator and order, no names.
      const cabin = await api().get(`/api/v1/admin/vuelos/${ida.itinerarioId}/asientos`).set(bearer(adminToken)).expect(200);
      expect(cabin.body.reservados).toEqual([
        { asiento: '20C', pnr: bought.pnr, numeroOrden: bought.numeroOrden },
        { asiento: '20D', pnr: bought.pnr, numeroOrden: bought.numeroOrden },
      ]);
      const seats = cabin.body.filas.flatMap((f: { seats: { seatNumber: string; isAvailable: boolean }[] }) => f.seats);
      expect(seats.find((s: { seatNumber: string }) => s.seatNumber === '20C').isAvailable).toBe(false);
      expect(seats.find((s: { seatNumber: string }) => s.seatNumber === '20A').isAvailable).toBe(true);
      expect(JSON.stringify(cabin.body)).not.toMatch(/Peña|Niño|María|comprador@example\.com/);

      await api().get(`/api/v1/admin/vuelos/${randomUUID()}/asientos`).set(bearer(adminToken)).expect(404);
      await api().get('/api/v1/admin/vuelos/not-a-uuid/asientos').set(bearer(adminToken)).expect(400);
    });
  });

  // ------------------------------------------------------------------------------------------------
  describe('historial, privacidad y abuso', () => {
    it('adds a trip bought as a guest to an account, once, and never takes it from another account', async () => {
      const guestToken = await guest();
      const { ofertaId } = await ofertaLista(guestToken);
      const bought = (await comprar(guestToken, ofertaId).expect(201)).body;
      const claim = (token: string, body: Record<string, unknown>) => api().post('/api/v1/clientes/me/ordenes').set(bearer(token)).send(body);

      const mine = await sharedCustomer();
      expect((await api().get('/api/v1/clientes/me/ordenes').set(bearer(mine.token)).expect(200)).body.items).toHaveLength(0); // before

      // proof required: a wrong surname looks like a missing order; a guest cannot claim; one identifier only
      await claim(mine.token, { numero: bought.numeroOrden, apellido: 'Nadie' }).expect(404);
      await claim(guestToken, { numero: bought.numeroOrden, apellido: 'Peña' }).expect(403);
      await claim(mine.token, { numero: bought.numeroOrden, pnr: bought.pnr, apellido: 'Peña' }).expect(400);

      const linked = await claim(mine.token, { pnr: bought.pnr, apellido: 'Peña' }).expect(200);
      expect(linked.body.numeroOrden).toBe(bought.numeroOrden);

      const history = await api().get('/api/v1/clientes/me/ordenes').set(bearer(mine.token)).expect(200);
      expect(history.body.items.map((o: { numeroOrden: string }) => o.numeroOrden)).toEqual([bought.numeroOrden]);
      await api().get(`/api/v1/ordenes/${bought.numeroOrden}`).set(bearer(mine.token)).expect(200); // now owner-readable
      expect(await ds.getRepository(Booking).count({ where: { ownerId: mine.clienteId } })).toBe(1);

      // idempotent for the owner; another account cannot take it; the old guest session no longer reads it
      await claim(mine.token, { numero: bought.numeroOrden, apellido: 'Peña' }).expect(200);
      await claim(adminToken, { numero: bought.numeroOrden, apellido: 'Peña' }).expect(404); // another account
      await api().get(`/api/v1/ordenes/${bought.numeroOrden}`).set(bearer(guestToken)).expect(404);
    });

    it('lists a customer’s orders newest first with a stable cursor, and keeps them private', async () => {
      const mine = await customer();
      const numeros: string[] = [];
      for (let i = 0; i < 3; i++) {
        const { ofertaId } = await ofertaLista(mine.token);
        numeros.push((await comprar(mine.token, ofertaId).expect(201)).body.numeroOrden);
      }

      const page1 = await api().get('/api/v1/clientes/me/ordenes').query({ limit: 2 }).set(bearer(mine.token)).expect(200);
      expect(page1.body.items).toHaveLength(2);
      expect(page1.body.items[0].numeroOrden).toBe(numeros[2]); // newest first
      const page2 = await api().get('/api/v1/clientes/me/ordenes').query({ limit: 2, cursor: page1.body.nextCursor }).set(bearer(mine.token)).expect(200);
      expect(page2.body.items.map((o: { numeroOrden: string }) => o.numeroOrden)).toEqual([numeros[0]]);
      expect(page2.body.nextCursor).toBeUndefined();
      expect(page1.body.items[0].contacto).toBeDefined(); // the owner's own view keeps the contact data

      const other = await customer();
      expect((await api().get('/api/v1/clientes/me/ordenes').set(bearer(other.token)).expect(200)).body.items).toEqual([]);
      await api().get(`/api/v1/clientes/${mine.clienteId}/ordenes`).set(bearer(other.token)).expect(403);
      await api().get('/api/v1/clientes/me/ordenes').set(bearer(await guest())).expect(403);
      await api().get('/api/v1/clientes/me/ordenes').query({ cursor: 'garbage' }).set(bearer(mine.token)).expect(400);
      await api().get('/api/v1/ordenes/ORD-AAAAAAAAAA').set(bearer(mine.token)).expect(404);
    });

    it('stores personal data encrypted: no passenger name, document or e-mail appears in clear in the database', async () => {
      const token = await guest();
      const { ofertaId } = await ofertaLista(token);
      const order = (await comprar(token, ofertaId).expect(201)).body;

      const rows = {
        oferta: (await ds.query(`SELECT "datosPasajeros", "facturacion" FROM ${q('ecom_ofertas')} WHERE "ofertaId" = $1`, [ofertaId]))[0],
        orden: (await ds.query(`SELECT "pasajeros", "contacto", "facturacion" FROM ${q('ecom_ordenes')} WHERE "ordenId" = $1`, [order.ordenId]))[0],
        mail: (await ds.query(`SELECT "cuerpo" FROM ${q('ecom_notificaciones')} WHERE "referencia" = $1`, [order.numeroOrden]))[0],
      };
      const raw = JSON.stringify(rows);
      for (const secret of ['PENA', 'MARIA', 'ABA1', 'comprador@example.com', '1712345678', order.pasajeros[0].eTicket]) {
        expect(raw).not.toContain(secret);
      }
      expect(rows.orden.pasajeros).toMatch(/^v1:/);
      // ...and the application still reads it back.
      expect((await api().get(`/api/v1/ordenes/${order.numeroOrden}`).set(bearer(token)).expect(200)).body.contacto.correo).toBe('comprador@example.com');
      expect((await ds.getRepository(Orden).findOneByOrFail({ ordenId: order.ordenId })).pasajeros[0].nombres).toBe('MARIA JOSE');
    });

    it('rate-limits the public order lookup per client (RNF-19)', async () => {
      let limited = 0;
      for (let i = 0; i < 14; i++) {
        const res = await api().get('/api/v1/ordenes').query({ numero: 'ORD-AAAAAAAAAA', apellido: 'nadie' });
        if (res.status === 429) limited += 1;
        else expect(res.status).toBe(404);
      }
      expect(limited).toBeGreaterThan(0);
    });
  });

  it('seeded reference data is complete and the seed is idempotent', async () => {
    const before = await ds.getRepository(Localidad).count();
    const second = await seedEcommerce(ds, ADMIN);
    expect(second).toEqual({ mercados: 0, localidades: 0, plantillas: 0, administradores: 0 });
    expect(await ds.getRepository(Localidad).count()).toBe(before);
    expect(await ds.getRepository(Mercado).count()).toBe(1);
  });

  it('replaces the placeholder legal data of an old seed, but never an admin edit', async () => {
    const repo = ds.getRepository(Mercado);
    const current = await repo.findOneByOrFail({ codigo: 'ec' });
    const old = { ...current.textosLegales, razonSocial: 'Booking Hub Vuelos Ecuador S.A. (dato de ejemplo)', terminos: { version: '2026-10', url: 'https://www.example.com/ec/es/terminos' } };

    await repo.update({ codigo: 'ec' }, { textosLegales: old });
    await seedEcommerce(ds, ADMIN);
    expect((await repo.findOneByOrFail({ codigo: 'ec' })).textosLegales.terminos.url).toBe('/terminos');

    const edited = { ...current.textosLegales, razonSocial: 'Empresa real S.A.' };
    await repo.update({ codigo: 'ec' }, { textosLegales: edited });
    await seedEcommerce(ds, ADMIN);
    expect((await repo.findOneByOrFail({ codigo: 'ec' })).textosLegales.razonSocial).toBe('Empresa real S.A.');
  });
});
