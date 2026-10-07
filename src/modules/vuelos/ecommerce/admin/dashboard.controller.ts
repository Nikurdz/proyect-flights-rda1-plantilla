import { Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiResponse } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { ProblemController } from '../../common/problem-controller';
import { SWAGGER_TAGS } from '../../common/swagger-tags';
import { DashboardService, VentanaDashboard } from './dashboard.service';

const { BAD_REQUEST, UNAUTHORIZED, FORBIDDEN } = HttpStatus;

export class DashboardQueryDto {
  @ApiPropertyOptional({ enum: [7, 30, 90], default: 30, description: 'Días hacia atrás, contando hoy (UTC).' })
  @Type(() => Number)
  @IsInt()
  @IsIn([7, 30, 90])
  @IsOptional()
  dias?: VentanaDashboard;
}

/** Management dashboard of the ADMIN: sales, conversion, routes, occupancy and after-sale activity, ready to chart. */
@ProblemController('admin/dashboard', SWAGGER_TAGS.admin)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Dashboard de gestión: ventas, conversión, rutas y ocupación (ADMIN)',
    description:
      'Indicadores (ingresos, órdenes, ticket promedio, conversión, cancelación, reembolsos, ocupación futura), una serie diaria para graficar, el embudo oferta→pago→emisión, el reparto por estado, las rutas con más reservas, la ocupación por ruta y la actividad de posventa y webhooks. ' +
      'Todo son agregados calculados desde la base de datos (sin datos personales); se guarda en caché unos segundos.',
  })
  @ApiResponse({ status: 200, description: 'Cifras agregadas para el panel.' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN)
  resumen(@Query() query: DashboardQueryDto) {
    return this.dashboard.resumen(query.dias ?? 30);
  }
}
