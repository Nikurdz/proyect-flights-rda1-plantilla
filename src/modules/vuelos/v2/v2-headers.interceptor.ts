import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { wasIdempotentReplay } from '../common/correlation';

/**
 * Contract v2 headers on every answer: X-Request-Id (one HTTP call). A request answered from a stored idempotent
 * response carries `Idempotent-Replayed: true` and a creating POST (hold, booking) answers 200 instead of 201/202.
 */
@Injectable()
export class V2HeadersInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const inbound = request.headers['x-request-id'];
    response.setHeader('X-Request-Id', typeof inbound === 'string' && /^[A-Za-z0-9._-]{8,100}$/.test(inbound) ? inbound : randomUUID());
    return next.handle().pipe(
      tap(() => {
        if (!wasIdempotentReplay()) return;
        response.setHeader('Idempotent-Replayed', 'true');
        if (response.statusCode === 201 || response.statusCode === 202) response.status(200);
      }),
    );
  }
}
