import { describe, it, expect } from 'vitest';
import { sessionFromToken } from '../../src/lib/session';

/** Builds an unsigned JWT-shaped string: the browser only reads the payload, the API verifies it. */
function token(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

const NOW = Date.UTC(2026, 9, 5, 12, 0, 0);
const inAnHour = Math.floor(NOW / 1000) + 3600;

describe('sessionFromToken', () => {
  it('tells a customer from a guest by the token kind', () => {
    const customer = sessionFromToken(token({ sub: 'c-1', kind: 'customer', roles: ['CUSTOMER'], exp: inAnHour }), NOW);
    const guest = sessionFromToken(token({ sub: 'guest:abc', kind: 'guest', roles: [], exp: inAnHour }), NOW);

    expect(customer).toMatchObject({ kind: 'customer', ownerId: 'c-1', isAdmin: false });
    expect(guest).toMatchObject({ kind: 'guest', ownerId: 'guest:abc', isAdmin: false });
  });

  it('only a signed-in customer with the ADMIN role is an admin', () => {
    const admin = sessionFromToken(token({ sub: 'c-9', kind: 'customer', roles: ['CUSTOMER', 'ADMIN'], exp: inAnHour }), NOW);
    const guestWithRole = sessionFromToken(token({ sub: 'guest:x', kind: 'guest', roles: ['ADMIN'], exp: inAnHour }), NOW);

    expect(admin?.isAdmin).toBe(true);
    expect(guestWithRole?.isAdmin).toBe(false);
  });

  it('treats an expired, malformed or missing token as no session', () => {
    expect(sessionFromToken(token({ sub: 'c-1', kind: 'customer', exp: Math.floor(NOW / 1000) - 10 }), NOW)).toBeNull();
    expect(sessionFromToken(token({ sub: 'c-1', kind: 'customer' }), NOW)).toBeNull();
    expect(sessionFromToken('not-a-token', NOW)).toBeNull();
    expect(sessionFromToken(null, NOW)).toBeNull();
  });
});
