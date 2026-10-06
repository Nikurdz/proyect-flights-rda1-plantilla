import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';

/**
 * The text behind each passenger's QR code: `v1.<e-ticket>.<PNR>.<signature>`.
 *
 * It is deterministic (same ticket, same code, on every read and on idempotent replay), carries no
 * personal data, and is signed so a made-up or altered code cannot pass verification. The signing key
 * is derived (HKDF) from JWT_SECRET with its own label, so it never shares raw material with the JWT
 * signature. Changing JWT_SECRET therefore invalidates the codes already issued.
 */
const VERSION = 'v1';
const SIGNATURE_BYTES = 16;
const CODE_PATTERN = /^v1\.(\d{13})\.([A-Z0-9]{6})\.([A-Za-z0-9_-]{22})$/;

const keys = new Map<string, Buffer>();

function signingKey(jwtSecret: string): Buffer {
  let key = keys.get(jwtSecret);
  if (!key) {
    key = Buffer.from(hkdfSync('sha256', jwtSecret, '', 'vuelos-ticket-qr', 32));
    keys.set(jwtSecret, key);
  }
  return key;
}

function sign(jwtSecret: string, eTicketNumber: string, pnr: string): string {
  return createHmac('sha256', signingKey(jwtSecret)).update(`${VERSION}.${eTicketNumber}.${pnr}`).digest().subarray(0, SIGNATURE_BYTES).toString('base64url');
}

export function buildTicketCode(jwtSecret: string, eTicketNumber: string, pnr: string): string {
  return `${VERSION}.${eTicketNumber}.${pnr}.${sign(jwtSecret, eTicketNumber, pnr)}`;
}

/** The e-ticket and locator inside a code whose signature is valid; null for anything else. */
export function verifyTicketCode(jwtSecret: string, code: string): { eTicketNumber: string; pnr: string } | null {
  const match = CODE_PATTERN.exec(code.trim());
  if (!match) return null;
  const [, eTicketNumber, pnr, signature] = match;
  const expected = Buffer.from(sign(jwtSecret, eTicketNumber, pnr));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  return { eTicketNumber, pnr };
}
