import { Get, HttpStatus, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { ProblemController } from '../../common/problem-controller';
import { SWAGGER_TAGS } from '../../common/swagger-tags';
import { OrdenParamDto } from '../ordenes/dto/ordenes.dto';
import { AdminAsientosVueloDto, AdminOrdenViewDto, AdminOrdenesPaginaDto, AdminOrdenesQueryDto, AdminVueloParamDto, AdminVuelosPaginaDto, AdminVuelosQueryDto } from './admin.dto';
import { AdminService } from './admin.service';

const { BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND } = HttpStatus;

/**
 * Back-office views across customers. Everything else in the API is owner-only; these routes are
 * the only ones that can read other people's orders, and they require the ADMIN role.
 */
@ProblemController('admin', SWAGGER_TAGS.admin)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('ordenes')
  @ApiOperation({ summary: 'Listar órdenes de todos los clientes (ADMIN)', description: 'Más recientes primero, paginado por cursor; filtros por estado, número, PNR y fechas.' })
  @ApiResponse({ status: 200, type: AdminOrdenesPaginaDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN)
  ordenes(@Query() query: AdminOrdenesQueryDto) {
    return this.admin.listarOrdenes(query);
  }

  @Get('ordenes/:numero')
  @ApiOperation({ summary: 'Detalle completo de una orden (ADMIN)', description: 'Incluye el contacto del comprador.' })
  @ApiResponse({ status: 200, type: AdminOrdenViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  orden(@Param() params: OrdenParamDto) {
    return this.admin.obtenerOrden(params.numero);
  }

  @Get('vuelos')
  @ApiOperation({ summary: 'Listar vuelos con su inventario (ADMIN)', description: 'Por salida ascendente, desde hoy si no se indica fecha; filtros por ruta, día y número de vuelo.' })
  @ApiResponse({ status: 200, type: AdminVuelosPaginaDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN)
  vuelos(@Query() query: AdminVuelosQueryDto) {
    return this.admin.listarVuelos(query);
  }

  @Get('vuelos/:vueloId/asientos')
  @ApiOperation({ summary: 'Asientos reservados de un vuelo (ADMIN)', description: 'Mapa de la cabina con la disponibilidad de cada asiento y la lista de reservados con su código de reserva y orden. No muestra nombres de pasajeros.' })
  @ApiResponse({ status: 200, type: AdminAsientosVueloDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  asientos(@Param() params: AdminVueloParamDto) {
    return this.admin.asientosDeVuelo(params.vueloId);
  }
}
