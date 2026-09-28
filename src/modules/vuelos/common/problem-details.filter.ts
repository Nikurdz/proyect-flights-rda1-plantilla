import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Scoped to VuelosController only via @UseFilters() — not registered globally, since
 * that would touch main.ts/app.module.ts beyond what this module needs. Passes through
 * any HttpException whose body is already ProblemDetails-shaped (ours, or
 * IdempotencyKeyGuard's) unchanged; normalizes anything else.
 */
@Catch()
export class VuelosProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(typeof body === 'string' ? { title: body, status } : body);
      return;
    }

    const error = exception instanceof Error ? exception : new Error(String(exception));
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'VALIDATION_FAILED',
      detail: error.message,
    });
  }
}
