import { createHmac } from 'node:crypto';
import { promises as dns } from 'node:dns';
import * as http from 'node:http';
import * as https from 'node:https';
import { isIP } from 'node:net';

/**
 * Outbound HTTP for webhook deliveries. The URL is chosen by whoever registers the webhook, so the server must
 * never be turned into a proxy to its own network (SSRF): the hostname is resolved HERE, every address it resolves
 * to must be public, and the connection goes to that very address (no second lookup an attacker could answer
 * differently, which is what DNS rebinding relies on). Redirects are not followed, the wait is bounded and the
 * answer is cut off at a few kilobytes.
 */

export class UnsafeUrlError extends Error {}

/** True for loopback, private, link-local, carrier-grade NAT, multicast, reserved and unspecified addresses. */
export function isPrivateAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) return isPrivateV4(address);
  if (kind === 6) return isPrivateV6(address.toLowerCase());
  return true; // not an IP at all: never treat it as safe
}

function isPrivateV4(address: string): boolean {
  const [a, b] = address.split('.').map(Number);
  return (
    a === 0 || // "this" network
    a === 10 ||
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, includes the cloud metadata address
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) || // IETF protocol assignments / documentation
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast and reserved
  );
}

function isPrivateV6(address: string): boolean {
  if (address === '::' || address === '::1') return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(address);
  if (mapped) return isPrivateV4(mapped[1]);
  const first = Number.parseInt(address.split(':')[0] || '0', 16);
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00; // unique-local, link-local, multicast
}

export interface SafeTarget {
  url: URL;
  /** The address the connection will be made to. */
  address: string;
  family: 4 | 6;
}

/**
 * Validates a webhook URL and resolves it. Only `https` (or `http` when private hosts are allowed for local
 * development and tests), no credentials in the URL, and every resolved address public unless allowed.
 */
export async function resolveSafeTarget(rawUrl: string, allowPrivateHosts: boolean): Promise<SafeTarget> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError('the URL is not valid');
  }
  if (url.protocol !== 'https:' && !(allowPrivateHosts && url.protocol === 'http:')) {
    throw new UnsafeUrlError('only https URLs are accepted');
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('the URL must not carry credentials');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) as 4 | 6 }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) {
    throw new UnsafeUrlError('the host cannot be resolved');
  }
  if (!allowPrivateHosts && addresses.some((a) => isPrivateAddress(a.address))) {
    throw new UnsafeUrlError('the host resolves to a non-public address');
  }
  return { url, address: addresses[0].address, family: addresses[0].family as 4 | 6 };
}

/** `sha256=<hex>` of HMAC-SHA256(secret, `${timestamp}.${body}`): the receiver recomputes it to authenticate a delivery. */
export function signWebhookBody(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

export interface PostResult {
  status: number;
  /** First bytes of the answer, for the delivery log. */
  snippet: string;
}

/** POSTs JSON to a target already validated by resolveSafeTarget, connecting to its resolved address. */
export function postJson(
  target: SafeTarget,
  body: string,
  headers: Record<string, string>,
  options: { timeoutMs: number; maxResponseBytes: number },
): Promise<PostResult> {
  const { url } = target;
  const secure = url.protocol === 'https:';
  const transport = secure ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      {
        host: target.address,
        family: target.family,
        port: url.port || (secure ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: { ...headers, Host: url.host, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        // The certificate is checked against the hostname, not the pinned address.
        ...(secure ? { servername: url.hostname } : {}),
        timeout: options.timeoutMs,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size <= options.maxResponseBytes) chunks.push(chunk);
          else response.destroy(); // enough: never read an unbounded answer
        });
        const done = () => resolve({ status: response.statusCode ?? 0, snippet: Buffer.concat(chunks).toString('utf8').slice(0, 300) });
        response.on('end', done);
        response.on('close', done);
        response.on('error', done);
      },
    );
    request.on('timeout', () => request.destroy(new Error(`no answer within ${options.timeoutMs} ms`)));
    request.on('error', reject);
    request.end(body);
  });
}
