import * as fs from 'node:fs';
import * as path from 'node:path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as yaml from 'js-yaml';
import { IntegrationApp, createIntegrationApp, describeIntegration } from './integration-app';

jest.setTimeout(120_000);

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const CONTRACT = path.join(__dirname, '..', '..', '..', '..', 'contracts', 'vuelos-ecommerce-openapi.yaml');

type OpenApi = { openapi: string; info: { title: string }; servers: unknown[]; paths: Record<string, Record<string, unknown>>; components: { schemas: Record<string, unknown> } };

const operations = (doc: Pick<OpenApi, 'paths'>, stripPrefix: boolean): string[] =>
  Object.entries(doc.paths)
    .flatMap(([route, item]) => Object.keys(item).filter((k) => METHODS.includes(k)).map((m) => `${m.toUpperCase()} ${stripPrefix ? route.replace(/^\/api\/v1/, '') || '/' : route}`))
    .sort();

describe('OpenAPI contract of the whole system (contracts/vuelos-ecommerce-openapi.yaml)', () => {
  const contract = yaml.load(fs.readFileSync(CONTRACT, 'utf8')) as OpenApi;

  it('is a well-formed OpenAPI document whose every $ref points to a schema that exists', () => {
    expect(contract.openapi).toMatch(/^3\./);
    expect(contract.info.title).toContain('API de Vuelos');
    expect(contract.servers.length).toBeGreaterThan(0);
    const refs = [...JSON.stringify(contract).matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    const missing = [...new Set(refs)].filter((name) => !(name in contract.components.schemas));
    expect(missing).toEqual([]);
  });

  it('keeps the sensitive routes protected in the contract (Bearer on every admin operation, Idempotency-Key on the purchase)', () => {
    for (const [route, item] of Object.entries(contract.paths)) {
      if (!route.startsWith('/admin/')) continue;
      for (const method of METHODS.filter((m) => item[m])) {
        expect(JSON.stringify((item[method] as { security?: unknown }).security ?? [])).toContain('bearer');
      }
    }
    const purchase = JSON.stringify(contract.paths['/ofertas/{id}/compra']?.post ?? {});
    expect(purchase).toContain('Idempotency-Key');
  });
});

describeIntegration('The contract describes exactly the API that is running', () => {
  let ctx: IntegrationApp;

  beforeAll(async () => {
    ctx = await createIntegrationApp();
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('has the same operations (method + path) as the document the live application publishes; regenerate with `npm run contract:export` if this fails', () => {
    const live = SwaggerModule.createDocument(ctx.app, new DocumentBuilder().setTitle('x').setVersion('1').addBearerAuth().build());
    const contract = yaml.load(fs.readFileSync(CONTRACT, 'utf8')) as OpenApi;
    const fromApi = operations(live as unknown as Pick<OpenApi, 'paths'>, true);
    const fromContract = operations(contract, false);
    expect({ missingInContract: fromApi.filter((o) => !fromContract.includes(o)), notInApi: fromContract.filter((o) => !fromApi.includes(o)) }).toEqual({ missingInContract: [], notInApi: [] });
  });
});
