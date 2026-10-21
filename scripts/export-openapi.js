#!/usr/bin/env node
/**
 * Writes the OpenAPI contract of the whole running system (flight core + e-commerce + back office) to
 * contracts/vuelos-ecommerce-openapi.yaml, so it can be the starting point of the next API-first iteration.
 *
 * It reads the document the API itself publishes, so the contract can never describe something that is not there:
 *   1. start the API (npm run start:dev, or the deployed one),
 *   2. OPENAPI_URL=http://localhost:3000/api/docs-json npm run contract:export
 *
 * The document is made deterministic (sorted keys) so a re-export only shows real changes in git.
 */
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const SOURCE = process.env.OPENAPI_URL || 'http://localhost:3000/api/docs-json';
const TARGET = path.join(__dirname, '..', 'contracts', 'vuelos-ecommerce-openapi.yaml');
const PRODUCTION_URL = 'https://proyect-flights-rda1-plantilla-production.up.railway.app/api/v1';

const HEADER = `# GENERADO por scripts/export-openapi.js desde el /api/docs-json de la API en ejecución. No editar a mano:
# cambia el código y vuelve a ejecutar \`npm run contract:export\`. Describe TODO el sistema actual de Vuelos:
# núcleo GDS (contracts/vuelos-openapi.yaml), e-commerce y administración.
`;

const sortKeys = (value) => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])]),
    );
  }
  return value;
};

(async () => {
  const response = await fetch(SOURCE);
  if (!response.ok) throw new Error(`${SOURCE} answered ${response.status}`);
  const doc = await response.json();

  doc.info = {
    title: 'RAM Alliance · API de Vuelos (sistema completo)',
    description:
      'Contrato del sistema de Vuelos tal como está implementado: núcleo GDS (búsqueda, retención de cupos, reservas, billetes, posventa, check-in, webhooks), ' +
      'e-commerce (identidad, catálogo, ofertas, pagos simulados, órdenes) y administración (órdenes, vuelos, usuarios, dashboard, observabilidad).\n\n' +
      'Convenciones comunes: prefijo /api/v1; autenticación Bearer JWT (HS256) y `ownerId` siempre igual al `sub` verificado; errores `application/problem+json` con el campo `code`; ' +
      'las escrituras críticas exigen `Idempotency-Key` (UUID); los importes en el borde de la API son cadenas decimales y en el sistema son enteros en unidades menores.',
    version: doc.info?.version || '1.0',
  };
  doc.servers = [{ url: PRODUCTION_URL, description: 'Producción (Railway)' }, { url: 'http://localhost:3000/api/v1', description: 'Desarrollo local' }];
  // The API publishes full paths (/api/v1/...); the server URL already carries the prefix.
  doc.paths = Object.fromEntries(Object.entries(doc.paths).map(([route, item]) => [route.replace(/^\/api\/v1/, '') || '/', item]));

  // Conventional order at the top (openapi, info, servers, tags, paths, components); everything below sorted.
  const ordered = {};
  for (const key of ['openapi', 'info', 'servers', 'tags', 'paths', 'components']) if (doc[key] !== undefined) ordered[key] = sortKeys(doc[key]);
  for (const key of Object.keys(doc).sort()) if (!(key in ordered)) ordered[key] = sortKeys(doc[key]);
  fs.writeFileSync(TARGET, HEADER + yaml.dump(ordered, { lineWidth: 140, noRefs: true, sortKeys: false }));
  const operations = Object.values(doc.paths).reduce((n, item) => n + Object.keys(item).filter((k) => ['get', 'post', 'put', 'patch', 'delete'].includes(k)).length, 0);
  console.log(`Wrote ${path.relative(process.cwd(), TARGET)}: ${Object.keys(doc.paths).length} paths, ${operations} operations.`);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
