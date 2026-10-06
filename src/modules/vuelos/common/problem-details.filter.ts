import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { runtimeMetrics } from './runtime-metrics';
import {
  InvalidParam,
  isProblemDetailsBody,
  ProblemDetailsBody,
  ProblemDetailsCode,
} from './problem-details.exception';

const STATUS_CODES: Record<number, { code: ProblemDetailsCode; title: string }> = {
  400: { code: 'VALIDATION_FAILED', title: 'Bad Request' },
  401: { code: 'UNAUTHORIZED', title: 'Unauthorized' },
  403: { code: 'FORBIDDEN', title: 'Forbidden' },
  404: { code: 'NOT_FOUND', title: 'Not Found' },
  409: { code: 'CONFLICT', title: 'Conflict' },
  410: { code: 'QUOTE_EXPIRED', title: 'Gone' },
  422: { code: 'VALIDATION_FAILED', title: 'Unprocessable Entity' },
  423: { code: 'ACCOUNT_LOCKED', title: 'Locked' },
  429: { code: 'RATE_LIMIT_EXCEEDED', title: 'Too Many Requests' },
  501: { code: 'NOT_IMPLEMENTED', title: 'Not Implemented' },
  503: { code: 'SERVICE_UNAVAILABLE', title: 'Service Unavailable' },
};

/** class-validator messages start with the property path: "itineraries.0.origin must match ...". */
function toInvalidParams(messages: string[]): InvalidParam[] {
  return messages.map((message) => {
    const separator = message.indexOf(' ');
    return separator === -1
      ? { name: 'body', reason: message }
      : { name: message.slice(0, separator), reason: message.slice(separator + 1) };
  });
}

function normalize(exception: HttpException): ProblemDetailsBody {
  const status = exception.getStatus();
  const known = STATUS_CODES[status] ?? {
    code: (status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_FAILED') as ProblemDetailsCode,
    title: 'Error',
  };
  const response = exception.getResponse();
  const rawMessage = typeof response === 'string' ? response : (response as { message?: string | string[] }).message;

  const body: ProblemDetailsBody = {
    type: `https://api.booking-hub.com/errors/${known.code.toLowerCase().replace(/_/g, '-')}`,
    title: known.title,
    status,
    code: known.code,
  };
  if (Array.isArray(rawMessage)) {
    body.detail = 'The request failed validation.';
    body.invalidParams = toInvalidParams(rawMessage);
  } else if (rawMessage) {
    body.detail = rawMessage;
  }
  return body;
}

/**
 * Scoped to controllers via @UseFilters() — never registered globally, since that would
 * reach into main.ts/app.module.ts and change behaviour for the other domains. Everything
 * leaves as application/problem+json; unexpected errors are logged in full but never echo
 * their message to the client.
 */
@Catch()
export class VuelosProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ProblemDetails');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    let body: ProblemDetailsBody;
    if (exception instanceof HttpException) {
      const original = exception.getResponse();
      body = isProblemDetailsBody(original) ? original : normalize(exception);
    } else {
      this.logger.error(
        exception instanceof Error ? exception.stack ?? exception.message : String(exception),
      );
      body = {
        type: 'https://api.booking-hub.com/errors/internal-error',
        title: 'Internal Server Error',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        detail: 'An unexpected error occurred. Quote the correlation id when contacting support.',
      };
    }

    runtimeMetrics.recordProblem(body.code);
    response.status(body.status).type('application/problem+json').json(body);
  }
}
