// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Countdown } from '../../src/components/common/Countdown';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Countdown', () => {
  it('is calm while plenty of time is left', () => {
    render(<Countdown initialSeconds={600} />);
    const timer = screen.getByRole('timer');
    expect(timer.getAttribute('data-state')).toBe('normal');
    expect(timer.textContent).toContain('10:00');
    expect(timer.textContent).not.toContain('menos de 2 minutos');
  });

  it('warns with text, not only color, under 2 minutes', () => {
    render(<Countdown initialSeconds={119} />);
    const timer = screen.getByRole('timer');
    expect(timer.getAttribute('data-state')).toBe('urgent');
    expect(timer.textContent).toContain('Quedan menos de 2 minutos');
  });

  it('changes to the warning state when the clock crosses 2 minutes', () => {
    render(<Countdown initialSeconds={121} />);
    expect(screen.getByRole('timer').getAttribute('data-state')).toBe('warning');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('timer').getAttribute('data-state')).toBe('urgent');
  });

  it('calls onExpire when it reaches zero', () => {
    const onExpire = vi.fn();
    render(<Countdown initialSeconds={2} onExpire={onExpire} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onExpire).toHaveBeenCalled();
  });
});
