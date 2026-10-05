import { HttpStatus, applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ProblemDetailsDto } from '../dto/problem-details.dto';

const DESCRIPTIONS: Record<number, string> = {
  400: 'Petición inválida',
  401: 'No autenticado',
  403: 'Prohibido',
  404: 'No encontrado',
  409: 'Conflicto',
  410: 'Recurso expirado (Hold o Cotización)',
  422: 'Entidad no procesable',
  429: 'Demasiadas peticiones',
  501: 'No implementado',
  503: 'Servicio no disponible',
};

/** Documents the application/problem+json error responses a route can produce. */
export function ApiProblemResponses(...statuses: HttpStatus[]): MethodDecorator {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({ status, description: DESCRIPTIONS[status] ?? 'Error', type: ProblemDetailsDto }),
    ),
  );
}
