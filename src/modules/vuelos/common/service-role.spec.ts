import { ConfigService } from '@nestjs/config';
import { AuditoriaTransaccionesService } from '../ecommerce/observabilidad/auditoria-transacciones.service';
import { RetencionAuditoriaService } from '../ecommerce/observabilidad/retencion-auditoria.service';
import { NotificacionesService } from '../ecommerce/notificaciones/notificaciones.service';
import { HoldsSweeper } from '../services/holds-sweeper.service';
import { WebhookDispatcherService } from '../services/webhook-dispatcher.service';
import { WebhooksService } from '../services/webhooks.service';
import { OutboxV2Service } from '../v2/outbox-v2.service';
import { InboundEventsV2Service } from '../v2/inbound-events-v2.service';
import { DomainEventBus } from './domain-event-bus';
import { parseServiceRole, runsCore, runsDomain, serviceRole, ServiceRole } from './service-role';
import * as traza from './traza-acciones';
import { loadVuelosConfig } from './vuelos-config';

const stub = {} as never;

/** What each role must start. The monolith (the default, what production runs) starts everything. */
const ROLES: Record<ServiceRole, { core: boolean; auditoria: boolean; notificaciones: boolean; webhooks: boolean }> = {
  monolith: { core: true, auditoria: true, notificaciones: true, webhooks: true },
  api: { core: true, auditoria: false, notificaciones: false, webhooks: false },
  auditoria: { core: false, auditoria: true, notificaciones: false, webhooks: false },
  notificaciones: { core: false, auditoria: false, notificaciones: true, webhooks: false },
  webhooks: { core: false, auditoria: false, notificaciones: false, webhooks: true },
};

describe('SERVICE_ROLE', () => {
  const saved = process.env.SERVICE_ROLE;
  afterEach(() => {
    if (saved === undefined) delete process.env.SERVICE_ROLE;
    else process.env.SERVICE_ROLE = saved;
    jest.restoreAllMocks();
  });

  it('is the monolith by default, also when empty or blank', () => {
    delete process.env.SERVICE_ROLE;
    expect(serviceRole()).toBe('monolith');
    expect(parseServiceRole('')).toBe('monolith');
    expect(parseServiceRole('  ')).toBe('monolith');
    expect(parseServiceRole(undefined)).toBe('monolith');
    expect(runsCore()).toBe(true);
    for (const dominio of ['auditoria', 'notificaciones', 'webhooks'] as const) expect(runsDomain(dominio)).toBe(true);
  });

  it('refuses an unknown value with a readable message', () => {
    expect(() => parseServiceRole('pagos')).toThrow(/SERVICE_ROLE="pagos" is invalid: expected one of monolith, api, auditoria, notificaciones, webhooks/);
  });

  it('makes the boot fail through the Vuelos configuration', () => {
    const base = { JWT_SECRET: 'x'.repeat(40), NODE_ENV: 'test' } as Record<string, string>;
    const build = (extra: Record<string, string>) => loadVuelosConfig(new ConfigService({ ...base, ...extra }));
    delete process.env.SERVICE_ROLE;
    expect(() => build({ SERVICE_ROLE: 'nope' })).toThrow(/SERVICE_ROLE="nope" is invalid/);
    expect(() => build({})).not.toThrow();
    expect(() => build({ SERVICE_ROLE: 'api' })).not.toThrow();
  });

  describe.each(Object.entries(ROLES))('role %s', (rol, esperado) => {
    beforeEach(() => {
      process.env.SERVICE_ROLE = rol;
    });

    it('answers runsCore / runsDomain', () => {
      expect(runsCore()).toBe(esperado.core);
      expect(runsDomain('auditoria')).toBe(esperado.auditoria);
      expect(runsDomain('notificaciones')).toBe(esperado.notificaciones);
      expect(runsDomain('webhooks')).toBe(esperado.webhooks);
    });

    it('registers only its own subscribers and jobs', () => {
      const bus = new DomainEventBus();
      const subscribe = jest.spyOn(bus, 'subscribe');
      const subscribeAll = jest.spyOn(bus, 'subscribeAll');
      const sink = jest.spyOn(traza, 'setAccionSink').mockImplementation(() => undefined);

      const cleanups: (() => void)[] = [];
      const timerOf = (svc: { onModuleInit(): void; onModuleDestroy(): void }) => {
        svc.onModuleInit();
        cleanups.push(() => svc.onModuleDestroy());
        return Boolean((svc as unknown as { timer?: unknown }).timer);
      };

      // Audit domain: subscribeAll of the trail + retention job. The action sink belongs to the core.
      const auditoria = new AuditoriaTransaccionesService(stub, bus);
      auditoria.onModuleInit();
      expect(subscribeAll.mock.calls.length > 0).toBe(esperado.auditoria);
      expect(sink.mock.calls.length > 0).toBe(esperado.core);
      expect(timerOf(new RetencionAuditoriaService(stub))).toBe(esperado.auditoria);

      // Notifications domain.
      subscribe.mockClear();
      new NotificacionesService(stub, stub, stub, stub, bus).onModuleInit();
      expect(subscribe.mock.calls.some(([tipo]) => tipo === 'OrdenEmitida')).toBe(esperado.notificaciones);

      // Webhooks domain: enqueue subscriptions, the v2 feed and the dispatcher job.
      subscribe.mockClear();
      subscribeAll.mockClear();
      new WebhooksService(stub, stub, bus, stub).onModuleInit();
      expect(subscribe.mock.calls.length > 0).toBe(esperado.webhooks);
      new OutboxV2Service(stub, bus, stub).onModuleInit();
      expect(subscribeAll.mock.calls.length > 0).toBe(esperado.webhooks);
      expect(timerOf(new WebhookDispatcherService(stub, stub, stub))).toBe(esperado.webhooks);

      // The core's own work.
      subscribe.mockClear();
      new InboundEventsV2Service(stub, bus, stub, stub).onModuleInit();
      expect(subscribe.mock.calls.length > 0).toBe(esperado.core);
      expect(timerOf(new HoldsSweeper(stub, stub, stub))).toBe(esperado.core);

      cleanups.forEach((cleanup) => cleanup());
    });
  });
});
