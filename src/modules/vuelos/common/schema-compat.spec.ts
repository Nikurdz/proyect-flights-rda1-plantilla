import { bumpFor, compareSchemas, JsonSchemaLike } from './schema-compat';

const base: JsonSchemaLike = {
  type: 'object',
  required: ['ordenId', 'total'],
  properties: { ordenId: { type: 'string' }, total: { type: 'number' }, estado: { type: 'string', enum: ['A', 'B'] } },
};

describe('compareSchemas (backward compatibility of an event contract)', () => {
  it('adding an optional property is compatible → MINOR', () => {
    const next = { ...base, properties: { ...base.properties, descripcionLarga: { type: 'string' } } };
    const report = compareSchemas(base, next);
    expect(report.compatible).toBe(true);
    expect(bumpFor(report)).toBe('MINOR');
  });

  it('changing a type (number → integer is fine only if the old type is kept) is breaking → MAJOR', () => {
    const next = { ...base, properties: { ...base.properties, total: { type: 'string' } } };
    const report = compareSchemas(base, next);
    expect(report.compatible).toBe(false);
    expect(report.breaking[0]).toContain('/total: type changed');
    expect(bumpFor(report)).toBe('MAJOR');
  });

  it('adding a value to an enum is a MINOR change with a warning; removing one is MAJOR', () => {
    const added = compareSchemas(base, { ...base, properties: { ...base.properties, estado: { type: 'string', enum: ['A', 'B', 'C'] } } });
    expect(added.compatible).toBe(true);
    expect(added.additions.join()).toContain('enum values added');
    const removed = compareSchemas(base, { ...base, properties: { ...base.properties, estado: { type: 'string', enum: ['A'] } } });
    expect(removed.breaking.join()).toContain('enum values removed');
  });

  it('making an existing optional property required is breaking, unless it has a default', () => {
    const next = { ...base, required: ['ordenId', 'total', 'estado'] };
    expect(compareSchemas(base, next).breaking[0]).toContain("'estado' is now required");
    const withDefault = { ...next, properties: { ...base.properties, estado: { type: 'string', enum: ['A', 'B'], default: 'A' } } };
    expect(compareSchemas(base, withDefault).compatible).toBe(true);
  });

  it('removing or renaming a property is breaking (a rename is a removal plus an addition)', () => {
    const { total: _removed, ...rest } = base.properties as Record<string, JsonSchemaLike>;
    const renamed = { ...base, required: ['ordenId'], properties: { ...rest, importeTotal: { type: 'number' } } };
    const report = compareSchemas(base, renamed);
    expect(report.breaking).toContain('/total: property removed');
    expect(report.additions).toContain('/importeTotal: optional property added');
  });

  it('looks inside nested objects and array items', () => {
    const old: JsonSchemaLike = { type: 'object', properties: { pasajeros: { type: 'array', items: { type: 'object', properties: { nombres: { type: 'string' } } } } } };
    const next: JsonSchemaLike = { type: 'object', properties: { pasajeros: { type: 'array', items: { type: 'object', properties: {} } } } };
    expect(compareSchemas(old, next).breaking).toContain('/pasajeros[]/nombres: property removed');
  });

  it('closing an open object is breaking', () => {
    expect(compareSchemas(base, { ...base, additionalProperties: false }).breaking[0]).toContain('object closed');
  });

  it('no change is a PATCH', () => {
    expect(bumpFor(compareSchemas(base, base))).toBe('PATCH');
  });
});
