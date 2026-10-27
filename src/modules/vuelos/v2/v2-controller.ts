import { applyDecorators, Controller, UseFilters, UseInterceptors } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { CorrelationInterceptor } from '../common/correlation';
import { VuelosProblemDetailsV2Filter } from './problem-details-v2.filter';
import { V2HeadersInterceptor } from './v2-headers.interceptor';

/** A controller of contract v2: served at /api/v2/vuelos/<path>, errors as ProblemDetails v2, X-Request-Id on every answer. */
export function V2Controller(path: string, _tag?: string): ClassDecorator {
  return applyDecorators(
    Controller({ path: path ? `vuelos/${path}` : 'vuelos', version: '2' }),
    // The v2 contract has its own document (/api/docs-v2); the generated v1+e-commerce one does not list it.
    ApiExcludeController(),
    UseFilters(VuelosProblemDetailsV2Filter),
    UseInterceptors(CorrelationInterceptor, V2HeadersInterceptor),
  );
}
