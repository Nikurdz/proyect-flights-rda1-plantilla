// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../src/components/ui/Toast';
import { useToast } from '../../src/lib/toast';

const Trigger: React.FC<{ tone?: 'success' | 'error'; duration?: number }> = ({ tone = 'success', duration }) => {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => toast.show({ title: 'Vuelo guardado', description: 'Ya puedes verlo en Mis viajes', tone, duration })}
    >
      Disparar
    </button>
  );
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Toast', () => {
  it('shows the message inside the polite live region', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Disparar' }));
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toContain('Vuelo guardado');
    expect(region.textContent).toContain('Ya puedes verlo en Mis viajes');
  });

  it('announces errors assertively', () => {
    render(
      <ToastProvider>
        <Trigger tone="error" />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Disparar' }));
    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
    expect(alert.textContent).toContain('Vuelo guardado');
  });

  it('closes with its button', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Disparar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(screen.queryByText('Vuelo guardado')).toBeNull();
  });

  it('hides itself after its duration, and stays when duration is 0', () => {
    render(
      <ToastProvider>
        <Trigger duration={1000} />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Disparar' }));
    expect(screen.getByText('Vuelo guardado')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryByText('Vuelo guardado')).toBeNull();

    cleanup();
    render(
      <ToastProvider>
        <Trigger duration={0} />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Disparar' }));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('Vuelo guardado')).toBeTruthy();
  });
});
