#!/usr/bin/env node
// Smoke de punta a punta del demo de microservicios (docker-compose.microservicios.yml), sin dependencias:
//   npm run micro:build && npm run micro:up && npm run micro:smoke
// 1. espera la salud del nucleo (por Kong), de los tres satelites (/svc/<s>/health) y del frontend;
// 2. hace una busqueda v1 y una compra de invitado completa por la API web;
// 3. con el administrador de demo comprueba que otro contenedor escribio la traza de auditoria y la notificacion
//    de la orden (el nucleo corre con SERVICE_ROLE=api y no registra esos suscriptores).
// Variables: GATEWAY_URL (http://localhost:8000), FRONTEND_URL (http://localhost:8080), ADMIN_EMAIL/ADMIN_PASSWORD
// (los de docker/.env.microservicios), WAIT_SECONDS (300). Sale con codigo 1 si algun paso falla.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

// Lee docker/.env.microservicios (sin sobrescribir lo que ya venga del entorno).
try {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'docker', '.env.microservicios'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch {
  /* sin archivo: se usan los valores de demo por defecto */
}

const BASE = (process.env.GATEWAY_URL || 'http://localhost:8000').replace(/\/$/, '');
const FRONT = (process.env.FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '');
const ADMIN = { correo: process.env.ADMIN_EMAIL || 'admin-demo@example.com', contrasena: process.env.ADMIN_PASSWORD || 'DemoAdmin-12345' };
const WAIT_MS = Number(process.env.WAIT_SECONDS || 300) * 1000;

let failures = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (name, detail) => console.log(`  OK    ${name}${detail ? ` (${detail})` : ''}`);
const fail = (name, detail) => {
  failures += 1;
  console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`);
};

async function call(url, { method = 'GET', headers = {}, body, token } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const res = await fetch(url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, json, text };
}
const api = (p, opts) => call(`${BASE}/api/v1${p}`, opts);

async function waitFor(name, probe, timeoutMs = WAIT_MS) {
  const limit = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < limit) {
    try {
      const r = await probe();
      if (r === true) return ok(name);
      last = typeof r === 'string' ? r : '';
    } catch (e) {
      last = e.cause?.code || e.message;
    }
    await sleep(3000);
  }
  fail(name, `sin respuesta tras ${timeoutMs / 1000}s ${last}`);
  return false;
}

const dayAhead = (d) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const yearsBefore = (years, from) => {
  const d = new Date(`${from}T00:00:00.000Z`);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
};

async function main() {
  console.log(`Smoke de microservicios: gateway ${BASE}, frontend ${FRONT}`);

  console.log('1. Salud');
  const health = [
    ['nucleo (vuelos-api) /api/v1/health/live', `${BASE}/api/v1/health/live`],
    ['auditoria /health', `${BASE}/svc/auditoria/health`],
    ['notificaciones /health', `${BASE}/svc/notificaciones/health`],
    ['webhooks /health', `${BASE}/svc/webhooks/health`],
  ];
  for (const [name, url] of health) {
    await waitFor(name, async () => {
      const r = await call(url);
      return r.status === 200 ? true : `status ${r.status}`;
    });
  }
  await waitFor('frontend', async () => {
    const res = await fetch(`${FRONT}/`);
    return res.status === 200 ? true : `status ${res.status}`;
  });
  if (failures) return;

  console.log('2. Busqueda v1 (espera al seed del nucleo)');
  const out = dayAhead(3);
  let itinerario;
  await waitFor('hay vuelos BOG-SCL sembrados', async () => {
    const r = await api(`/disponibilidad?origin=BOG&destination=SCL&outbound=${out}&adt=1&sort=MAS_BARATOS`);
    itinerario = r.json?.trayectos?.[0]?.itinerarios?.[0];
    return itinerario ? true : `status ${r.status}`;
  });
  if (!itinerario) return;

  console.log('3. Compra de invitado (API web)');
  const guest = await api('/auth/invitado', { method: 'POST' });
  const token = guest.json?.accessToken;
  if (guest.status !== 201 || !token) return fail('token de invitado', `status ${guest.status}`);
  ok('token de invitado');

  const oferta = await api('/ofertas', {
    method: 'POST',
    token,
    headers: { 'Idempotency-Key': randomUUID() },
    body: { mercado: 'ec', selecciones: [{ itinerarioId: itinerario.itinerarioId, familia: 'LIGHT' }], pasajeros: { adultos: 1, ninos: 0, infantes: 0 } },
  });
  if (oferta.status !== 201) return fail('crear oferta', `status ${oferta.status} ${oferta.text.slice(0, 200)}`);
  const ofertaId = oferta.json.ofertaId;
  ok('crear oferta', ofertaId);

  const pasajero = {
    id: 'a1',
    tipo: 'ADULT',
    nombres: 'Maria Jose',
    apellidos: 'Pena Tapia',
    fechaNacimiento: yearsBefore(35, out),
    genero: 'F',
    nacionalidad: 'EC',
    documento: { tipo: 'PASSPORT', numero: `SM${Date.now().toString().slice(-8)}`, vencimiento: '2040-01-01' },
  };
  const pasos = [
    ['pasajeros y contacto', 'PUT', `/ofertas/${ofertaId}/pasajeros`, { pasajeros: [pasajero], contacto: { correo: 'smoke@example.com', telefono: '+593999999999' } }, 200],
    ['facturacion', 'PUT', `/ofertas/${ofertaId}/facturacion`, { tipoIdentificacion: 'CEDULA', numeroIdentificacion: '1712345678', razonSocial: 'Maria Pena', direccion: 'Av. Amazonas 123', pais: 'EC' }, 200],
    ['condiciones', 'POST', `/ofertas/${ofertaId}/condiciones`, { versionTerminos: '2026-10', versionCondicionesTransporte: '2026-10' }, 200],
  ];
  for (const [name, method, p, body, expected] of pasos) {
    const r = await api(p, { method, token, body });
    if (r.status !== expected) return fail(name, `status ${r.status} ${r.text.slice(0, 200)}`);
    ok(name);
  }
  const compra = await api(`/ofertas/${ofertaId}/compra`, {
    method: 'POST',
    token,
    headers: { 'Idempotency-Key': randomUUID() },
    body: { medio: { tipo: 'TARJETA', token: 'tok_visa_ok', marca: 'VISA' } },
  });
  const numero = compra.json?.numeroOrden;
  if (compra.status !== 201 || compra.json?.estado !== 'EMITIDA') return fail('compra emitida', `status ${compra.status} ${compra.text.slice(0, 200)}`);
  ok('compra emitida', `${numero} PNR ${compra.json.pnr}`);

  console.log('4. Efectos en otros contenedores (administrador)');
  const login = await api('/auth/login', { method: 'POST', body: ADMIN });
  const admin = login.json?.accessToken;
  if (login.status !== 200 || !admin) return fail('login del administrador de demo', `status ${login.status}`);
  ok('login del administrador de demo');

  let items = [];
  await waitFor('auditoria: la traza de la orden tiene eventos (escritos por el contenedor auditoria)', async () => {
    const r = await api(`/admin/trazabilidad?numero=${encodeURIComponent(numero)}`, { token: admin });
    items = r.json?.items ?? [];
    return items.length > 0 ? true : `status ${r.status}, ${items.length} filas`;
  }, 60_000);
  if (items.length) console.log(`        ${items.length} filas: ${[...new Set(items.map((i) => i.tipo))].slice(0, 6).join(', ')}`);

  await waitFor('notificaciones: la orden tiene su mensaje (escrito por el contenedor notificaciones)', async () => {
    const r = await api(`/admin/notificaciones?referencia=${encodeURIComponent(numero)}`, { token: admin });
    return Array.isArray(r.json) && r.json.length > 0 ? true : `status ${r.status}, ${Array.isArray(r.json) ? r.json.length : '?'} mensajes`;
  }, 60_000);
}

main()
  .catch((e) => fail('error inesperado', e.stack || e.message))
  .finally(() => {
    console.log(failures ? `\nFAIL: ${failures} paso(s) fallaron` : '\nOK: todos los pasos pasaron');
    process.exit(failures ? 1 : 0);
  });
