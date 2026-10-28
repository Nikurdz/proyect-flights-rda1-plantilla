/**
 * Builds OUR contract v2 (contracts/vuelos-openapi-v2-ram-alliance.yaml) from
 *   1. the template Booking gave every flight team (contracts/vuelos-openapi-v2.yaml, never edited), and
 *   2. our overlay (contracts/overlay/vuelos-v2-ram-alliance.overlay.yaml, an RFC 7386 JSON Merge Patch plus a map of
 *      per-operation notes),
 * with a few mechanical passes in between (ids we generate are UUIDs, 202 answers we never produce are dropped, 429 on every
 * operation). The result is deterministic; the integration tests check it is valid OpenAPI 3.0.3, that it is up to date with
 * this script, and that the real answers of the running API match its schemas.
 *
 *   npm run contract:v2:build           # writes the file
 *   node scripts/build-contract-v2.js --stdout   # prints it (used by the "up to date" test)
 */
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const BASE = path.join(ROOT, 'contracts', 'vuelos-openapi-v2.yaml');
const OVERLAY = path.join(ROOT, 'contracts', 'overlay', 'vuelos-v2-ram-alliance.overlay.yaml');
const OUT = path.join(ROOT, 'contracts', 'vuelos-openapi-v2-ram-alliance.yaml');

const clone = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** RFC 7386: objects merge, everything else replaces, null deletes. */
function mergePatch(target, patch) {
  if (!isObject(patch)) return patch;
  const result = isObject(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete result[key];
    else result[key] = mergePatch(result[key], value);
  }
  return result;
}

/** A stable UUID (v4 layout) for an id-like example of the template, so every mention of it stays the same. */
function uuidFor(text) {
  const h = createHash('sha256').update(`ram-alliance-vuelos:${text}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// Ids our node generates: UUIDs. (passengerId, paymentReference, partnerOrderId and packageId are chosen by the caller.)
const UUID_KEYS = new Set(['offerid', 'itineraryid', 'segmentid', 'ticketid', 'quoteid', 'changeofferid', 'refundid', 'holdid', 'bookingid']);
// An id-like example of the template, alone or inside a sentence of an example (`detail: El asiento 12A del segmento SEG-AV1632-... ya fue tomado`).
const ID_EXAMPLE_ANYWHERE = /(?<![A-Za-z0-9])(?:OFF|ITI|SEG|QTE|CHG|TKT|REF)-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/g;

function walk(node, visit) {
  if (Array.isArray(node)) node.forEach((item) => walk(item, visit));
  else if (isObject(node)) {
    visit(node);
    Object.values(node).forEach((child) => walk(child, visit));
  }
}

/** Pass 1: ids are UUIDs and the examples of the template are replaced by UUIDs (consistently, everywhere). */
function idsAreUuids(doc) {
  walk(doc, (node) => {
    if (isObject(node.properties)) {
      for (const [key, schema] of Object.entries(node.properties)) {
        if (UUID_KEYS.has(key.toLowerCase()) && isObject(schema) && schema.type === 'string') {
          schema.format = 'uuid';
          delete schema.pattern;
        }
      }
    }
    if (typeof node.in === 'string' && typeof node.name === 'string' && UUID_KEYS.has(node.name.toLowerCase()) && isObject(node.schema)) {
      node.schema.format = 'uuid';
      delete node.schema.pattern;
    }
  });
  const replace = (value) => (typeof value === 'string' ? value.replace(ID_EXAMPLE_ANYWHERE, (id) => uuidFor(id)) : value);
  const rewrite = (node) => {
    if (Array.isArray(node)) return node.map(rewrite);
    if (!isObject(node)) return replace(node);
    const out = {};
    for (const [key, value] of Object.entries(node)) out[key] = key === 'description' || key === 'summary' ? value : rewrite(value);
    return out;
  };
  return rewrite(doc);
}

/** Pass 2: answers we never produce (see the notes of each operation): the 202 of the template. */
function dropUnproducedAnswers(doc, dropped) {
  for (const item of Object.values(doc.paths)) {
    for (const operation of Object.values(item)) {
      if (isObject(operation) && operation.responses && operation.responses['202']) {
        delete operation.responses['202'];
        dropped.push(operation.operationId);
      }
    }
  }
}

/** Pass 3b: an operation behind a scope answers 403 when the token lacks it. */
function addForbiddenAnswer(doc) {
  for (const item of Object.values(doc.paths)) {
    for (const operation of Object.values(item)) {
      const scoped = isObject(operation) && Array.isArray(operation.security) && operation.security.some((s) => isObject(s) && s.PartnerOAuth2);
      if (scoped && operation.responses && !operation.responses['403']) operation.responses['403'] = { $ref: '#/components/responses/Problem403' };
    }
  }
}

/** Pass 3: every operation can answer 429 (global rate limit per client address) and says how long to wait. */
function addRateLimitAnswer(doc) {
  for (const item of Object.values(doc.paths)) {
    for (const operation of Object.values(item)) {
      if (isObject(operation) && operation.responses && !operation.responses['429']) operation.responses['429'] = { $ref: '#/components/responses/Problem429' };
    }
  }
}

/** Pass 4: operations whose list parameters differ from the template's shared ones. */
function operationParameters(doc) {
  const flightOps = doc.paths['/vuelos/operaciones/vuelos']?.get;
  if (flightOps) {
    flightOps.parameters = flightOps.parameters.map((p) =>
      p.$ref === '#/components/parameters/Limit'
        ? { name: 'limit', in: 'query', required: false, description: 'Tamaño de página (por defecto 20, máximo 100).', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } }
        : p.$ref === '#/components/parameters/Cursor'
          ? { name: 'cursor', in: 'query', required: false, description: 'Cursor opaco: use `nextCursor` de la página anterior.', schema: { type: 'string', maxLength: 200 } }
          : p,
    );
  }
}

function main() {
  const base = yaml.load(fs.readFileSync(BASE, 'utf8'));
  const overlayFile = yaml.load(fs.readFileSync(OVERLAY, 'utf8'));
  const notes = overlayFile['x-operation-notes'] ?? {};
  const patch = { ...overlayFile };
  delete patch['x-operation-notes'];

  let doc = idsAreUuids(clone(base));
  const dropped = [];
  dropUnproducedAnswers(doc, dropped);
  addRateLimitAnswer(doc);
  addForbiddenAnswer(doc);
  operationParameters(doc);
  doc = mergePatch(doc, patch);

  // Notes of implementation, appended to the description of each operation.
  for (const item of Object.values(doc.paths)) {
    for (const operation of Object.values(item)) {
      if (!isObject(operation) || !operation.operationId) continue;
      const note = notes[operation.operationId];
      if (note) operation.description = `${(operation.description ?? '').trimEnd()}\n\n**Nota de implementación (RAM Alliance):** ${String(note).trim()}\n`;
    }
  }
  for (const id of dropped) {
    for (const item of Object.values(doc.paths)) {
      for (const operation of Object.values(item)) {
        if (isObject(operation) && operation.operationId === id) {
          operation.description = `${(operation.description ?? '').trimEnd()}\n\n**Sin 202:** este nodo emite y confirma de forma síncrona, así que responde siempre el código de éxito inmediato (nunca 202).\n`;
        }
      }
    }
  }

  const header = [
    '# GENERADO por scripts/build-contract-v2.js — no editar a mano.',
    '# Base: contracts/vuelos-openapi-v2.yaml (plantilla de Booking). Parche propio: contracts/overlay/vuelos-v2-ram-alliance.overlay.yaml.',
    '# Regenerar: npm run contract:v2:build',
    '',
  ].join('\n');
  const output = header + yaml.dump(doc, { lineWidth: -1, noRefs: true, sortKeys: false });
  if (process.argv.includes('--stdout')) process.stdout.write(output);
  else {
    fs.writeFileSync(OUT, output);
    console.log(`written ${path.relative(ROOT, OUT)} (${Object.keys(doc.paths).length} paths)`);
  }
}

main();
