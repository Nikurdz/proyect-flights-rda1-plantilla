/**
 * Tells whether anybody has used the system lately. A serverless Postgres (Neon) bills compute while it is awake and only
 * sleeps after minutes without queries, so background jobs that poll the database every minute keep it awake all day and
 * exhaust a free quota in weeks. The jobs ask this gate before each tick: with nobody around (no request and no event for
 * `APP_IDLE_MS`, default 10 minutes) they skip the tick and the database can sleep; the first visit wakes them up again
 * and whatever was pending is caught up on their next tick (within a minute).
 *
 * Health probes do not count as use (see `CorrelationInterceptor`), otherwise a monitor would keep everything awake.
 */
const IDLE_MS = Math.max(60_000, Number(process.env.APP_IDLE_MS) || 10 * 60_000);

let lastUse = Date.now(); // booting counts as use: pending work gets one pass after every restart

export const activityGate = {
  /** Something real happened (a request, an event). */
  touch(): void {
    lastUse = Date.now();
  },

  /** True while the last use is within the window. */
  isActive(windowMs: number = IDLE_MS): boolean {
    return Date.now() - lastUse <= windowMs;
  },

  /** For tests. */
  reset(at: number = Date.now()): void {
    lastUse = at;
  },
};

/** A route that only checks the process is up (never the database) must not count as use. */
export const isProbePath = (path: string): boolean => /\/health(\/|$)/.test(path);
