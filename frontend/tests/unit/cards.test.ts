import { describe, it, expect } from 'vitest';
import {
  APPROVED_TEST_NUMBERS,
  TEST_NUMBERS,
  cvvLength,
  detectBrand,
  formatCardNumber,
  formatExpiry,
  passesLuhn,
  resolveGatewayChoice,
  validateCard,
  validateExpiry,
} from '../../src/lib/cards';

const NOW = new Date(2026, 9, 5); // October 2026

describe('brand detection while typing', () => {
  it('recognises the brand from the first digits', () => {
    expect(detectBrand('4')).toBe('VISA');
    expect(detectBrand('4111 1111')).toBe('VISA');
    expect(detectBrand('51')).toBe('MASTERCARD');
    expect(detectBrand('2221')).toBe('MASTERCARD');
    expect(detectBrand('2720')).toBe('MASTERCARD');
    expect(detectBrand('34')).toBe('AMEX');
    expect(detectBrand('37')).toBe('AMEX');
    expect(detectBrand('36')).toBe('DINERS');
    expect(detectBrand('3056')).toBe('DINERS');
  });

  it('flags brands that exist but are not sold, and unknown prefixes', () => {
    expect(detectBrand('6011')).toBe('UNSUPPORTED'); // Discover
    expect(detectBrand('3528')).toBe('UNSUPPORTED'); // JCB
    expect(detectBrand('9')).toBeNull();
    expect(detectBrand('')).toBeNull();
  });

  it('uses 4 digits of security code only for American Express', () => {
    expect(cvvLength('AMEX')).toBe(4);
    expect(cvvLength('VISA')).toBe(3);
    expect(cvvLength(null)).toBe(3);
  });
});

describe('number formatting', () => {
  it('groups digits as the brand prints them, live', () => {
    expect(formatCardNumber('4111')).toBe('4111');
    expect(formatCardNumber('41111')).toBe('4111 1');
    expect(formatCardNumber('4111111111111111')).toBe('4111 1111 1111 1111');
    expect(formatCardNumber('378282246310005')).toBe('3782 822463 10005');
    expect(formatCardNumber('36227206271667')).toBe('3622 720627 1667');
  });

  it('drops anything that is not a digit and caps the length', () => {
    expect(formatCardNumber('4111-1111 abcd 1111 1111 999')).toBe('4111 1111 1111 1111');
  });

  it('inserts the slash in the expiry as the person types', () => {
    expect(formatExpiry('1')).toBe('1');
    expect(formatExpiry('5')).toBe('05/');
    expect(formatExpiry('12')).toBe('12');
    expect(formatExpiry('122')).toBe('12/2');
    expect(formatExpiry('1228')).toBe('12/28');
    expect(formatExpiry('12/2899')).toBe('12/28');
  });
});

describe('validation', () => {
  it('Luhn accepts every documented test number and rejects a typo', () => {
    for (const entry of [...APPROVED_TEST_NUMBERS, ...TEST_NUMBERS]) expect(passesLuhn(entry.number)).toBe(true);
    expect(passesLuhn('4111111111111112')).toBe(false);
  });

  it('expiry must be a real month that is not in the past', () => {
    expect(validateExpiry('12/28', NOW)).toBeNull();
    expect(validateExpiry('10/26', NOW)).toBeNull(); // this month is still valid
    expect(validateExpiry('09/26', NOW)).toContain('vencida');
    expect(validateExpiry('13/28', NOW)).toContain('mes');
    expect(validateExpiry('1/2', NOW)).toContain('MM/AA');
    expect(validateExpiry('12/60', NOW)).toContain('año');
  });

  it('accepts a complete valid card and reports each wrong field', () => {
    const ok = { number: '4111 1111 1111 1111', holder: 'ANA PEREZ', expiry: '12/28', cvv: '123' };
    expect(validateCard(ok, NOW)).toEqual({});

    expect(validateCard({ ...ok, number: '' }, NOW).number).toContain('Ingresa');
    expect(validateCard({ ...ok, number: '4111 1111 1111 111' }, NOW).number).toContain('16 dígitos');
    expect(validateCard({ ...ok, number: '4111 1111 1111 1112' }, NOW).number).toContain('no es válido');
    expect(validateCard({ ...ok, number: '6011 0009 9013 9424' }, NOW).number).toContain('no está disponible');
    expect(validateCard({ ...ok, holder: 'A' }, NOW).holder).toBeDefined();
    expect(validateCard({ ...ok, expiry: '01/20' }, NOW).expiry).toContain('vencida');
    expect(validateCard({ ...ok, cvv: '12' }, NOW).cvv).toContain('3 dígitos');
    expect(validateCard({ number: '3782 822463 10005', holder: 'ANA', expiry: '12/28', cvv: '123' }, NOW).cvv).toContain('4 dígitos');
  });
});

describe('what is sent to the gateway', () => {
  it('approves any valid number with a token of its brand: never the number itself', () => {
    expect(resolveGatewayChoice('4111 1111 1111 1111')).toEqual({ token: 'tok_visa_ok', marca: 'VISA', outcome: 'approved' });
    expect(resolveGatewayChoice('5555 5555 5555 4444')).toEqual({ token: 'tok_mastercard_ok', marca: 'MASTERCARD', outcome: 'approved' });
    expect(resolveGatewayChoice('378282246310005')).toEqual({ token: 'tok_amex_ok', marca: 'AMEX', outcome: 'approved' });
    expect(resolveGatewayChoice('36227206271667')).toEqual({ token: 'tok_diners_ok', marca: 'DINERS', outcome: 'approved' });
    for (const entry of APPROVED_TEST_NUMBERS) expect(resolveGatewayChoice(entry.number)?.token).not.toContain(entry.number);
  });

  it('special numbers simulate a failure', () => {
    expect(resolveGatewayChoice('4000 0000 0000 0002')?.token).toBe('tok_declined');
    expect(resolveGatewayChoice('4000000000009995')?.token).toBe('tok_insufficient');
    expect(resolveGatewayChoice('4000000000000069')?.token).toBe('tok_expired');
    expect(resolveGatewayChoice('4100000000000019')?.token).toBe('tok_fraud');
    expect(resolveGatewayChoice('4000000000000341')?.token).toBe('tok_visa_capture_fail');
  });

  it('refuses a brand that is not sold', () => {
    expect(resolveGatewayChoice('6011000990139424')).toBeNull();
    expect(resolveGatewayChoice('')).toBeNull();
  });
});
