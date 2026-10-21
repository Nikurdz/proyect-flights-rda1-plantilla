import { getStoredToken } from '../lib/storage';
import { endSession } from '../lib/auth-actions';
import { ProblemDetailsError, type ProblemDetailsPayload } from './problem-details';

// Resolves base API URL. In Vite dev mode with proxy, default to /api/v1 to bypass CORS.
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api/v1' : 'https://proyect-flights-rda1-plantilla.onrender.com/api/v1');

export interface RequestOptions extends RequestInit {
  idempotencyKey?: string;
  skipAuth?: boolean;
}

// Global server wake-up listener subscribers
type WakeUpListener = (status: { isWakingUp: boolean; elapsedSeconds: number }) => void;
const wakeUpListeners: Set<WakeUpListener> = new Set();

export function onServerWakeUpChange(listener: WakeUpListener): () => void {
  wakeUpListeners.add(listener);
  return () => wakeUpListeners.delete(listener);
}

function notifyWakeUp(status: { isWakingUp: boolean; elapsedSeconds: number }) {
  wakeUpListeners.forEach((fn) => fn(status));
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!options.skipAuth) {
    const token = getStoredToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }

  // Wake-up monitoring timer (Render cold start detection)
  let wakeTimer: ReturnType<typeof setTimeout> | null = null;
  let intervalTimer: ReturnType<typeof setInterval> | null = null;
  let elapsed = 0;
  let isWaking = false;

  wakeTimer = setTimeout(() => {
    isWaking = true;
    elapsed = 5;
    notifyWakeUp({ isWakingUp: true, elapsedSeconds: elapsed });

    intervalTimer = setInterval(() => {
      elapsed += 1;
      notifyWakeUp({ isWakingUp: true, elapsedSeconds: elapsed });
    }, 1000);
  }, 4000);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (wakeTimer) clearTimeout(wakeTimer);
    if (intervalTimer) clearInterval(intervalTimer);
    if (isWaking) {
      notifyWakeUp({ isWakingUp: false, elapsedSeconds: 0 });
    }

    const correlationId = response.headers.get('x-correlation-id') || undefined;

    if (!response.ok) {
      let errorPayload: ProblemDetailsPayload = {};
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/problem+json') || contentType.includes('application/json')) {
        try {
          errorPayload = await response.json();
        } catch {
          errorPayload = {};
        }
      }
      // Anything else (an HTML error page from a proxy, plain text) is dropped on purpose: it is
      // not for people, and the status alone says what happened.

      errorPayload.status = response.status;

      // The token the server rejected is useless: forget it (and what it fetched) so the app can
      // fall back to a guest session or the login page instead of repeating the failure.
      if (response.status === 401 && !options.skipAuth) {
        endSession();
      }
      throw new ProblemDetailsError(errorPayload, correlationId);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (wakeTimer) clearTimeout(wakeTimer);
    if (intervalTimer) clearInterval(intervalTimer);
    if (isWaking) {
      notifyWakeUp({ isWakingUp: false, elapsedSeconds: 0 });
    }

    if (error instanceof ProblemDetailsError) {
      throw error;
    }

    // Network error or fetch failed
    throw new ProblemDetailsError({ status: 503, code: 'SERVICE_UNAVAILABLE' });
  }
}
