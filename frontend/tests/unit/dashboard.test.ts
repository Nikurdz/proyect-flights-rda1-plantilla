import { describe, expect, it } from 'vitest';
import { centsToUsd, compactUsd, isEmptyWindow, isFull, niceMax, orderSlices, sharePct, shortDay, toSlices } from '../../src/lib/dashboard';
import { formatRate } from '../../src/lib/observability';

describe('dashboard helpers', () => {
  it('formats cents as USD and invalid as dash', () => {
    expect(centsToUsd(123456)).toBe('$1,234.56');
    expect(centsToUsd(0)).toBe('$0.00');
    expect(centsToUsd(null)).toBe('—');
  });
  it('shows null rates as dash', () => {
    expect(formatRate(null)).toBe('—');
    expect(formatRate(0.5)).toContain('50');
  });
  it('compacts axis values', () => {
    expect(compactUsd(50000)).toBe('$500');
    expect(compactUsd(150000)).toBe('$1.5 k');
  });
  it('shortens dates and computes nice maxima', () => {
    expect(shortDay('2026-10-07')).toBe('07/10');
    expect(niceMax(0)).toBe(1);
    expect(niceMax(37)).toBe(50);
    expect(niceMax(120)).toBe(200);
  });
  it('flags occupancy at 90 % or more', () => {
    expect(isFull(0.9)).toBe(true);
    expect(isFull(0.89)).toBe(false);
  });
  it('builds sorted slices without zeros', () => {
    const s = toSlices({ A: 1, B: 5, C: 0 }, (k) => k.toLowerCase());
    expect(s.map((x) => x.key)).toEqual(['B', 'A']);
    expect(orderSlices({ EMITIDA: 2 })[0].label).toBe('Confirmada');
  });
  it('computes shares and empty windows', () => {
    expect(sharePct(1, 0)).toBe('0 %');
    expect(sharePct(1, 4)).toContain('25');
    expect(isEmptyWindow({ kpis: { ordenesEmitidas: 0 }, serie: [{ ordenes: 0, ofertas: 0 }] })).toBe(true);
    expect(isEmptyWindow({ kpis: { ordenesEmitidas: 1 }, serie: [] })).toBe(false);
  });
});
