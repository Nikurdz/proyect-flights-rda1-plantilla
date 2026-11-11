#!/usr/bin/env node
// Genera la definicion de la Container App (JSON, valido como YAML para `az containerapp create --yaml`)
// a partir de deploy/azure/.env.azure. Los valores sensibles van como secretos de Azure (secretRef), el resto como
// variables normales. Uso: node generar-app.js <imagen> <ubicacion> <idEntorno> > app.json
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const [image, location, environmentId] = process.argv.slice(2);
if (!image || !location || !environmentId) {
  console.error('Uso: node generar-app.js <imagen> <ubicacion> <idEntorno>');
  process.exit(2);
}

const SECRETS = new Set([
  'DATABASE_URL',
  'DB_SSL_CA',
  'JWT_SECRET',
  'DATA_ENCRYPTION_KEY',
  'PARTNER_CLIENT_SECRET',
  'ADMIN_PASSWORD',
  'BOOKING_WEBHOOK_SECRET',
  'BOOKING_STOCK_API_KEY',
  'BOOKING_PAGOS_API_KEY',
  'RABBITMQ_URL',
]);
const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'DATA_ENCRYPTION_KEY'];
const DEFAULTS = { NODE_ENV: 'production', PORT: '3000', TRUST_PROXY: '1', LOG_TO_FILES: 'false' };

const file = path.join(__dirname, '.env.azure');
if (!fs.existsSync(file)) {
  console.error('Falta deploy/azure/.env.azure (copia .env.azure.example y rellenalo).');
  process.exit(1);
}

const values = { ...DEFAULTS };
for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq < 1) continue;
  const key = line.slice(0, eq).trim();
  let value = line.slice(eq + 1).trim();
  // Comillas opcionales alrededor del valor; el contenido se deja tal cual (la app entiende "\n" literal en DB_SSL_CA).
  if (/^(".*"|'.*')$/.test(value)) value = value.slice(1, -1);
  if (value !== '') values[key] = value;
}

const missing = REQUIRED.filter((k) => !values[k]);
if (missing.length) {
  console.error(`Faltan variables obligatorias en .env.azure: ${missing.join(', ')}`);
  process.exit(1);
}

const secretName = (key) => key.toLowerCase().replace(/_/g, '-');
const secrets = [];
const env = [];
for (const [key, value] of Object.entries(values)) {
  if (SECRETS.has(key)) {
    secrets.push({ name: secretName(key), value });
    env.push({ name: key, secretRef: secretName(key) });
  } else {
    env.push({ name: key, value });
  }
}

const probe = (type, extra) => ({ type, httpGet: { path: '/api/v1/health/live', port: 3000 }, ...extra });

const app = {
  location,
  properties: {
    environmentId,
    configuration: {
      activeRevisionsMode: 'Single',
      ingress: { external: true, targetPort: 3000, transport: 'auto', allowInsecure: false },
      secrets,
    },
    template: {
      containers: [
        {
          name: 'vuelos-api',
          image,
          resources: { cpu: 0.25, memory: '0.5Gi' },
          env,
          probes: [
            // El arranque en frio migra, siembra y levanta Nest: margen de 5 minutos antes de darlo por fallido.
            probe('Startup', { initialDelaySeconds: 3, periodSeconds: 5, failureThreshold: 60, timeoutSeconds: 3 }),
            probe('Liveness', { periodSeconds: 30, failureThreshold: 3, timeoutSeconds: 5 }),
          ],
        },
      ],
      // Una sola replica como maximo: los jobs, el debounce del stock y los limites viven en memoria.
      // minReplicas 0 = escala a cero (coste casi nulo); ponlo en 1 para tenerla siempre encendida.
      scale: {
        minReplicas: Number(process.env.MIN_REPLICAS ?? 0),
        maxReplicas: 1,
        rules: [{ name: 'http', http: { metadata: { concurrentRequests: '20' } } }],
      },
    },
  },
};

process.stdout.write(JSON.stringify(app, null, 2));
