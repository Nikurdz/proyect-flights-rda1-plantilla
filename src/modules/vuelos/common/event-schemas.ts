import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Event contracts: one JSON Schema per event type under `contracts/eventos/<type>.v<major>.schema.json`. The schema
 * describes the payload; the envelope (id, type, schemaVersion, occurredAt, correlationId…) is fixed by `DomainEvent`.
 * Adding an optional property is a compatible change; removing/renaming one, changing a type or requiring a new one
 * is breaking and needs a new `.v2` file (see `schema-compat.ts` and `contracts/eventos/README.md`).
 */
export type EventSchemaMode = 'strict' | 'warn' | 'off';

export interface EventSchemaEntry {
  type: string;
  major: number;
  validate: ValidateFunction;
}

export interface EventValidation {
  ok: boolean;
  /** Major version of the schema applied, or null when the type has no contract. */
  major: number | null;
  errors: string;
}

/** `strict` throws on a bad payload (development and tests), `warn` only logs it (production), `off` skips validation. */
export function eventSchemaMode(env: NodeJS.ProcessEnv = process.env): EventSchemaMode {
  const configured = env.EVENT_SCHEMA_MODE;
  if (configured === 'strict' || configured === 'warn' || configured === 'off') return configured;
  return env.NODE_ENV === 'production' ? 'warn' : 'strict';
}

function candidateDirs(): string[] {
  return [process.env.EVENT_SCHEMAS_DIR, join(__dirname, '..', '..', '..', '..', 'contracts', 'eventos'), join(process.cwd(), 'contracts', 'eventos')].filter((d): d is string => !!d);
}

const FILE_PATTERN = /^(.+)\.v(\d+)\.schema\.json$/;

export class EventSchemaRegistry {
  private readonly entries = new Map<string, EventSchemaEntry>();

  constructor(directory?: string) {
    const dir = directory ?? candidateDirs().find((d) => existsSync(d));
    if (!dir) return;
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    for (const file of readdirSync(dir)) {
      const match = FILE_PATTERN.exec(file);
      if (!match) continue;
      const [, type, major] = match;
      const current = this.entries.get(type);
      // The highest major wins for new events; older majors stay in the repository for consumers that still need them.
      if (current && current.major > Number(major)) continue;
      const schema = JSON.parse(readFileSync(join(dir, file), 'utf8')) as object;
      this.entries.set(type, { type, major: Number(major), validate: ajv.compile(schema) });
    }
  }

  get size(): number {
    return this.entries.size;
  }

  types(): string[] {
    return [...this.entries.keys()].sort();
  }

  has(type: string): boolean {
    return this.entries.has(type);
  }

  /** Major version of the schema in force for a type, or `null` when the type has no contract. */
  majorOf(type: string): number | null {
    return this.entries.get(type)?.major ?? null;
  }

  /** A type without a schema passes (`major: null`): the caller decides whether that is acceptable. */
  validar(type: string, payload: unknown): EventValidation {
    const entry = this.entries.get(type);
    if (!entry) return { ok: true, major: null, errors: '' };
    if (entry.validate(payload)) return { ok: true, major: entry.major, errors: '' };
    return { ok: false, major: entry.major, errors: describe(entry.validate.errors ?? []) };
  }
}

function describe(errors: ErrorObject[]): string {
  return errors.map((e) => `${e.instancePath || '/'} ${e.message ?? 'invalid'}`).join('; ');
}

let shared: EventSchemaRegistry | null = null;

/** The registry of the running process, loaded once. */
export function eventSchemas(): EventSchemaRegistry {
  shared ??= new EventSchemaRegistry();
  return shared;
}
