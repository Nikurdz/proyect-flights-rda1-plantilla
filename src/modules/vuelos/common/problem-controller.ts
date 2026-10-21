import { Controller, UseFilters, UseInterceptors, applyDecorators } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CorrelationInterceptor } from './correlation';
import { VuelosProblemDetailsFilter } from './problem-details.filter';

/**
 * A controller with this module's cross-cutting behaviour attached: errors leave as
 * application/problem+json, every request carries a correlation id, and the routes are
 * grouped under one Swagger tag. Scoped per controller, never global (main.ts is shared).
 */
export function ProblemController(path: string, tag: string): ClassDecorator {
  return applyDecorators(
    Controller(path),
    ApiTags(tag),
    UseFilters(VuelosProblemDetailsFilter),
    UseInterceptors(CorrelationInterceptor),
  );
}
