import { HttpStatus } from '@nestjs/common';
import { ProblemDetailsException } from '../../common/problem-details.exception';

/**
 * Small in-memory sliding-window limiter for abuse-prone public endpoints (login, order
 * recovery: RNF-19). It is per process, so it slows brute force on one instance; a shared
 * store (Redis) would be the next step for a multi-instance deployment.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly maxHits: number,
    private readonly windowMs: number,
  ) {}

  /** Records an attempt for `key`; `allowed` is false once the window is full. */
  consume(key: string, now: number = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    const recent = (this.hits.get(key) ?? []).filter((at) => now - at < this.windowMs);

    if (recent.length >= this.maxHits) {
      this.hits.set(key, recent);
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + this.windowMs - now) / 1000)) };
    }

    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.evictStale(now);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private evictStale(now: number): void {
    for (const [key, times] of this.hits) {
      if (times.every((at) => now - at >= this.windowMs)) this.hits.delete(key);
    }
  }
}

/** Consumes one hit of `limiter` for `key`; answers 429 RATE_LIMIT_EXCEEDED once the window is full. */
export function assertWithinLimit(limiter: SlidingWindowLimiter, key: string, title: string): void {
  const limit = limiter.consume(key);
  if (!limit.allowed) {
    throw new ProblemDetailsException(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMIT_EXCEEDED', title, `Try again in ${limit.retryAfterSeconds} seconds.`);
  }
}
