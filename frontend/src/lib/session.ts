import { useSyncExternalStore } from 'react';
import { getStoredToken, onTokenChange } from './storage';

export type SessionKind = 'customer' | 'guest';

export interface Session {
  kind: SessionKind;
  roles: string[];
  ownerId: string;
  isAdmin: boolean;
  expiresAt: number;
}

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Reads who the current token says we are. The browser cannot verify the signature, so this is
 * only for choosing what to show: the API re-checks every request and is the real gate.
 */
export function sessionFromToken(token: string | null, now: number = Date.now()): Session | null {
  if (!token) return null;
  const payload = decodePayload(token);
  if (!payload) return null;

  const expiresAt = typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  if (!expiresAt || expiresAt <= now) return null;

  const kind: SessionKind = payload.kind === 'customer' ? 'customer' : 'guest';
  const roles = Array.isArray(payload.roles) ? (payload.roles as string[]) : [];
  return {
    kind,
    roles,
    ownerId: String(payload.sub ?? ''),
    isAdmin: kind === 'customer' && roles.includes('ADMIN'),
    expiresAt,
  };
}

export function getSession(): Session | null {
  return sessionFromToken(getStoredToken());
}

// useSyncExternalStore needs a stable snapshot: derive it from the token string.
let lastToken: string | null | undefined;
let lastSession: Session | null = null;

function snapshot(): Session | null {
  const token = getStoredToken();
  if (token !== lastToken) {
    lastToken = token;
    lastSession = sessionFromToken(token);
  }
  return lastSession;
}

/** Reactive session: re-renders when someone signs in, signs out or the token is cleared. */
export function useSession(): Session | null {
  return useSyncExternalStore(onTokenChange, snapshot, () => null);
}
