import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { isPrivateAddress, postJson, resolveSafeTarget, signWebhookBody, UnsafeUrlError } from './safe-http';

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254', // cloud metadata
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.5',
    'not-an-ip',
  ])('%s is not public', (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(['93.184.216.34', '8.8.8.8', '172.15.0.1', '172.32.0.1', '2606:4700:4700::1111'])('%s is public', (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });
});

describe('resolveSafeTarget', () => {
  it('accepts an https URL that points at a public address', async () => {
    const target = await resolveSafeTarget('https://93.184.216.34/hooks/flights', false);
    expect(target.address).toBe('93.184.216.34');
    expect(target.url.pathname).toBe('/hooks/flights');
  });

  it.each([
    ['http://93.184.216.34/hook', 'only https'],
    ['https://user:pass@93.184.216.34/hook', 'credentials'],
    ['https://127.0.0.1/hook', 'non-public'],
    ['https://10.0.0.8/hook', 'non-public'],
    ['https://169.254.169.254/latest/meta-data', 'non-public'],
    ['https://[::1]/hook', 'non-public'],
    ['https://localhost/hook', 'non-public'],
    ['not a url', 'not valid'],
  ])('refuses %s', async (url, reason) => {
    await expect(resolveSafeTarget(url, false)).rejects.toThrow(UnsafeUrlError);
    await expect(resolveSafeTarget(url, false)).rejects.toThrow(reason);
  });

  it('lets local hosts and plain http through only when private hosts are allowed (development and tests)', async () => {
    const target = await resolveSafeTarget('http://127.0.0.1:8080/hook', true);
    expect(target.address).toBe('127.0.0.1');
  });
});

describe('signWebhookBody', () => {
  it('is deterministic, tied to the timestamp and the body, and needs the secret', () => {
    const signature = signWebhookBody('a-shared-secret-16+', '1700000000', '{"a":1}');
    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(signWebhookBody('a-shared-secret-16+', '1700000000', '{"a":1}')).toBe(signature);
    expect(signWebhookBody('a-shared-secret-16+', '1700000001', '{"a":1}')).not.toBe(signature);
    expect(signWebhookBody('a-shared-secret-16+', '1700000000', '{"a":2}')).not.toBe(signature);
    expect(signWebhookBody('another-secret-16+++', '1700000000', '{"a":1}')).not.toBe(signature);
  });
});

describe('postJson', () => {
  let server: http.Server;
  let received: { headers: http.IncomingHttpHeaders; body: string } | undefined;
  let mode: 'ok' | 'redirect' | 'slow' | 'huge' = 'ok';

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        received = { headers: req.headers, body };
        if (mode === 'redirect') {
          res.writeHead(302, { Location: 'http://127.0.0.1:1/elsewhere' }).end();
        } else if (mode === 'slow') {
          // never answers: the client has to give up
        } else if (mode === 'huge') {
          res.writeHead(200).end('x'.repeat(200_000));
        } else {
          res.writeHead(200).end('received');
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  const target = async () => resolveSafeTarget(`http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`, true);

  it('posts the body with the given headers to the resolved address and returns the status', async () => {
    mode = 'ok';
    const result = await postJson(await target(), '{"hello":"world"}', { 'X-Webhook-Id': 'abc' }, { timeoutMs: 2000, maxResponseBytes: 4096 });
    expect(result).toEqual({ status: 200, snippet: 'received' });
    expect(received?.body).toBe('{"hello":"world"}');
    expect(received?.headers['x-webhook-id']).toBe('abc');
    expect(received?.headers['content-type']).toBe('application/json');
  });

  it('does not follow redirects: the 302 is the outcome', async () => {
    mode = 'redirect';
    const result = await postJson(await target(), '{}', {}, { timeoutMs: 2000, maxResponseBytes: 4096 });
    expect(result.status).toBe(302);
  });

  it('gives up on a receiver that never answers', async () => {
    mode = 'slow';
    await expect(postJson(await target(), '{}', {}, { timeoutMs: 300, maxResponseBytes: 4096 })).rejects.toThrow(/no answer/);
  });

  it('never reads an unbounded answer', async () => {
    mode = 'huge';
    const result = await postJson(await target(), '{}', {}, { timeoutMs: 2000, maxResponseBytes: 1024 });
    expect(result.status).toBe(200);
    expect(result.snippet.length).toBeLessThanOrEqual(300);
  });
});
