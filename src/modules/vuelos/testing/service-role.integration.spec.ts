import { randomUUID } from 'node:crypto';
import { INestApplication, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { AuditoriaServicioModule } from '../../../servicios/auditoria/auditoria.module';
import { NotificacionesServicioModule } from '../../../servicios/notificaciones/notificaciones.module';
import { WebhooksServicioModule } from '../../../servicios/webhooks/webhooks.module';
import { DomainEvent, DomainEventBus } from '../common/domain-event-bus';
import { registrarAccion } from '../common/traza-acciones';
import { Notificacion } from '../ecommerce/notificaciones/entities/notificacion.entity';
import { PlantillaNotificacion } from '../ecommerce/notificaciones/entities/plantilla.entity';
import { AuditoriaTransaccion } from '../ecommerce/observabilidad/entities/auditoria.entity';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { WebhooksService } from '../services/webhooks.service';
import { createIntegrationApp, describeIntegration, IntegrationApp, TEST_DATABASE_URL } from './integration-app';

const OWNER = 'owner-rol-1';

/** One event for the notifications domain and one for the webhooks/feed domain; every domain sees both through the bus. */
const cuentaBloqueada = (): DomainEvent => ({
  id: randomUUID(),
  type: 'CuentaBloqueada',
  schemaVersion: 1,
  occurredAt: new Date().toISOString(),
  market: null,
  correlationId: 'corr-rol',
  aggregateId: 'cli-1',
  payload: { clienteId: 'cli-1', correo: 'ana@example.com', nombres: 'Ana', idioma: 'es', minutos: 15 },
});
const holdVencido = (): DomainEvent => ({
  id: randomUUID(),
  type: 'hold.expired',
  schemaVersion: 1,
  occurredAt: new Date().toISOString(),
  market: null,
  correlationId: 'corr-rol',
  aggregateId: 'hold-rol-1',
  payload: { holdId: 'hold-rol-1', ownerId: OWNER, status: 'EXPIRED' },
});

/** What each domain wrote for the two events (matched by event id). */
async function efectos(ds: DataSource, eventos: { notif: DomainEvent; hold: DomainEvent }) {
  return {
    auditoria: await ds.getRepository(AuditoriaTransaccion).count({ where: [{ eventoId: eventos.notif.id }, { eventoId: eventos.hold.id }] }),
    notificacion: await ds.getRepository(Notificacion).count({ where: { eventoId: eventos.notif.id } }),
    entrega: await ds.getRepository(WebhookDelivery).count({ where: { eventId: eventos.hold.id } }),
    feed: await ds.getRepository(OutboxEvent).count({ where: { eventoId: eventos.hold.id } }),
  };
}

async function prepararDominios(ds: DataSource, app: INestApplication): Promise<void> {
  await ds.getRepository(PlantillaNotificacion).save({ tipo: 'CUENTA_BLOQUEADA', mercado: null, idioma: 'es', version: 1, asunto: 'Cuenta bloqueada', cuerpo: 'Hola {{nombre}}, {{minutos}} min.', activa: true });
  await app.get(WebhooksService).createRow(OWNER, { url: 'http://127.0.0.1:9/hook', events: ['hold.expired'], secret: 's'.repeat(32) });
}

describeIntegration('SERVICE_ROLE: the monolith registers every domain, the api core leaves them to the satellites', () => {
  const abiertas: IntegrationApp[] = [];
  afterAll(async () => {
    for (const a of abiertas) await a.close();
  });

  it('monolith (SERVICE_ROLE unset, as in production): the event is audited, notified, queued as a webhook and fed', async () => {
    const it = await createIntegrationApp({ WEBHOOKS_ALLOW_PRIVATE_HOSTS: 'true' });
    abiertas.push(it);
    await prepararDominios(it.dataSource, it.app);
    const eventos = { notif: cuentaBloqueada(), hold: holdVencido() };
    const bus = it.app.get(DomainEventBus);
    await bus.despachar(eventos.notif);
    await bus.despachar(eventos.hold);
    expect(await efectos(it.dataSource, eventos)).toEqual({ auditoria: 2, notificacion: 1, entrega: 1, feed: 1 });
  });

  it('api: none of the three domains runs in the process (their events travel through the broker), but the action trail still records', async () => {
    const it = await createIntegrationApp({ SERVICE_ROLE: 'api', WEBHOOKS_ALLOW_PRIVATE_HOSTS: 'true' });
    abiertas.push(it);
    await prepararDominios(it.dataSource, it.app);
    const eventos = { notif: cuentaBloqueada(), hold: holdVencido() };
    const bus = it.app.get(DomainEventBus);
    await bus.despachar(eventos.notif);
    await bus.despachar(eventos.hold);
    expect(await efectos(it.dataSource, eventos)).toEqual({ auditoria: 0, notificacion: 0, entrega: 0, feed: 0 });

    // The sink of registrarAccion lives in the core (logins, OAuth2, stock pushes happen there).
    const agregadoId = `accion-${randomUUID()}`;
    registrarAccion({ tipo: 'acceso.prueba', agregadoId, resumen: 'rol api' });
    let filas = 0;
    for (let intento = 0; intento < 20 && filas === 0; intento++) {
      filas = await it.dataSource.getRepository(AuditoriaTransaccion).count({ where: { agregadoId } });
      if (filas === 0) await new Promise((r) => setTimeout(r, 100));
    }
    expect(filas).toBe(1);
  });
});

describeIntegration('satellite services: each one boots alone and handles the events of its domain', () => {
  let base: IntegrationApp;
  const abiertas: INestApplication[] = [];
  const rolPrevio = process.env.SERVICE_ROLE;

  beforeAll(async () => {
    // The core owns the schema: a monolith app creates it (synchronize) and the satellites only connect to it (synchronize false).
    base = await createIntegrationApp({ WEBHOOKS_ALLOW_PRIVATE_HOSTS: 'true' });
    await prepararDominios(base.dataSource, base.app);
  });

  afterAll(async () => {
    for (const app of abiertas) await app.close();
    await base.close();
    if (rolPrevio === undefined) delete process.env.SERVICE_ROLE;
    else process.env.SERVICE_ROLE = rolPrevio;
  });

  async function arrancar(rol: string, modulo: Type<unknown>): Promise<INestApplication> {
    process.env.SERVICE_ROLE = rol;
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ NODE_ENV: 'test', JWT_SECRET: 'integration-test-secret-integration-test-secret', OUTBOX_FEED_DELAY_MS: '0', WEBHOOKS_ALLOW_PRIVATE_HOSTS: 'true' })],
        }),
        TypeOrmModule.forRoot({ type: 'postgres', url: TEST_DATABASE_URL, schema: base.schema, autoLoadEntities: true, synchronize: false }),
        modulo,
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    abiertas.push(app);
    return app;
  }

  it('auditoria: GET /health answers without the database and the event is written to the trail only', async () => {
    const app = await arrancar('auditoria', AuditoriaServicioModule);
    const health = await request(app.getHttpServer()).get('/health').expect(200);
    expect(health.body).toEqual({ status: 'UP', servicio: 'auditoria' });
    const eventos = { notif: cuentaBloqueada(), hold: holdVencido() };
    const bus = app.get(DomainEventBus, { strict: false });
    expect((await bus.despachar(eventos.notif)).fallos).toBe(0);
    expect((await bus.despachar(eventos.hold)).fallos).toBe(0);
    expect(await efectos(base.dataSource, eventos)).toEqual({ auditoria: 2, notificacion: 0, entrega: 0, feed: 0 });
  });

  it('notificaciones: GET /health and the account event becomes one notification (a redelivery adds none)', async () => {
    const app = await arrancar('notificaciones', NotificacionesServicioModule);
    const health = await request(app.getHttpServer()).get('/health').expect(200);
    expect(health.body).toEqual({ status: 'UP', servicio: 'notificaciones' });
    const eventos = { notif: cuentaBloqueada(), hold: holdVencido() };
    const bus = app.get(DomainEventBus, { strict: false });
    expect((await bus.despachar(eventos.notif)).fallos).toBe(0);
    expect((await bus.despachar(eventos.notif)).fallos).toBe(0);
    expect((await bus.despachar(eventos.hold)).fallos).toBe(0);
    expect(await efectos(base.dataSource, eventos)).toEqual({ auditoria: 0, notificacion: 1, entrega: 0, feed: 0 });
  });

  it('webhooks: GET /health and the event is queued as a delivery and stored in the v2 feed', async () => {
    const app = await arrancar('webhooks', WebhooksServicioModule);
    const health = await request(app.getHttpServer()).get('/health').expect(200);
    expect(health.body).toEqual({ status: 'UP', servicio: 'webhooks' });
    const eventos = { notif: cuentaBloqueada(), hold: holdVencido() };
    const bus = app.get(DomainEventBus, { strict: false });
    expect((await bus.despachar(eventos.notif)).fallos).toBe(0);
    expect((await bus.despachar(eventos.hold)).fallos).toBe(0);
    expect(await efectos(base.dataSource, eventos)).toEqual({ auditoria: 0, notificacion: 0, entrega: 1, feed: 1 });
  });
});
