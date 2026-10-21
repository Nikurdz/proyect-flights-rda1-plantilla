import { clearLastOrder, setStoredToken } from './storage';
import { queryClient } from './queryClient';

/**
 * Ends the session and forgets everything tied to it. Cached answers are wiped so the next person
 * on this browser can never see the previous one's orders or profile.
 */
export function endSession(): void {
  setStoredToken(null);
  clearLastOrder();
  queryClient.clear();
}

/** Starts a session with a new token, starting from a clean cache for the same reason. */
export function startSession(token: string): void {
  queryClient.clear();
  clearLastOrder();
  setStoredToken(token);
}
