import { describe, it, expect } from 'vitest';
import { generateUUID } from '../../src/lib/uuid';

describe('checkout and test cards unit tests', () => {
  it('generates valid RFC 4122 v4 UUIDs for idempotency keys', () => {
    const uuid1 = generateUUID();
    const uuid2 = generateUUID();

    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(uuid1).toMatch(uuidV4Regex);
    expect(uuid2).toMatch(uuidV4Regex);
    expect(uuid1).not.toBe(uuid2);
  });

  it('validates test token naming conventions required by the backend', () => {
    const approvedTokens = [
      { token: 'tok_visa_ok', brand: 'VISA' },
      { token: 'tok_mastercard_ok', brand: 'MASTERCARD' },
      { token: 'tok_amex_ok', brand: 'AMEX' },
      { token: 'tok_diners_ok', brand: 'DINERS' },
    ];

    approvedTokens.forEach(({ token, brand }) => {
      expect(token).toMatch(/^tok_[a-z]+_ok$/);
      expect(token).toContain(brand.toLowerCase());
    });

    const errorTokens = [
      'tok_declined',
      'tok_insufficient',
      'tok_expired',
      'tok_3ds',
      'tok_fraud',
      'tok_review',
      'tok_visa_capture_fail',
    ];

    errorTokens.forEach((t) => {
      expect(t.startsWith('tok_')).toBe(true);
    });
  });
});
