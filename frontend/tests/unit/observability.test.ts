import { describe, expect, it } from 'vitest';
import { barPercent, formatRate, formatUptime, pendingTone, rateTone } from '../../src/lib/observability';

describe('formatRate', () => {
  it('shows a percentage, or a dash when there is nothing to divide by', () => {
    expect(formatRate(0.0123)).toMatch(/^1,2\s?%$/);
    expect(formatRate(0)).toMatch(/^0\s?%$/);
    expect(formatRate(null)).toBe('—');
  });
});

describe('tones', () => {
  it('colours rates where lower is better and keeps "no data" neutral', () => {
    expect(rateTone(0.01, 0.05, 0.15)).toBe('success');
    expect(rateTone(0.08, 0.05, 0.15)).toBe('warning');
    expect(rateTone(0.2, 0.05, 0.15)).toBe('danger');
    expect(rateTone(null, 0.05, 0.15)).toBe('secondary');
  });

  it('treats an empty backlog as healthy', () => {
    expect(pendingTone(0)).toBe('success');
    expect(pendingTone(3)).toBe('warning');
    expect(pendingTone(25)).toBe('danger');
  });
});

describe('formatUptime', () => {
  it('shows the two largest units', () => {
    expect(formatUptime(42)).toBe('42 s');
    expect(formatUptime(3725)).toBe('1 h 2 min');
    expect(formatUptime(90_000)).toBe('1 d 1 h');
  });
});

describe('barPercent', () => {
  it('scales to the largest value and keeps tiny non-zero values visible', () => {
    expect(barPercent(50, 100)).toBe(50);
    expect(barPercent(0, 100)).toBe(0);
    expect(barPercent(1, 1000)).toBe(3);
    expect(barPercent(5, 0)).toBe(0);
  });
});
