import { Body, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { ProblemController } from '../../common/problem-controller';
import { OrdenParamDto } from '../ordenes/dto/ordenes.dto';
import {
  AdminAccionVueloViewDto,
  AdminAsientosVueloDto,
  AdminCancelarVueloDto,
  AdminOrdenViewDto,
  AdminOrdenesPaginaDto,
  AdminOrdenesQueryDto,
  AdminReprogramarVueloDto,
  AdminVueloParamDto,
  AdminVuelosPaginaDto,
  AdminVuelosQueryDto,
} from './admin.dto';
import { AdminService } from './admin.service';

const { BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT } = HttpStatus;

/**
 * Back-office views across customers. Everything else in the API is owner-only; these routes are
 * the only ones that can read other people's orders, and they require the ADMIN role.
 */
@ProblemController('admin', 'E-commerce · Back-office')
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

  @Post('vuelos/:vueloId/cancelar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancelar un vuelo (ADMIN)',
    description:
      'La aerolínea cancela el vuelo: se cierra a la venta, cada reserva confirmada que lo tenía se cancela con reembolso total (sin penalidad, sea cual sea la tarifa) y se emiten los eventos de webhook flight.cancelled y booking.cancelled. El reembolso llega a la pasarela y a la orden por esos eventos.',
  })
  @ApiResponse({ status: 200, type: AdminAccionVueloViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  cancelarVuelo(@Param() params: AdminVueloParamDto, @Body() body: AdminCancelarVueloDto) {
    return this.admin.cancelarVuelo(params.vueloId, body.motivo);
  }

  @Post('vuelos/:vueloId/reprogramar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reprogramar un vuelo (ADMIN)',
    description:
      'La aerolínea mueve la salida (la duración se conserva): las reservas confirmadas con ese vuelo se actualizan y se emiten los eventos de webhook flight.schedule_changed y booking.changed. Responde 409 si otro vuelo con el mismo número ya sale a esa hora.',
  })
  @ApiResponse({ status: 200, type: AdminAccionVueloViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  reprogramarVuelo(@Param() params: AdminVueloParamDto, @Body() body: AdminReprogramarVueloDto) {
    return this.admin.reprogramarVuelo(params.vueloId, body);
  }

  @Get('vuelos/:vueloId/asientos')
  @ApiOperation({ summary: 'Asientos reservados de un vuelo (ADMIN)', description: 'Mapa de la cabina con la disponibilidad de cada asiento y la lista de reservados con su código de reserva y orden. No muestra nombres de pasajeros.' })
  @ApiResponse({ status: 200, type: AdminAsientosVueloDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  asientos(@Param() params: AdminVueloParamDto) {
    return this.admin.asientosDeVuelo(params.vueloId);
  }
}
