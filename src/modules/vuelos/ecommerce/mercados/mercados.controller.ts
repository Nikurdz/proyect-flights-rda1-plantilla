import { Body, Get, HttpStatus, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentAuth, JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import type { AuthClaims } from '../../auth/token.service';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { ProblemController } from '../../common/problem-controller';
import { SWAGGER_TAGS } from '../../common/swagger-tags';
import { ActualizarMercadoDto, AuditoriaQueryDto, MercadoParamDto, MercadoViewDto } from './dto/mercado.dto';
import { MercadosService } from './mercados.service';

const { BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT } = HttpStatus;

@ProblemController('mercados', SWAGGER_TAGS.buscar)
export class MercadosController {
  constructor(private readonly mercados: MercadosService) {}

  @Get(':codigo')
  @ApiOperation({ summary: 'Configuración vigente del mercado (usa "ec")', description: 'RF-MKT-001/005/006/008: moneda, idiomas, productos del buscador, medios de pago y textos legales del portal.' })
  @ApiResponse({ status: 200, type: MercadoViewDto })
  @ApiProblemResponses(BAD_REQUEST, NOT_FOUND)
  obtener(@Param() params: MercadoParamDto) {
    return this.mercados.obtenerVista(params.codigo);
  }
}

@ProblemController('admin', SWAGGER_TAGS.admin)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminMercadosController {
  constructor(private readonly mercados: MercadosService) {}

  @Put('mercados/:codigo')
  @ApiOperation({ summary: 'Editar la configuración de un mercado (ADMIN)', description: 'RF-ADM-001: control optimista por versión y registro en auditoría (RF-ADM-006).' })
  @ApiResponse({ status: 200, type: MercadoViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  actualizar(@CurrentAuth() auth: AuthClaims, @Param() params: MercadoParamDto, @Body() cambios: ActualizarMercadoDto) {
    return this.mercados.actualizar(auth.ownerId, params.codigo, cambios);
  }

  @Get('auditoria')
  @ApiOperation({ summary: 'Historial de cambios de configuración (ADMIN)' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN)
  auditoria(@Query() query: AuditoriaQueryDto) {
    return this.mercados.listarAuditoria(query.entidad, query.id);
  }
}
