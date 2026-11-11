import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { Factura } from '../ecommerce/facturacion/entities/factura.entity';
import { seedEcommerce } from '../ecommerce/seed/ecommerce.seed';
import { EsbRouter } from '../esb/esb-router';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';
import { partnerFalso } from './partner-falso';

jest.setTimeout(180_000);

const ADMIN = { correo: 'admin@example.com', contrasena: 'AdminPass-12345' };

describeIntegration('GraphQL gateway (BFF) against a real Postgres', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  let ds: DataSource;
  let adminToken: string;
  const partner = partnerFalso();
  let experienciaId: string;

  const rest = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const guest = async () => (await rest().post('/api/v1/auth/invitado').expect(201)).body.accessToken as string;
  const gql = (query: string, token?: string, variables: Record<string, unknown> = {}) => {
    const r = rest().post('/graphql').send({ query, variables });
    return token ? r.set(bearer(token)) : r;
  };
  const codigo = (res: request.Response): string | undefined => res.body.errors?.[0]?.extensions?.code;

  const facturacion = { tipoIdentificacion: 'CEDULA', numeroIdentificacion: '1712345678', razonSocial: 'María Peña', direccion: 'Av. Amazonas 123', pais: 'EC' };
  const input = (extra: Record<string, unknown> = {}) => ({ fecha: '2099-12-20', hora: '10:30', cantidad: 2, nombre: 'María Peña', correo: 'maria@example.com', facturacion, medio: { tipo: 'TARJETA', token: 'tok_visa_ok', marca: 'VISA' }, ...extra });
  const CHECKOUT = `mutation ($id: String!, $input: ReservarExperienciaInput!, $key: String!) { checkoutExterno(experienciaId: $id, input: $input, idempotencyKey: $key) { id estado cantidad total { moneda monto } factura { numeroFactura estado total { monto } detalles { linea concepto } } } }`;

  beforeAll(async () => {
    await new Promise<void>((resolve) => partner.server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${(partner.server.address() as AddressInfo).port}`;
    ctx = await createIntegrationApp({ PROVEEDORES_ALLOW_PRIVATE_HOSTS: 'true' });
    app = ctx.app;
    ds = ctx.dataSource;
    await seedEcommerce(ds, ADMIN);
    adminToken = (await rest().post('/api/v1/auth/login').send({ correo: ADMIN.correo, contrasena: ADMIN.contrasena }).expect(200)).body.accessToken;
    const proveedor = (await rest().post('/api/v1/admin/proveedores').set(bearer(adminToken)).send({ nombre: 'Atracciones Quito', equipo: 'Equipo Atracciones', baseUrl, tipoServicio: 'ATRACCIONES' }).expect(201)).body;
    await rest().post(`/api/v1/admin/proveedores/${proveedor.id}/sincronizar`).set(bearer(adminToken)).expect(200);
    experienciaId = (await rest().get('/api/v1/experiencias').query({ q: 'tour' }).expect(200)).body.items[0].id;
  });

  afterAll(async () => {
    await ctx?.close();
    await new Promise((resolve) => partner.server.close(resolve));
  });

  it('answers at /graphql next to the REST API, and the bus has the routes the gateway uses', async () => {
    const res = await gql('{ __schema { queryType { name } } }').expect(200);
    expect(res.body.data.__schema.queryType.name).toBe('Query');
    expect(app.get(EsbRouter).rutasRegistradas()).toEqual(expect.arrayContaining(['catalogo.unificado', 'experiencias.reservar', 'reservas.mias']));
  });

  it('the catalogue is public and joins what the partner offers', async () => {
    const res = await gql('{ catalogoUnificado(q: "tour") { vuelos { id } experiencias { id nombre proveedor precio { moneda monto } categorias cancelacionGratis } } }').expect(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.catalogoUnificado.experiencias[0]).toMatchObject({ nombre: 'City tour Quito', proveedor: 'Atracciones Quito', precio: { moneda: 'USD', monto: '45.00' }, cancelacionGratis: true });
    expect(res.body.data.catalogoUnificado.vuelos).toEqual([]); // no date: only experiences
  });

  it('asks for who you are: 401-like errors for anonymous, forbidden for non-admin, and the same data as REST for the admin', async () => {
    expect(codigo(await gql('{ misReservas { ordenes { numeroOrden } } }'))).toBe('UNAUTHORIZED');
    const token = await guest();
    expect(codigo(await gql('{ saludNodos { nombre } }', token))).toBe('FORBIDDEN');
    expect(codigo(await gql('{ auditoriaSagas { sagaId } }', token))).toBe('FORBIDDEN');
    expect(codigo(await gql('{ auditoriaTransacciones { id } }'))).toBe('UNAUTHORIZED');

    const salud = await gql('{ saludNodos { nombre equipo tipoServicio activo estado circuito productos } }', adminToken).expect(200);
    expect(salud.body.data.saludNodos[0]).toMatchObject({ nombre: 'Atracciones Quito', tipoServicio: 'ATRACCIONES', activo: true, circuito: 'CERRADO', productos: 2 });
  });

  it('checks out through the saga, with the invoice resolved by a loader, and replays on the same key', async () => {
    const token = await guest();
    const key = randomUUID();
    const res = await gql(CHECKOUT, token, { id: experienciaId, input: input(), key }).expect(200);
    expect(res.body.errors).toBeUndefined();
    const reserva = res.body.data.checkoutExterno;
    expect(reserva).toMatchObject({ estado: 'CONFIRMADA', cantidad: 2, total: { monto: '90.00' }, factura: { estado: 'EMITIDA', total: { monto: '90.00' } } });
    expect(reserva.factura.detalles).toHaveLength(1);

    const repetido = await gql(CHECKOUT, token, { id: experienciaId, input: input(), key }).expect(200);
    expect(repetido.body.data.checkoutExterno.id).toBe(reserva.id);

    const mias = await gql('{ misReservas { ordenes { numeroOrden } experiencias { id estado experiencia factura { numeroFactura } } } }', token).expect(200);
    expect(mias.body.data.misReservas.ordenes).toEqual([]);
    expect(mias.body.data.misReservas.experiencias).toEqual([{ id: reserva.id, estado: 'CONFIRMADA', experiencia: 'City tour Quito', factura: { numeroFactura: reserva.factura.numeroFactura } }]);

    // The invoice is its buyer's and the administrators'; anybody else is told it does not exist.
    const consulta = '{ facturaCompleta(numeroFactura: "%") { numeroFactura detalles { linea } } }'.replace('%', reserva.factura.numeroFactura);
    expect((await gql(consulta, token).expect(200)).body.data.facturaCompleta.numeroFactura).toBe(reserva.factura.numeroFactura);
    expect((await gql(consulta, adminToken).expect(200)).body.data.facturaCompleta.numeroFactura).toBe(reserva.factura.numeroFactura);
    expect(codigo(await gql(consulta, await guest()))).toBe('NOT_FOUND');
    expect(await ds.getRepository(Factura).count({ where: { reservaExternaId: reserva.id } })).toBe(1);
  });

  it('applies the same rules as REST: bad input, bad key, a declined card, and the audit trail shows the saga', async () => {
    const token = await guest();
    expect(codigo(await gql(CHECKOUT, token, { id: experienciaId, input: input({ cantidad: 0 }), key: randomUUID() }))).toBe('VALIDATION_FAILED');
    expect(codigo(await gql(CHECKOUT, token, { id: experienciaId, input: input(), key: 'no-es-uuid' }))).toBe('VALIDATION_FAILED');
    expect(codigo(await gql(CHECKOUT, token, { id: randomUUID(), input: input(), key: randomUUID() }))).toBe('NOT_FOUND');
    expect(codigo(await gql(CHECKOUT, undefined, { id: experienciaId, input: input(), key: randomUUID() }))).toBe('UNAUTHORIZED');
    const declinada = await gql(CHECKOUT, token, { id: experienciaId, input: input({ medio: { tipo: 'TARJETA', token: 'tok_declined', marca: 'VISA' } }), key: randomUUID() }).expect(200);
    expect(codigo(declinada)).toBe('PAYMENT_DECLINED');

    const sagas = await gql('{ auditoriaSagas(tipo: "RESERVA_EXTERNA", limite: 10) { tipo estado correlationId pasos { secuencia nombre estado } } }', adminToken).expect(200);
    const estados = sagas.body.data.auditoriaSagas.map((s: { estado: string }) => s.estado);
    expect(estados).toEqual(expect.arrayContaining(['COMPLETADA', 'FALLIDA']));
    const completa = sagas.body.data.auditoriaSagas.find((s: { estado: string }) => s.estado === 'COMPLETADA');
    expect(completa.pasos.map((p: { nombre: string }) => p.nombre)).toEqual(['AUTORIZAR_PAGO', 'RESERVAR_PROVEEDOR', 'VERIFICAR_PRECIO', 'CONFIRMAR_Y_FACTURAR', 'CAPTURAR_PAGO']);

    const eventos = await gql(`{ auditoriaTransacciones(correlationId: "${completa.correlationId}") { tipo resumen } }`, adminToken).expect(200);
    expect(eventos.body.data.auditoriaTransacciones.map((e: { tipo: string }) => e.tipo)).toContain('ReservaExternaConfirmada');
  });

  it('cancels through the gateway', async () => {
    const token = await guest();
    const hecha = (await gql(CHECKOUT, token, { id: experienciaId, input: input({ cantidad: 1 }), key: randomUUID() }).expect(200)).body.data.checkoutExterno;
    const res = await gql('mutation ($id: String!, $key: String!) { cancelarReservaSaga(reservaId: $id, idempotencyKey: $key, motivo: "Cambio de planes") { id estado factura { estado } } }', token, { id: hecha.id, key: randomUUID() }).expect(200);
    expect(res.body.data.cancelarReservaSaga).toMatchObject({ id: hecha.id, estado: 'CANCELADA', factura: { estado: 'ANULADA' } });
  });
});
