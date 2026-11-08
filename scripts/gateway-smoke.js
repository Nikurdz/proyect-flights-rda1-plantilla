#!/usr/bin/env node
// Smoke test of the local API gateway (deploy/gateway/kong.yml). It needs Kong on GATEWAY_URL and the API behind it
// (started with TRUST_PROXY=1). It only reads or sends requests the gateway must refuse, plus a sign-up and a login
// of a throw-away account, so it is safe to run against a development database.
//
//   docker compose --profile gateway up -d kong
//   npm run gateway:smoke
const { randomUUID } = require('node:crypto');

const BASE = (process.env.GATEWAY_URL || 'http://localhost:8000').replace(/\/$/, '');
let failures = 0;

async function call(path, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(`${BASE}${path}`, { method, headers, body });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, headers: res.headers, text, json };
}

function check(name, condition, detail) {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function main() {
  console.log(`Gateway smoke test against ${BASE}`);

  const health = await call('/api/v1/health/live');
  check('health answers 200 through the gateway', health.status === 200, `status ${health.status}`);
  check('health carries a correlation id', Boolean(health.headers.get('x-correlation-id')));

  const propio = `smoke-${randomUUID()}`;
  const eco = await call('/api/v1/mercados/ec', { headers: { 'X-Correlation-Id': propio } });
  check('a public route passes and keeps the caller correlation id', eco.status === 200 && eco.headers.get('x-correlation-id') === propio, `status ${eco.status}`);

  const sinToken = await call('/api/v1/admin/ordenes');
  check('admin route without a token is refused at the edge (401)', sinToken.status === 401, `status ${sinToken.status}`);
  const malToken = await call('/api/v1/movil/ordenes', { headers: { Authorization: 'Bearer no.es.un-token' } });
  check('a malformed token is refused at the edge (401)', malToken.status === 401, `status ${malToken.status}`);

  const texto = await call('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hola' });
  check('a body that is not JSON is refused (415 problem+json)', texto.status === 415 && (texto.headers.get('content-type') || '').includes('problem+json'), `status ${texto.status}`);

  const grande = await call('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: 'a'.repeat(1_100_000) }) });
  check('a body over 1 MB is refused (413)', grande.status === 413, `status ${grande.status}`);

  const clave = await call('/api/v1/ofertas', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'no-es-un-uuid' }, body: '{}' });
  check('a malformed Idempotency-Key is refused (400)', clave.status === 400 && clave.json?.code === 'VALIDATION_FAILED', `status ${clave.status}`);

  const correo = `smoke-${randomUUID().slice(0, 8)}@example.com`;
  const registro = await call('/api/v1/clientes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena: 'Passw0rd-ok-123', nombres: 'Smoke', apellidos: 'Test', fechaNacimiento: '1990-04-01', aceptaTerminos: true }),
  });
  check('sign-up passes through the gateway (201)', registro.status === 201, `status ${registro.status} ${registro.text.slice(0, 120)}`);
  const login = await call('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo, contrasena: 'Passw0rd-ok-123' }) });
  const token = login.json?.accessToken;
  check('login returns a token', login.status === 200 && Boolean(token), `status ${login.status}`);

  if (token) {
    const lista = await call('/api/v1/movil/ordenes', { headers: { Authorization: `Bearer ${token}` } });
    check('a valid token reaches the mobile BFF (200)', lista.status === 200 && Array.isArray(lista.json?.items), `status ${lista.status}`);
    const admin = await call('/api/v1/admin/ordenes', { headers: { Authorization: `Bearer ${token}` } });
    check('a customer token passes the edge but the API still refuses the admin route (403)', admin.status === 403, `status ${admin.status}`);
  }

  // Last: it burns the quota of this address for a minute.
  let limitado;
  for (let i = 0; i < 320 && !limitado; i++) {
    const res = await call('/api/v1/mercados/ec');
    if (res.status === 429) limitado = res;
  }
  check('a burst is limited (429) with Retry-After', Boolean(limitado) && Boolean(limitado.headers.get('retry-after')), limitado ? '' : 'no 429 after 320 requests');

  console.log(failures === 0 ? '\nAll gateway checks passed.' : `\n${failures} gateway check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`Could not run the smoke test: ${error.message}`);
  process.exit(2);
});
