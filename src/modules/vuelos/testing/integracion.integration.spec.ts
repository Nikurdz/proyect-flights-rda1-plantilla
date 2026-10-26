import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { Factura } from '../ecommerce/facturacion/entities/factura.entity';
import { CatalogoExterno } from '../ecommerce/integracion/entities/catalogo-externo.entity';
import { ProveedorSalud } from '../ecommerce/integracion/entities/proveedor-salud.entity';
import { Proveedor } from '../ecommerce/integracion/entities/proveedor.entity';
import { ReservaExterna } from '../ecommerce/integracion/entities/reserva-externa.entity';
import { SaludProveedoresService } from '../ecommerce/integracion/salud-proveedores.service';
import { AuditoriaSaga } from '../ecommerce/observabilidad/entities/auditoria.entity';
import { Pago } from '../ecommerce/pagos/entities/pago.entity';
import { seedEcommerce } from '../ecommerce/seed/ecommerce.seed';
import { partnerFalso } from './partner-falso';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(180_000);

const ADMIN = { correo: 'admin@example.com', contrasena: 'AdminPass-12345' };

describeIntegration('Gestión de Proveedores y reservas de experiencias against a real Postgres', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let ds: DataSource;
  let adminToken: string;
  const partner = partnerFalso();
  let baseUrl: string;
  let proveedorId: string;
  let tourId: string; // free cancellation
  let telefericoId: string; // not refundable

  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const guest = async () => (await api().post('/api/v1/auth/invitado').expect(201)).body.accessToken as string;
  const admin = (method: 'get' | 'post' | 'patch' | 'delete', path: string) => api()[method](`/api/v1/admin/proveedores${path}`).set(bearer(adminToken));

  const facturacion = { tipoIdentificacion: 'CEDULA', numeroIdentificacion: '1712345678', razonSocial: 'María Peña', direccion: 'Av. Amazonas 123', pais: 'EC' };
  const cuerpo = (extra: Record<string, unknown> = {}) => ({ fecha: '2099-12-20', hora: '10:30', cantidad: 2, nombre: 'María Peña', correo: 'maria@example.com', facturacion, medio: { tipo: 'TARJETA', token: 'tok_visa_ok', marca: 'VISA' }, ...extra });
  const reservar = (token: string, id: string, body: Record<string, unknown> = cuerpo(), key: string = randomUUID()) =>
    api().post(`/api/v1/experiencias/${id}/reservas`).set(bearer(token)).set('Idempotency-Key', key).send(body);

  beforeAll(async () => {
    await new Promise<void>((resolve) => partner.server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(partner.server.address() as AddressInfo).port}`;
    ctx = await createIntegrationApp({ PROVEEDORES_ALLOW_PRIVATE_HOSTS: 'true', PROVEEDORES_BREAKER_RESET_MS: '1000' });
    app = ctx.app;
    ds = ctx.dataSource;
    await seedEcommerce(ds, ADMIN);
    adminToken = (await api().post('/api/v1/auth/login').send({ correo: ADMIN.correo, contrasena: ADMIN.contrasena }).expect(200)).body.accessToken;
  });

  afterAll(async () => {
    await ctx?.close();
    await new Promise((resolve) => partner.server.close(resolve));
  });

  it('is for ADMIN only: 401 anonymous, 403 guest', async () => {
    const token = await guest();
    for (const [method, path] of [['get', ''], ['post', ''], ['post', `/${randomUUID()}/ping`], ['post', `/${randomUUID()}/sincronizar`], ['delete', `/${randomUUID()}`]] as const) {
      expect((await api()[method](`/api/v1/admin/proveedores${path}`).send({})).status).toBe(401);
      expect((await api()[method](`/api/v1/admin/proveedores${path}`).set(bearer(token)).send({})).status).toBe(403);
    }
  });

  it('registers a provider (the API version prefix is added), rejects a duplicate name and a bad URL', async () => {
    const creado = await admin('post', '').send({ nombre: 'Atracciones Quito', equipo: 'Equipo Atracciones', baseUrl, tipoServicio: 'ATRACCIONES' }).expect(201);
    expect(creado.body).toMatchObject({ nombre: 'Atracciones Quito', baseUrl: `${baseUrl}/api/v2`, tipoServicio: 'ATRACCIONES', activo: true, productos: 0, circuito: 'CERRADO', salud: { estado: 'SIN_DATOS' } });
    proveedorId = creado.body.id;

    await admin('post', '').send({ nombre: 'Atracciones Quito', equipo: 'Equipo X', baseUrl, tipoServicio: 'ATRACCIONES' }).expect(409);
    await admin('post', '').send({ nombre: 'Otro', equipo: 'Equipo X', baseUrl: 'no es una url', tipoServicio: 'ATRACCIONES' }).expect(400);
    await admin('post', '').send({ nombre: 'Otro', equipo: 'Equipo X', baseUrl, tipoServicio: 'HOTELES' }).expect(400);
    expect((await admin('get', '').expect(200)).body).toHaveLength(1);
  });

  it('pings: green with the latency, red when the partner is down, and the history keeps both', async () => {
    const arriba = await admin('post', `/${proveedorId}/ping`).expect(200);
    expect(arriba.body).toMatchObject({ estado: 'UP', detalle: null });
    expect(arriba.body.latenciaMs).toBeGreaterThanOrEqual(0);

    partner.estado.modo = 'down';
    const caido = await admin('post', `/${proveedorId}/ping`).expect(200);
    expect(caido.body).toMatchObject({ estado: 'DOWN', latenciaMs: null });
    expect((await admin('get', `/${proveedorId}`).expect(200)).body.salud.estado).toBe('DOWN');

    partner.estado.modo = 'ok';
    // The circuit counts the failure; with so few calls it stays closed and the partner answers again.
    expect((await admin('post', `/${proveedorId}/ping`).expect(200)).body.estado).toBe('UP');
    const historial = (await admin('get', `/${proveedorId}/salud`).expect(200)).body as { estado: string }[];
    expect(historial.map((h) => h.estado)).toEqual(['UP', 'DOWN', 'UP']);
    // A change of state was announced (and audited).
    expect(await ds.getRepository(ProveedorSalud).count({ where: { proveedorId } })).toBe(3);
  });

  it('the health job checks every active provider', async () => {
    const antes = await ds.getRepository(ProveedorSalud).count({ where: { proveedorId } });
    expect(await app.get(SaludProveedoresService).comprobarTodos()).toEqual({ comprobados: 1, caidos: 0 });
    expect(await ds.getRepository(ProveedorSalud).count({ where: { proveedorId } })).toBe(antes + 1);
  });

  it('synchronises the catalogue: skips what is unusable, updates on a second run, hides what the partner drops', async () => {
    const primera = await admin('post', `/${proveedorId}/sincronizar`).expect(200);
    expect(primera.body).toEqual({ importados: 2, nuevos: 2, actualizados: 0, desactivados: 0 });
    const filas = await ds.getRepository(CatalogoExterno).find({ where: { proveedorId }, relations: { categorias: true } });
    const tour = filas.find((f) => f.externalId === 'p-1')!;
    expect(tour).toMatchObject({ nombre: 'City tour Quito', precioMinor: 4500, moneda: 'USD', tipo: 'GUIDED_TOUR', cancelacionGratis: true, activo: true });
    expect(tour.categorias.map((c) => c.categoria).sort()).toEqual(['Cultura', 'Tours']);
    tourId = tour.id;
    telefericoId = filas.find((f) => f.externalId === 'p-2')!.id;

    expect((await admin('post', `/${proveedorId}/sincronizar`).expect(200)).body).toEqual({ importados: 2, nuevos: 0, actualizados: 2, desactivados: 0 });

    const quitado = partner.estado.productos.splice(1, 1);
    expect((await admin('post', `/${proveedorId}/sincronizar`).expect(200)).body).toMatchObject({ importados: 1, desactivados: 1 });
    expect((await api().get('/api/v1/experiencias').expect(200)).body.total).toBe(1);
    partner.estado.productos.splice(1, 0, ...quitado);
    await admin('post', `/${proveedorId}/sincronizar`).expect(200); // it is listed again and shows again
    expect((await api().get('/api/v1/experiencias').expect(200)).body.total).toBe(2);
  });

  it('shows the synchronised catalogue to anybody, with a search, and hides it when the provider is switched off', async () => {
    const lista = (await api().get('/api/v1/experiencias').query({ q: 'tour' }).expect(200)).body;
    expect(lista.items).toHaveLength(1);
    expect(lista.items[0]).toMatchObject({ id: tourId, nombre: 'City tour Quito', proveedor: 'Atracciones Quito', precio: { moneda: 'USD' }, cancelacionGratis: true, categorias: ['Cultura', 'Tours'] });
    expect((await api().get(`/api/v1/experiencias/${tourId}`).expect(200)).body.nombre).toBe('City tour Quito');
    await api().get(`/api/v1/experiencias/${randomUUID()}`).expect(404);

    await admin('patch', `/${proveedorId}`).send({ activo: false }).expect(200);
    expect((await api().get('/api/v1/experiencias').expect(200)).body.total).toBe(0);
    await api().get(`/api/v1/experiencias/${tourId}`).expect(404);
    await reservar(await guest(), tourId).expect(404);
    await admin('post', `/${proveedorId}/ping`).expect(409);
    await admin('post', `/${proveedorId}/sincronizar`).expect(409);
    expect((await admin('get', `/${proveedorId}`).expect(200)).body.salud.estado).toBe('APAGADO');

    await admin('patch', `/${proveedorId}`).send({ activo: true }).expect(200);
    expect((await api().get('/api/v1/experiencias').expect(200)).body.total).toBe(2);
  });

  it('reserves: pays, books at the partner, invoices, captures; a retry with the same key books nothing twice', async () => {
    const token = await guest();
    const key = randomUUID();
    const res = await reservar(token, tourId, cuerpo(), key).expect(201);
    expect(res.body).toMatchObject({ estado: 'CONFIRMADA', cantidad: 2, cancelacionGratis: true, total: { moneda: 'USD' }, experiencia: { nombre: 'City tour Quito', proveedor: 'Atracciones Quito' } });
    expect(res.body.factura).toMatch(/^FAC-[A-Z0-9]{10}$/);
    expect(res.body.referenciaProveedor).toBeTruthy();
    expect(partner.estado.reservas.has(res.body.referenciaProveedor)).toBe(true);

    const reserva = await ds.getRepository(ReservaExterna).findOneByOrFail({ id: res.body.id });
    expect(reserva).toMatchObject({ totalMinor: 9000, nombreCliente: 'María Peña', correoCliente: 'maria@example.com', clienteId: null });
    const pago = await ds.getRepository(Pago).findOneByOrFail({ reservaExternaId: reserva.id });
    expect(pago).toMatchObject({ estado: 'CAPTURADO', ofertaId: null, montoMinor: 9000 });

    const factura = await ds.getRepository(Factura).findOneOrFail({ where: { reservaExternaId: reserva.id }, relations: { detalles: true } });
    expect(factura).toMatchObject({ estado: 'EMITIDA', totalMinor: 9000, ordenId: null });
    expect(factura.subtotalMinor + factura.ivaMinor).toBe(9000);
    expect(factura.ivaMinor).toBe(1174); // 15 % of the net price
    expect(factura.detalles).toHaveLength(1);

    const saga = await ds.getRepository(AuditoriaSaga).findOneOrFail({ where: { referencia: reserva.id }, relations: { pasos: true } });
    expect(saga).toMatchObject({ tipo: 'RESERVA_EXTERNA', estado: 'COMPLETADA' });
    expect([...saga.pasos].sort((a, b) => a.secuencia - b.secuencia).map((p) => p.nombre)).toEqual(['AUTORIZAR_PAGO', 'RESERVAR_PROVEEDOR', 'VERIFICAR_PRECIO', 'CONFIRMAR_Y_FACTURAR', 'CAPTURAR_PAGO']);

    const antes = partner.estado.reservas.size;
    const replay = await reservar(token, tourId, cuerpo(), key).expect(201);
    expect(replay.body.id).toBe(res.body.id);
    expect(partner.estado.reservas.size).toBe(antes);
    expect(await ds.getRepository(ReservaExterna).count({ where: { ownerId: reserva.ownerId } })).toBe(1);

    expect((await api().get('/api/v1/reservas-externas').set(bearer(token)).expect(200)).body.items).toHaveLength(1);
    await api().get(`/api/v1/reservas-externas/${res.body.id}`).set(bearer(await guest())).expect(404); // somebody else's
    expect((await admin('get', '/reservas/todas').expect(200)).body.items.length).toBeGreaterThan(0);

    // The fiscal console lists the invoice, with its lines in the detail; only for an ADMIN.
    const lista = (await api().get('/api/v1/admin/facturas').query({ origen: 'EXPERIENCIA' }).set(bearer(adminToken)).expect(200)).body;
    expect(lista.items.map((f: { numeroFactura: string }) => f.numeroFactura)).toContain(res.body.factura);
    expect(lista.items[0]).toMatchObject({ origen: 'EXPERIENCIA', estado: 'EMITIDA' });
    const detalle = (await api().get('/api/v1/admin/facturas/' + res.body.factura).set(bearer(adminToken)).expect(200)).body;
    expect(detalle.detalles).toHaveLength(1);
    await api().get('/api/v1/admin/facturas').set(bearer(token)).expect(403);
    await api().get('/api/v1/admin/facturas').expect(401);
  });

  it('refuses before touching the partner: declined card, bad tax id, past date, brand not accepted', async () => {
    const token = await guest();
    const llamadas = partner.estado.llamadas.length;
    const declinada = await reservar(token, tourId, cuerpo({ medio: { tipo: 'TARJETA', token: 'tok_declined', marca: 'VISA' } })).expect(402);
    expect(declinada.body.code).toBe('PAYMENT_DECLINED');
    expect(partner.estado.llamadas.length).toBe(llamadas);
    expect((await ds.getRepository(ReservaExterna).find({ where: { estado: 'FALLIDA_COMPENSADA' } })).length).toBeGreaterThan(0);

    await reservar(token, tourId, cuerpo({ facturacion: { ...facturacion, numeroIdentificacion: '1234' } })).expect(422);
    await reservar(token, tourId, cuerpo({ fecha: '2020-01-01' })).expect(400);
    await reservar(token, tourId, cuerpo({ medio: { tipo: 'TARJETA', token: 'tok_visa_ok', marca: 'HIPERCARD' } })).expect(422);
    await api().post(`/api/v1/experiencias/${tourId}/reservas`).send(cuerpo()).expect(401);
    expect(partner.estado.llamadas.length).toBe(llamadas);
  });

  it('compensates when the partner refuses: the authorisation is released and nothing is charged', async () => {
    partner.estado.modo = 'refuse';
    const token = await guest();
    const res = await reservar(token, tourId).expect(409);
    expect(res.body).toMatchObject({ code: 'EXTERNAL_RESERVATION_FAILED_COMPENSATED' });
    const reserva = await ds.getRepository(ReservaExterna).findOneOrFail({ where: { motivo: 'partner_refused:409' } });
    expect(reserva.estado).toBe('FALLIDA_COMPENSADA');
    expect((await ds.getRepository(Pago).findOneByOrFail({ reservaExternaId: reserva.id })).estado).toBe('ANULADO');
    expect(await ds.getRepository(Factura).count({ where: { reservaExternaId: reserva.id } })).toBe(0);
    expect((await ds.getRepository(AuditoriaSaga).findOneByOrFail({ referencia: reserva.id })).estado).toBe('COMPENSADA');
    partner.estado.modo = 'ok';
  });

  it('opens the circuit while the partner keeps failing, answers 503 at once, and closes it when the partner is back', async () => {
    partner.estado.modo = 'down';
    // The circuit opens when at least half of the recent calls failed: the successes of the earlier tests count, so it takes a few.
    let abierto = false;
    for (let i = 0; i < 40 && !abierto; i++) {
      const res = await reservar(await guest(), tourId);
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('EXTERNAL_RESERVATION_FAILED_COMPENSATED');
      abierto = (await admin('get', `/${proveedorId}`).expect(200)).body.circuito === 'ABIERTO';
    }
    expect(abierto).toBe(true);
    const token = await guest();
    const llamadas = partner.estado.llamadas.length;
    await reservar(token, tourId).expect(503);
    expect(partner.estado.llamadas.length).toBe(llamadas); // the open circuit did not even try
    const pagos = await ds.getRepository(Pago).find({ where: { estado: 'AUTORIZADO' } });
    expect(pagos).toHaveLength(0); // every authorisation was released

    partner.estado.modo = 'ok';
    await new Promise((resolve) => setTimeout(resolve, 1200)); // the reset time passes: one trial call
    expect((await admin('post', `/${proveedorId}/ping`).expect(200)).body.estado).toBe('UP');
    expect((await admin('get', `/${proveedorId}`).expect(200)).body.circuito).toBe('CERRADO');
  });

  it('cancels a free-cancellation reservation (partner first, then the refund and the invoice) and refuses the rest', async () => {
    const token = await guest();
    const hecha = (await reservar(token, tourId).expect(201)).body;
    const key = randomUUID();
    const cancelada = await api().post(`/api/v1/reservas-externas/${hecha.id}/cancelar`).set(bearer(token)).set('Idempotency-Key', key).send({ motivo: 'Cambio de planes' }).expect(200);
    expect(cancelada.body.estado).toBe('CANCELADA');
    expect(partner.estado.cancelaciones).toContain(hecha.referenciaProveedor);
    expect((await ds.getRepository(Pago).findOneByOrFail({ reservaExternaId: hecha.id })).estado).toBe('REEMBOLSADO');
    expect((await ds.getRepository(Factura).findOneByOrFail({ reservaExternaId: hecha.id })).estado).toBe('ANULADA');

    const repetida = await api().post(`/api/v1/reservas-externas/${hecha.id}/cancelar`).set(bearer(token)).set('Idempotency-Key', randomUUID()).send({}).expect(200);
    expect(repetida.body.estado).toBe('CANCELADA');
    await api().post(`/api/v1/reservas-externas/${hecha.id}/cancelar`).set(bearer(await guest())).set('Idempotency-Key', randomUUID()).send({}).expect(404);

    const sinReembolso = (await reservar(token, telefericoId, cuerpo({ cantidad: 1 })).expect(201)).body;
    const res = await api().post(`/api/v1/reservas-externas/${sinReembolso.id}/cancelar`).set(bearer(token)).set('Idempotency-Key', randomUUID()).send({}).expect(409);
    expect(res.body.code).toBe('EXTERNAL_RESERVATION_NOT_REFUNDABLE');
  });

  it('will not delete a provider that sold something (switch it off), but deletes one that did not', async () => {
    const res = await admin('delete', `/${proveedorId}`).expect(409);
    expect(res.body.code).toBe('PROVIDER_IN_USE');

    const otro = (await admin('post', '').send({ nombre: 'Autos Costa', equipo: 'Equipo Autos', baseUrl, tipoServicio: 'AUTOS' }).expect(201)).body;
    // A cars provider can be watched but its catalogue cannot be imported yet.
    const sync = await admin('post', `/${otro.id}/sincronizar`).expect(422);
    expect(sync.body.code).toBe('PROVIDER_ACTION_NOT_SUPPORTED');
    await admin('delete', `/${otro.id}`).expect(204);
    await admin('get', `/${otro.id}`).expect(404);
    expect(await ds.getRepository(Proveedor).count()).toBe(1);
  });
});
