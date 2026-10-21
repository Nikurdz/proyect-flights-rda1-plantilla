import { describe, it, expect } from 'vitest';
import { formatMoney } from '../../src/lib/money';

describe('formatMoney (USD only)', () => {
  it('formats dollars with a $ sign, thousands separators and exactly two decimals', () => {
    expect(formatMoney('1234.5')).toBe('$1,234.50');
    expect(formatMoney(120, 'USD')).toBe('$120.00');
    expect(formatMoney('0')).toBe('$0.00');
  });

  it('accepts amounts as the API sends them (strings with the decimals applied)', () => {
    expect(formatMoney('1465.00', 'USD')).toBe('$1,465.00');
    expect(formatMoney('99.9')).toBe('$99.90');
  });

  it('shows a dash when there is no amount', () => {
    expect(formatMoney(null)).toBe('-');
    expect(formatMoney(undefined)).toBe('-');
    expect(formatMoney('abc')).toBe('-');
  });
});
