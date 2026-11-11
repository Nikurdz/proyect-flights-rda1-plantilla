import { Get, Header, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { ProblemController } from '../../common/problem-controller';
import { FlujoQueryDto, MapaQueryDto, TrazabilidadQueryDto } from './trazabilidad.dto';
import { TrazabilidadService } from './trazabilidad.service';

const { BAD_REQUEST, UNAUTHORIZED, FORBIDDEN } = HttpStatus;

/** Unified traceability (ADMIN, read only): timeline, CSV, flow between components and map. Providers are not part of it. */
@ProblemController('admin/trazabilidad', 'E-commerce · Back-office')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class TrazabilidadController {
  constructor(private readonly trazabilidad: TrazabilidadService) {}

  // The fixed paths go before the list so they are not taken for a filter.
  @Get('flujo')
  @ApiOperation({ summary: 'Flujo entre componentes de una petición o compra (ADMIN)', description: 'Nodos y flechas ordenadas por tiempo, dibujados con lo que se registró (eventos, pasos de saga, cambios administrativos y llamadas salientes). Indique correlationId o numero (orden o PNR).' })
  @ApiResponse({ status: 200, description: 'Nodos y aristas del flujo.' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN)
  flujo(@Query() query: FlujoQueryDto) {
    return this.trazabilidad.flujo(query);
  }

  @Get('mapa')
  @ApiOperation({ summary: 'Mapa general de la comunicación entre componentes (ADMIN)', description: 'Cuántas veces habló cada par de componentes en el periodo y cuántas salieron mal. Días de Ecuador.' })
  @ApiResponse({ status: 200, description: 'Nodos y enlaces agregados.' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN)
  mapa(@Query() query: MapaQueryDto) {
    return this.trazabilidad.mapa(query);
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="trazabilidad.csv"')
  @ApiOperation({ summary: 'Exportar la línea de tiempo en CSV (ADMIN)', description: 'Mismos filtros que la lista; hasta 5000 filas, las más recientes primero. Sin datos personales.' })
  @ApiProduces('text/csv')
  @ApiResponse({ status: 200, description: 'CSV UTF-8 con BOM.' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN)
  exportCsv(@Query() query: TrazabilidadQueryDto) {
    return this.trazabilidad.exportCsv(query);
  }

  @Get()
  @ApiOperation({ summary: 'Línea de tiempo unificada de la trazabilidad (ADMIN)', description: 'Eventos, sagas con sus pasos y cambios administrativos en una sola lista, de lo más reciente a lo más antiguo. Paginación por cursor (`antes` = `siguiente`).' })
  @ApiResponse({ status: 200, description: 'Página de la línea de tiempo.' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN)
  listar(@Query() query: TrazabilidadQueryDto) {
    return this.trazabilidad.listar(query);
  }
}
