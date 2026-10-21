/**
 * Process-local counters for the admin observability view: requests, errors and latency per route,
 * problem codes, domain events, rate-limit hits and the last run of each background job.
 *
 * Deliberately simple: no dependency, no storage. The numbers belong to ONE process and start from
 * zero on every restart (Render/Railway restart often), so they are labelled "since start" in the UI;
 * anything that must survive a restart (orders, payments, notifications) is computed from the database.
 * It is a module singleton because some hook points (the rate limiter) are plain functions without DI.
 */
const MAX_ROUTES = 200;

interface RouteStat {
  count: number;
  clientErrors: number;
  serverErrors: number;
  totalMs: number;
  maxMs: number;
}

export interface JobStat {
  runs: number;
  failures: number;
  lastRunAt: string | null;
  lastDurationMs: number | null;
  lastResult: Record<string, number> | null;
  lastError: string | null;
}

const emptyJob = (): JobStat => ({ runs: 0, failures: 0, lastRunAt: null, lastDurationMs: null, lastResult: null, lastError: null });

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export class RuntimeMetrics {
  readonly startedAt = new Date();
  private readonly routes = new Map<string, RouteStat>();
  private readonly problemCodes = new Map<string, number>();
  private readonly events = new Map<string, number>();
  private readonly consumerFailures = new Map<string, number>();
  private readonly jobs = new Map<string, JobStat>();
  private rateLimited = 0;
  private requests = 0;

  recordRequest(method: string, route: string, status: number, durationMs: number): void {
    this.requests += 1;
    const key = `${method} ${route}`;
    let stat = this.routes.get(key);
    if (!stat) {
      // A bounded table: a flood of odd paths must not grow memory without limit.
      if (this.routes.size >= MAX_ROUTES) return;
      stat = { count: 0, clientErrors: 0, serverErrors: 0, totalMs: 0, maxMs: 0 };
      this.routes.set(key, stat);
    }
    stat.count += 1;
    stat.totalMs += durationMs;
    stat.maxMs = Math.max(stat.maxMs, durationMs);
    if (status >= 500) stat.serverErrors += 1;
    else if (status >= 400) stat.clientErrors += 1;
  }

  recordProblem(code: string): void {
    bump(this.problemCodes, code);
  }

  recordEvent(type: string): void {
    bump(this.events, type);
  }

  recordConsumerFailure(type: string): void {
    bump(this.consumerFailures, type);
  }

  recordRateLimited(): void {
    this.rateLimited += 1;
  }

  recordJob(name: string, outcome: { durationMs: number; result?: Record<string, number>; error?: string }): void {
    const job = this.jobs.get(name) ?? emptyJob();
    job.runs += 1;
    job.lastRunAt = new Date().toISOString();
    job.lastDurationMs = outcome.durationMs;
    if (outcome.error) {
      job.failures += 1;
      job.lastError = outcome.error.slice(0, 300);
    } else {
      job.lastResult = outcome.result ?? null;
      job.lastError = null;
    }
    this.jobs.set(name, job);
  }

  snapshot() {
    const toObject = (map: Map<string, number>) => Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1]));
    const routes = [...this.routes.entries()]
      .map(([route, s]) => ({ route, count: s.count, clientErrors: s.clientErrors, serverErrors: s.serverErrors, avgMs: Math.round(s.totalMs / s.count), maxMs: s.maxMs }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 25);
    const totals = [...this.routes.values()].reduce((acc, s) => ({ clientErrors: acc.clientErrors + s.clientErrors, serverErrors: acc.serverErrors + s.serverErrors }), { clientErrors: 0, serverErrors: 0 });

    return {
      startedAt: this.startedAt.toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      requests: { total: this.requests, ...totals },
      rateLimited: this.rateLimited,
      routes,
      problemCodes: toObject(this.problemCodes),
      events: toObject(this.events),
      consumerFailures: toObject(this.consumerFailures),
      jobs: Object.fromEntries(this.jobs),
    };
  }
}

export const runtimeMetrics = new RuntimeMetrics();
