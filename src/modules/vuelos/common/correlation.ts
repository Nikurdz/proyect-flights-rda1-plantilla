import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { runtimeMetrics } from './runtime-metrics';

const storage = new AsyncLocalStorage<{ correlationId: string }>();

export const CORRELATION_HEADER = 'x-correlation-id';

export function currentCorrelationId(): string {
  return storage.getStore()?.correlationId ?? 'no-correlation';
}

export function runWithCorrelation<T>(correlationId: string, fn: () => T): T {
  return storage.run({ correlationId }, fn);
}

const SAFE_ID = /^[A-Za-z0-9._-]{8,100}$/;

/** The route pattern (`/api/v1/ofertas/:id`), never the raw path, so ids do not create one entry each. */
function routeLabel(request: Request): string {
  const pattern = (request.route as { path?: string } | undefined)?.path;
  return pattern ? `${request.baseUrl ?? ''}${pattern}` : 'unmatched';
}

/**
 * RNF-30: every request carries a correlation id end to end. A well-formed inbound
 * X-Correlation-Id is honoured (so callers can trace across services); anything else is
 * replaced, which also stops a client from injecting arbitrary text into our logs.
 */
@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Http');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const inbound = request.headers[CORRELATION_HEADER];
    const correlationId = typeof inbound === 'string' && SAFE_ID.test(inbound) ? inbound : randomUUID();
    response.setHeader('X-Correlation-Id', correlationId);

    const startedAt = Date.now();
    return new Observable((subscriber) => {
      runWithCorrelation(correlationId, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (error: unknown) => {
            const status = error instanceof HttpException ? error.getStatus() : 500;
            runtimeMetrics.recordRequest(request.method, routeLabel(request), status, Date.now() - startedAt);
            this.logger.warn(`${request.method} ${request.path} failed in ${Date.now() - startedAt}ms [${correlationId}]`);
            subscriber.error(error);
          },
          complete: () => {
            runtimeMetrics.recordRequest(request.method, routeLabel(request), response.statusCode, Date.now() - startedAt);
            this.logger.log(`${request.method} ${request.path} ${response.statusCode} ${Date.now() - startedAt}ms [${correlationId}]`);
            subscriber.complete();
          },
        });
      });
    });
  }
}
