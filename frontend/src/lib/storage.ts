const TOKEN_KEY = 'vuelos_access_token';
const ORDER_KEY = 'vuelos_last_order';

let inMemoryToken: string | null = null;

type TokenListener = () => void;
const tokenListeners = new Set<TokenListener>();

/** Notifies subscribers (the session hook) whenever the token is set or cleared. */
export function onTokenChange(listener: TokenListener): () => void {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

export function getStoredToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    inMemoryToken = token;
    return token;
  } catch {
    return inMemoryToken;
  }
}

export function setStoredToken(token: string | null): void {
  inMemoryToken = token;
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // sessionStorage unavailable: the in-memory copy is enough for this tab
  }
  tokenListeners.forEach((listener) => listener());
}

/**
 * The last order the visitor saw (a purchase or a recovered trip), kept for this tab only so a
 * refresh or a print of the confirmation still works for a guest, who has no order history.
 */
export function saveLastOrder(order: unknown): void {
  try {
    sessionStorage.setItem(ORDER_KEY, JSON.stringify(order));
  } catch {
    // ignore: the page falls back to asking the API
  }
}

export function loadLastOrder<T extends { numeroOrden?: string }>(numeroOrden: string): T | null {
  try {
    const raw = sessionStorage.getItem(ORDER_KEY);
    if (!raw) return null;
    const order = JSON.parse(raw) as T;
    return order?.numeroOrden === numeroOrden ? order : null;
  } catch {
    return null;
  }
}

export function clearLastOrder(): void {
  try {
    sessionStorage.removeItem(ORDER_KEY);
  } catch {
    // ignore
  }
}

/** The last order kept for this tab, whichever it is (used to offer adding it to a new account). */
export function peekLastOrder<T>(): T | null {
  try {
    const raw = sessionStorage.getItem(ORDER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
