import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import SwaggerParser = require('@apidevtools/swagger-parser');
import * as yaml from 'js-yaml';
import { CONTRACT_V2_FILE } from './contract-v2-validator';

jest.setTimeout(60_000);

const ROOT = join(__dirname, '..', '..', '..', '..');
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

interface Doc {
  openapi: string;
  servers: { url: string; variables?: Record<string, { default: string }> }[];
  paths: Record<string, Record<string, { operationId?: string; responses?: Record<string, unknown>; parameters?: { name?: string; in?: string; schema?: { format?: string } }[] }>>;
  components: { securitySchemes: Record<string, { flows?: { clientCredentials?: { tokenUrl: string } } }> };
}

const load = (file: string): Doc => yaml.load(readFileSync(file, 'utf8')) as Doc;
const operationsOf = (doc: Doc) =>
  Object.entries(doc.paths).flatMap(([path, item]) => Object.entries(item).filter(([m]) => METHODS.includes(m)).map(([method, operation]) => ({ method, path, operation })));

describe('Our contract v2 (contracts/vuelos-openapi-v2-ram-alliance.yaml)', () => {
  const ours = load(CONTRACT_V2_FILE);
  const template = load(join(ROOT, 'contracts', 'vuelos-openapi-v2.yaml'));

  it('is valid OpenAPI 3.0.3', async () => {
    const api = await SwaggerParser.validate(CONTRACT_V2_FILE);
    expect((api as unknown as { openapi: string }).openapi).toBe('3.0.3');
  });

  it('is up to date: it is exactly what scripts/build-contract-v2.js produces (run `npm run contract:v2:build` if this fails)', () => {
    const built = execFileSync('node', [join(ROOT, 'scripts', 'build-contract-v2.js'), '--stdout'], { encoding: 'utf8', cwd: ROOT });
    const committed = readFileSync(CONTRACT_V2_FILE, 'utf8');
    expect(committed.replace(/\r\n/g, '\n')).toBe(built.replace(/\r\n/g, '\n'));
  });

  it('keeps every operation of Booking\'s template and adds the token endpoint', () => {
    const templateIds = operationsOf(template).map((o) => o.operation.operationId);
    const ourIds = operationsOf(ours).map((o) => o.operation.operationId);
    expect(templateIds).toHaveLength(30);
    expect(templateIds.filter((id) => !ourIds.includes(id))).toEqual([]);
    expect(ourIds.filter((id) => !templateIds.includes(id))).toEqual(['issueToken', 'receiveBookingEvent']);
    expect(ours.paths['/oauth2/token']).toBeDefined();
    expect(ours.components.securitySchemes.PartnerOAuth2.flows?.clientCredentials?.tokenUrl).toBe('/api/v2/oauth2/token');
  });

  it('says what this node does: UUID ids, no 202, a 429 everywhere, our servers', () => {
    for (const { operation } of operationsOf(ours)) {
      expect(Object.keys(operation.responses ?? {})).not.toContain('202');
      expect(Object.keys(operation.responses ?? {})).toContain('429');
    }
    const uuidParams = operationsOf(ours).flatMap((o) => (o.operation.parameters ?? []).filter((p) => p.in === 'path' && ['segmentId', 'ticketId'].includes(p.name ?? '')));
    expect(uuidParams.length).toBeGreaterThan(0);
    expect(uuidParams.every((p) => p.schema?.format === 'uuid')).toBe(true);
    expect(readFileSync(CONTRACT_V2_FILE, 'utf8')).not.toMatch(/(?<![A-Za-z0-9])(OFF|SEG|TKT|QTE|CHG)-[A-Z0-9]{2,}-/);
    expect(ours.servers[0].url).toBe('http://{host}:{port}/api/v2');
    expect(ours.servers[0].variables?.host.default).toBe('100.118.24.48');
  });
});
