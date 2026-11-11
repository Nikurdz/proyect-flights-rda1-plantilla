import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import * as yaml from 'js-yaml';
import request = require('supertest');
import { PartnerAuthService } from '../v2/auth/partner-auth.service';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(180_000);

interface Operation {
  operationId?: string;
  security?: { PartnerOAuth2?: string[] }[];
}
interface Contract {
  paths: Record<string, Record<string, Operation>>;
}

// Our contract (generated from Booking's template + our overlay); the template itself is checked by contract-v2-build.spec.ts.
const CONTRACT = yaml.load(readFileSync(join(__dirname, '..', '..', '..', '..', 'contracts', 'vuelos-openapi-v2-ram-alliance.yaml'), 'utf8')) as Contract;
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const operations = Object.entries(CONTRACT.paths).flatMap(([path, item]) =>
  Object.entries(item)
    .filter(([method]) => METHODS.includes(method))
    .map(([method, operation]) => ({ method, path, operation, scope: operation.security?.[0]?.PartnerOAuth2?.[0] ?? null })),
);

/** A concrete URL for a templated path (ids are valid UUIDs, flight numbers look like LA800). */
const concrete = (path: string): string =>
  `/api/v2${path}`
    .replace('{flightNumber}', 'LA800')
    .replace(/\{(\w+)\}/g, '3f2b8c1e-0a53-4c5e-9a43-123456789abc');

describeIntegration('The v2 contract describes exactly what /api/v2/vuelos serves', () => {
  let ctx: IntegrationApp;
  let app: INestApplication;
  const api = () => request(app.getHttpServer());

  const token = async (scope: string): Promise<string> =>
    (await api().post('/api/v2/oauth2/token').type('form').send({ grant_type: 'client_credentials', client_id: 'contract-test', client_secret: 'contract-test-secret-24-chars!', scope })).body.access_token as string;

  beforeAll(async () => {
    ctx = await createIntegrationApp();
    app = ctx.app;
    await app.get(PartnerAuthService).upsert('contract-test', 'contract-test-secret-24-chars!');
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('lists the 32 operations of the contract (the 30 of the template plus the token and Booking-event endpoints)', () => {
    expect(operations).toHaveLength(32);
    expect(new Set(operations.map((o) => o.operation.operationId)).size).toBe(32);
  });

  it.each(operations.map((o) => [`${o.method.toUpperCase()} ${o.path}`, o] as const))('%s exists and enforces the scope the contract names', async (_name, op) => {
    const url = concrete(op.path);
    const send = (agent: request.Test) => (op.method === 'get' || op.method === 'delete' ? agent : agent.send({}));
    const call = (headers: Record<string, string> = {}) => send((api() as unknown as Record<string, (u: string) => request.Test>)[op.method](url).set(headers));

    const anonymous = await call();
    // Nest answers "Cannot GET /path" with its own 404 when the route does not exist.
    expect(JSON.stringify(anonymous.body)).not.toContain('Cannot ');
    if (op.operation.operationId === 'receiveBookingEvent') {
      // Not a Bearer operation: it is authenticated by the HMAC signature of Booking.
      expect(anonymous.status).toBe(401);
      return;
    }
    if (op.scope === null) {
      expect(anonymous.status).not.toBe(401);
      return;
    }
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers['content-type']).toContain('application/problem+json');

    // A token with a different scope is refused; one with exactly the scope is let in (whatever the handler then answers).
    const other = op.scope === 'flights:read' ? 'flights:hold' : 'flights:read';
    const wrong = await call({ Authorization: `Bearer ${await token(other)}` });
    expect(wrong.status).toBe(403);
    const right = await call({ Authorization: `Bearer ${await token(op.scope)}`, 'Idempotency-Key': '5d1c0c4e-6a52-4f4e-8d6b-0d3d9f6f2a11' });
    expect([401, 403]).not.toContain(right.status);
  });
});
