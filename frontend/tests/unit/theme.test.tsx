// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '../../src/components/common/ThemeProvider';
import { ThemeToggle } from '../../src/components/ui/ThemeToggle';
import { THEME_STORAGE_KEY, readStoredTheme, resolveTheme } from '../../src/lib/theme';

type Listener = () => void;

/** A controllable `prefers-color-scheme` (jsdom has no matchMedia). */
function mockSystem(initialDark: boolean) {
  const state = { dark: initialDark, listeners: new Set<Listener>() };
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query.includes('dark') ? state.dark : false;
    },
    media: query,
    addEventListener: (_: string, l: Listener) => state.listeners.add(l),
    removeEventListener: (_: string, l: Listener) => state.listeners.delete(l),
  })) as unknown as typeof window.matchMedia;
  return {
    set(dark: boolean) {
      state.dark = dark;
      state.listeners.forEach((l) => l());
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});
afterEach(cleanup);

const renderToggle = () =>
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  );

describe('theme', () => {
  it('switches the dark class and marks the chosen option as pressed', () => {
    mockSystem(false);
    renderToggle();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(screen.getByRole('button', { name: 'Según el sistema' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Oscuro' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByRole('button', { name: 'Oscuro' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Claro' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists the choice in localStorage and reads it back', () => {
    mockSystem(false);
    renderToggle();
    fireEvent.click(screen.getByRole('button', { name: 'Oscuro' }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readStoredTheme()).toBe('dark');
  });

  it('ignores an invalid stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(readStoredTheme()).toBe('system');
  });

  it('follows the system preference in system mode, including later changes', () => {
    const system = mockSystem(true);
    renderToggle();
    fireEvent.click(screen.getByRole('button', { name: 'Según el sistema' }));
    expect(resolveTheme('system')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => system.set(false));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
