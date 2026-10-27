import { ArgumentsHost, Catch } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { resolveCorrelationId } from '../common/correlation';
import { ProblemDetailsBody, ProblemDetailsException } from '../common/problem-details.exception';
import { VuelosProblemDetailsFilter } from '../common/problem-details.filter';

/** ProblemDetails of contract v2: the v1 fields plus instance, correlation_id and timestamp. */
export interface ProblemDetailsV2Body extends ProblemDetailsBody {
  instance: string;
  correlation_id: string;
  timestamp: string;
}

/**
 * Error filter of /api/v2/vuelos. It reuses everything the v1 filter does (shape, Retry-After, metrics) and then
 * applies what v2 adds: the failure's v2 status/code when the contract differs, `instance`, the correlation id (also
 * when a guard rejected the request before the interceptor ran) and a timestamp.
 */
@Catch()
export class VuelosProblemDetailsV2Filter extends VuelosProblemDetailsFilter {
  protected override adapt(body: ProblemDetailsBody, exception: unknown, host: ArgumentsHost): ProblemDetailsV2Body {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const override = exception instanceof ProblemDetailsException ? exception.v2 : undefined;
    const code = override?.code ?? body.code;
    const status = override?.status ?? body.status;

    const correlationId = (response.getHeader('X-Correlation-Id') as string | undefined) ?? resolveCorrelationId(request);
    response.setHeader('X-Correlation-Id', correlationId);
    if (!response.getHeader('X-Request-Id')) response.setHeader('X-Request-Id', randomUUID());

    return {
      ...body,
      type: `https://api.booking.local/errors/${code.toLowerCase().replace(/_/g, '-')}`,
      status,
      code,
      instance: request.originalUrl.split('?')[0],
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
    };
  }
}
