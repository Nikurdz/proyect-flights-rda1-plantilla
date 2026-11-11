import { NextFunction, Request, Response } from 'express';
import { resolveCorrelationId } from '../../common/correlation';
import { SlidingWindowLimiter } from './rate-limiter';

const DEFAULT_MAX_HITS = 300;
const DEFAULT_WINDOW_SECONDS = 60;
// Health checks come from the platform itself and must never be throttled.
const EXEMPT_PATHS = new Set(['/api/v1/health', '/api/v2/vuelos/health']);

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

/**
 * Coarse per-client ceiling over the whole API, so a bot or scraper cannot burn the database and the hosting quota.
 * The per-endpoint limiters (login, order recovery, purchases) stay stricter and still apply. In memory and per
 * process, like them. `GLOBAL_RATE_LIMIT_MAX=0` turns it off; `GLOBAL_RATE_LIMIT_WINDOW_SECONDS` sets the window.
 */
export function createGlobalRateLimit(env: NodeJS.ProcessEnv = process.env) {
  const maxHits = positiveInt(env.GLOBAL_RATE_LIMIT_MAX, DEFAULT_MAX_HITS);
  const windowSeconds = positiveInt(env.GLOBAL_RATE_LIMIT_WINDOW_SECONDS, DEFAULT_WINDOW_SECONDS) || DEFAULT_WINDOW_SECONDS;
  const limiter = new SlidingWindowLimiter(maxHits, windowSeconds * 1000);

  return (req: Request, res: Response, next: NextFunction): void => {
    if (maxHits === 0 || req.method === 'OPTIONS' || EXEMPT_PATHS.has(req.path)) return next();

    const limit = limiter.consume(req.ip ?? 'unknown');
    if (limit.allowed) return next();

    const body: Record<string, unknown> = {
      type: 'about:blank',
      title: 'Too many requests',
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      detail: `Try again in ${limit.retryAfterSeconds} seconds.`,
    };
    // Contract v2 ProblemDetails: where it happened, which process it belongs to and when.
    if (req.path.startsWith('/api/v2/')) {
      const correlationId = resolveCorrelationId(req);
      res.set('X-Correlation-Id', correlationId);
      Object.assign(body, { type: 'https://api.booking.local/errors/rate-limit-exceeded', instance: req.path, correlation_id: correlationId, timestamp: new Date().toISOString() });
    }
    res.status(429).set('Retry-After', String(limit.retryAfterSeconds)).type('application/problem+json').send(JSON.stringify(body));
  };
}
