import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { activityGate, isProbePath } from './activity-gate';
import { runtimeMetrics } from './runtime-metrics';

/** Who is acting: the verified account of the request. Jobs and consumers have none (the trail calls them SYSTEM). */
export type ActorKind = 'CUSTOMER' | 'GUEST' | 'PARTNER' | 'ADMIN' | 'SYSTEM';
export interface Actor {
  id: string;
  tipo: ActorKind;
}

/** Where the request came from (never stored with personal data: the address and a short user agent). */
export interface RequestOrigin {
  ip: string | null;
  userAgent: string | null;
}

interface CallContext {
  correlationId: string;
  idempotentReplay?: boolean;
  actor?: Actor;
  origin?: RequestOrigin;
}

const storage = new AsyncLocalStorage<CallContext>();

export const CORRELATION_HEADER = 'x-correlation-id';

export interface HttpRequestRecord {
  metodo: string;
  ruta: string;
  estado: number;
  duracionMs: number;
  correlationId: string;
}

// Where the finished requests go (the bounded request log); none until the observability module registers one.
let httpRequestSink: ((record: HttpRequestRecord) => void) | null = null;

export function setHttpRequestSink(sink: ((record: HttpRequestRecord) => void) | null): void {
  httpRequestSink = sink;
}

export function currentCorrelationId(): string {
  return storage.getStore()?.correlationId ?? 'no-correlation';
}

/** Called when a request was answered from a stored idempotent response (v2 reports it with Idempotent-Replayed and 200). */
export function markIdempotentReplay(): void {
  const store = storage.getStore();
  if (store) store.idempotentReplay = true;
}

export function wasIdempotentReplay(): boolean {
  return storage.getStore()?.idempotentReplay === true;
}

export function runWithCorrelation<T>(correlationId: string, fn: () => T, context: Omit<CallContext, 'correlationId'> = {}): T {
  return storage.run({ ...context, correlationId }, fn);
}

/** The actor and origin of the current request, when there is one. */
export function currentActor(): Actor | null {
  return storage.getStore()?.actor ?? null;
}

export function currentOrigin(): RequestOrigin | null {
  return storage.getStore()?.origin ?? null;
}

/** Kind of actor of verified claims: a partner service token, an administrator, a guest or a customer. */
export function actorOf(claims: { ownerId: string; kind?: string; roles?: string[] } | undefined | null): Actor | undefined {
  if (!claims?.ownerId) return undefined;
  const tipo: ActorKind = claims.kind === 'service' || claims.ownerId.startsWith('partner:') ? 'PARTNER' : claims.roles?.includes('ADMIN') ? 'ADMIN' : claims.ownerId.startsWith('guest:') ? 'GUEST' : 'CUSTOMER';
  return { id: claims.ownerId.slice(0, 100), tipo };
}

const SAFE_ID = /^[A-Za-z0-9._-]{8,100}$/;

/** The id a request carries: a well-formed inbound X-Correlation-Id, else a new UUID. */
export function resolveCorrelationId(request: Request): string {
  const inbound = request.headers[CORRELATION_HEADER];
  return typeof inbound === 'string' && SAFE_ID.test(inbound) ? inbound : randomUUID();
}

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

    const correlationId = resolveCorrelationId(request);
    response.setHeader('X-Correlation-Id', correlationId);

    // A real request counts as use of the system (the background jobs only run while somebody is around); a health probe does not.
    if (!isProbePath(request.path)) activityGate.touch();

    const startedAt = Date.now();
    return new Observable((subscriber) => {
      // The guards ran before this interceptor, so the verified claims are on the request already.
      const actor = actorOf((request as Request & { auth?: { ownerId: string; kind?: string; roles?: string[] } }).auth);
      const origin: RequestOrigin = { ip: request.ip?.slice(0, 64) ?? null, userAgent: request.headers['user-agent']?.toString().slice(0, 200) ?? null };
      runWithCorrelation(correlationId, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (error: unknown) => {
            const status = error instanceof HttpException ? error.getStatus() : 500;
            runtimeMetrics.recordRequest(request.method, routeLabel(request), status, Date.now() - startedAt);
            httpRequestSink?.({ metodo: request.method, ruta: routeLabel(request), estado: status, duracionMs: Date.now() - startedAt, correlationId });
            this.logger.warn(`${request.method} ${request.path} failed in ${Date.now() - startedAt}ms [${correlationId}]`);
            subscriber.error(error);
          },
          complete: () => {
            runtimeMetrics.recordRequest(request.method, routeLabel(request), response.statusCode, Date.now() - startedAt);
            httpRequestSink?.({ metodo: request.method, ruta: routeLabel(request), estado: response.statusCode, duracionMs: Date.now() - startedAt, correlationId });
            this.logger.log(`${request.method} ${request.path} ${response.statusCode} ${Date.now() - startedAt}ms [${correlationId}]`);
            subscriber.complete();
          },
        });
      }, { actor, origin });
    });
  }
}
