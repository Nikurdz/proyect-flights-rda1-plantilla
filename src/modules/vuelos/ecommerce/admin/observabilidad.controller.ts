import { Get, HttpStatus, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiResponse } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { ProblemController } from '../../common/problem-controller';
import { SWAGGER_TAGS } from '../../common/swagger-tags';
import { ObservabilidadService, VentanaObservabilidad } from './observabilidad.service';

const { BAD_REQUEST, UNAUTHORIZED, FORBIDDEN } = HttpStatus;

export class ObservabilidadQueryDto {
  @ApiPropertyOptional({ enum: ['24h', '7d'], default: '24h', description: 'Ventana de tiempo de las cifras.' })
  @IsIn(['24h', '7d'])
  @IsOptional()
  ventana?: VentanaObservabilidad;
}

/** Operational view for the ADMIN: how the platform is behaving, with no personal data. */
@ProblemController('admin/observabilidad', SWAGGER_TAGS.admin)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class ObservabilidadController {
  constructor(private readonly observabilidad: ObservabilidadService) {}

  @Get('resumen')
  @ApiOperation({
    summary: 'Resumen operativo calculado desde la base de datos (ADMIN)',
    description:
      'Órdenes por estado, ingresos por moneda, pagos y tasas (rechazo, antifraude, compensación), pendientes de reconciliación, notificaciones, reservas temporales, ocupación del inventario y últimos cambios auditados. ' +
      'Se calcula sobre la ventana pedida (24h o 7d) y se guarda en caché unos segundos; sobrevive a los reinicios porque sale de la base.',
  })
  @ApiResponse({ status: 200, description: 'Cifras agregadas, sin datos personales.' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN)
  resumen(@Query() query: ObservabilidadQueryDto) {
    return this.observabilidad.resumen(query.ventana ?? '24h');
  }

  @Get('runtime')
  @ApiOperation({
    summary: 'Métricas en vivo del proceso (ADMIN)',
    description:
      'Peticiones, errores y latencia por ruta, códigos de error, eventos de dominio, límites de tasa y la última ejecución del reconciliador y del barredor de reservas. ' +
      'Son contadores en memoria de ESTE proceso: parten de cero en cada reinicio.',
  })
  @ApiResponse({ status: 200, description: 'Contadores desde el arranque del proceso.' })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN)
  runtime() {
    return this.observabilidad.runtime();
  }
}

/** Public liveness + database check, for the host's health check and uptime pings. */
@ProblemController('health', SWAGGER_TAGS.sistema)
export class HealthController {
  constructor(private readonly observabilidad: ObservabilidadService) {}

  @Get()
  @ApiOperation({ summary: 'Estado del servicio', description: '200 si la API alcanza su base de datos; 503 si no.' })
  @ApiResponse({ status: 200, description: 'UP' })
  @ApiResponse({ status: 503, description: 'DOWN' })
  async salud(@Res({ passthrough: true }) response: Response) {
    const salud = await this.observabilidad.salud();
    if (salud.status === 'DOWN') response.status(HttpStatus.SERVICE_UNAVAILABLE);
    return salud;
  }
}
