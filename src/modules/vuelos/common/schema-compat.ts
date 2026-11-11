/**
 * Backward-compatibility check between two versions of a JSON Schema: can a consumer that holds the NEW schema still
 * read data written under the OLD one, and can a producer that moves to the new schema keep serving old consumers?
 * It looks for the changes that break (removed property, changed type, new required property without default,
 * narrower enum, closed object) and lists the ones that only extend the contract.
 */
export interface JsonSchemaLike {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, JsonSchemaLike>;
  items?: JsonSchemaLike;
  enum?: unknown[];
  additionalProperties?: boolean | JsonSchemaLike;
  default?: unknown;
  [key: string]: unknown;
}

export interface CompatReport {
  compatible: boolean;
  /** Changes that break existing consumers → MAJOR (a new `.vN+1` file). */
  breaking: string[];
  /** Compatible additions → MINOR. */
  additions: string[];
}

function typesOf(schema: JsonSchemaLike): string[] {
  return schema.type === undefined ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
}

export function compareSchemas(previous: JsonSchemaLike, next: JsonSchemaLike, path = ''): CompatReport {
  const report: CompatReport = { compatible: true, breaking: [], additions: [] };
  const at = path || '/';

  const before = typesOf(previous);
  const after = typesOf(next);
  if (before.length && !before.every((t) => after.includes(t))) report.breaking.push(`${at}: type changed from ${before.join('|')} to ${after.join('|') || 'any'}`);
  else if (after.length > before.length) report.additions.push(`${at}: type widened to ${after.join('|')}`);

  const oldRequired = new Set(previous.required ?? []);
  for (const name of next.required ?? []) {
    if (!oldRequired.has(name) && next.properties?.[name]?.default === undefined) report.breaking.push(`${at}: '${name}' is now required (old data does not have it)`);
  }

  const oldProps = previous.properties ?? {};
  const newProps = next.properties ?? {};
  for (const name of Object.keys(oldProps)) {
    const child = `${path}/${name}`;
    if (!(name in newProps)) {
      report.breaking.push(`${child}: property removed`);
      continue;
    }
    const nested = compareSchemas(oldProps[name], newProps[name], child);
    report.breaking.push(...nested.breaking);
    report.additions.push(...nested.additions);
  }
  for (const name of Object.keys(newProps)) {
    if (!(name in oldProps)) report.additions.push(`${path}/${name}: optional property added`);
  }

  if (previous.items && next.items) {
    const nested = compareSchemas(previous.items, next.items, `${path}[]`);
    report.breaking.push(...nested.breaking);
    report.additions.push(...nested.additions);
  }

  if (previous.enum && next.enum) {
    const removed = previous.enum.filter((v) => !next.enum?.includes(v));
    if (removed.length) report.breaking.push(`${at}: enum values removed (${removed.join(', ')})`);
    const added = next.enum.filter((v) => !previous.enum?.includes(v));
    if (added.length) report.additions.push(`${at}: enum values added (${added.join(', ')}); consumers must tolerate unknown values`);
  }

  if (previous.additionalProperties !== false && next.additionalProperties === false) report.breaking.push(`${at}: object closed (additionalProperties: false)`);

  report.compatible = report.breaking.length === 0;
  return report;
}

/** The semantic-version bump a change calls for: breaking → MAJOR, additions → MINOR, nothing → PATCH. */
export function bumpFor(report: CompatReport): 'MAJOR' | 'MINOR' | 'PATCH' {
  return report.breaking.length ? 'MAJOR' : report.additions.length ? 'MINOR' : 'PATCH';
}
