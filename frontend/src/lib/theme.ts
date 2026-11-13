import { useSyncExternalStore } from 'react';

/**
 * Theme: light, dark or follow the system. The choice is stored in localStorage (key `ram-theme`);
 * the inline script of index.html applies it before the first paint, and this module keeps the
 * `dark` class of <html> in sync afterwards (including when the system preference changes).
 */
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'ram-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function readStoredTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return mode;
}

/** Sets the `dark` class and `color-scheme` of <html> (and the browser bar color). */
export function applyTheme(mode: ThemeMode): ResolvedTheme {
  const resolved = resolveTheme(mode);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;
  }
  return resolved;
}

// --- store -------------------------------------------------------------------------------------
let mode: ThemeMode = readStoredTheme();
const listeners = new Set<() => void>();
let mediaList: MediaQueryList | null = null;

const emit = () => listeners.forEach((l) => l());

function onSystemChange() {
  if (mode === 'system') {
    applyTheme(mode);
    emit();
  }
}

/** Starts following the system preference. Safe to call more than once; returns a stop function. */
export function startThemeSync(): () => void {
  mode = readStoredTheme();
  applyTheme(mode);
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mediaList = window.matchMedia(DARK_QUERY);
    mediaList.addEventListener?.('change', onSystemChange);
  }
  emit();
  return () => {
    mediaList?.removeEventListener?.('change', onSystemChange);
    mediaList = null;
  };
}

export function setThemeMode(next: ThemeMode): void {
  mode = next;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Private mode or storage blocked: the choice lasts until the page is closed.
  }
  applyTheme(next);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The resolved theme is derived from `mode` and the system query; a snapshot string keeps it stable.
const getSnapshot = () => `${mode}|${resolveTheme(mode)}`;

export interface ThemeState {
  /** What the person chose. */
  mode: ThemeMode;
  /** What is applied right now (`system` resolved). */
  resolved: ResolvedTheme;
  setMode: (next: ThemeMode) => void;
}

export function useTheme(): ThemeState {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => 'system|light');
  const [currentMode, resolved] = snapshot.split('|') as [ThemeMode, ResolvedTheme];
  return { mode: currentMode, resolved, setMode: setThemeMode };
}
