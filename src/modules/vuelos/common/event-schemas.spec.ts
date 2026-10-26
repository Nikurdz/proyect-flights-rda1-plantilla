import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DomainEventBus } from './domain-event-bus';
import { EventSchemaRegistry, eventSchemaMode, eventSchemas } from './event-schemas';

const SRC = join(__dirname, '..');

/** Every event type published in the source (`publish('type'` or `? 'a' : 'b'` inside a publish call). */
function publishedTypes(): Set<string> {
  const types = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
        const text = readFileSync(full, 'utf8');
        for (const m of text.matchAll(/\.publish\(\s*'([^']+)'/g)) types.add(m[1]);
        // publish(cond ? 'a' : 'b', …)
        for (const m of text.matchAll(/\.publish\([^,\n]*\?\s*'([^']+)'\s*:\s*'([^']+)'/g)) {
          types.add(m[1]);
          types.add(m[2]);
        }
      }
    }
  };
  walk(SRC);
  return types;
}

describe('event contracts', () => {
  const registry = eventSchemas();

  it('has a JSON Schema for every event type the code publishes', () => {
    const missing = [...publishedTypes()].filter((type) => !registry.has(type));
    expect(missing).toEqual([]);
    expect(registry.size).toBeGreaterThanOrEqual(30);
  });

  it('has no schema for an event nobody publishes', () => {
    const published = publishedTypes();
    expect(registry.types().filter((type) => !published.has(type))).toEqual([]);
  });

  it('lists every schema in the AsyncAPI document', () => {
    const asyncapi = readFileSync(join(SRC, '..', '..', '..', 'contracts', 'vuelos-eventos-asyncapi.yaml'), 'utf8');
    const missing = registry.types().filter((type) => !asyncapi.includes(`./eventos/${type}.v1.schema.json`));
    expect(missing).toEqual([]);
  });

  it('accepts a conforming payload and extra fields (the contract can grow)', () => {
    expect(registry.validar('OfertaCreada', { ofertaId: 'o1' }).ok).toBe(true);
    expect(registry.validar('OfertaCreada', { ofertaId: 'o1', nuevoCampo: 1 }).ok).toBe(true);
  });

  it('rejects a missing required field and a wrong type, naming the field', () => {
    const missing = registry.validar('PagoReembolsado', { pagoId: 'p1' });
    expect(missing.ok).toBe(false);
    expect(missing.errors).toContain("required property 'montoMinor'");
    const wrongType = registry.validar('PagoReembolsado', { pagoId: 'p1', montoMinor: '5' });
    expect(wrongType.ok).toBe(false);
    expect(wrongType.errors).toContain('must be number');
  });

  it('lets a type without a contract through, reporting no version', () => {
    expect(registry.validar('tipo.sin.contrato', {})).toEqual({ ok: true, major: null, errors: '' });
  });

  it('keeps the highest major of a type and ignores files that are not schemas', () => {
    expect(new EventSchemaRegistry(join(SRC, '..', '..', '..', 'contracts', 'eventos')).majorOf('OrdenEmitida')).toBe(1);
  });
});

describe('DomainEventBus with event contracts', () => {
  it('stamps the schema major version on the envelope', async () => {
    const event = await new DomainEventBus().publish('OfertaCreada', 'o1', { ofertaId: 'o1' });
    expect(event.schemaVersion).toBe(1);
  });

  it('refuses a payload that breaks the contract in strict mode', async () => {
    const previous = process.env.EVENT_SCHEMA_MODE;
    process.env.EVENT_SCHEMA_MODE = 'strict';
    try {
      await expect(new DomainEventBus().publish('OfertaCreada', 'o1', {})).rejects.toThrow(/does not match its schema/);
    } finally {
      if (previous === undefined) delete process.env.EVENT_SCHEMA_MODE;
      else process.env.EVENT_SCHEMA_MODE = previous;
    }
  });

  it('delivers it anyway in warn mode (production must not lose events)', async () => {
    const previous = process.env.EVENT_SCHEMA_MODE;
    process.env.EVENT_SCHEMA_MODE = 'warn';
    try {
      const bus = new DomainEventBus();
      const seen = jest.fn();
      bus.subscribe('OfertaCreada', seen);
      await bus.publish('OfertaCreada', 'o1', {});
      expect(seen).toHaveBeenCalledTimes(1);
    } finally {
      if (previous === undefined) delete process.env.EVENT_SCHEMA_MODE;
      else process.env.EVENT_SCHEMA_MODE = previous;
    }
  });

  it('does not hand an invalid message from the broker to the consumers: it counts as a failure so it is retried and dead-lettered', async () => {
    const bus = new DomainEventBus();
    const seen = jest.fn();
    bus.subscribe('OfertaCreada', seen);
    const result = await bus.despachar({ id: 'e1', type: 'OfertaCreada', schemaVersion: 1, occurredAt: new Date().toISOString(), market: null, correlationId: 'c1', aggregateId: 'o1', payload: {} });
    expect(result.fallos).toBe(1);
    expect(seen).not.toHaveBeenCalled();
  });
});

describe('eventSchemaMode', () => {
  it('is strict outside production, warn in production, and can be forced', () => {
    expect(eventSchemaMode({ NODE_ENV: 'development' })).toBe('strict');
    expect(eventSchemaMode({ NODE_ENV: 'production' })).toBe('warn');
    expect(eventSchemaMode({ NODE_ENV: 'production', EVENT_SCHEMA_MODE: 'off' })).toBe('off');
  });
});
