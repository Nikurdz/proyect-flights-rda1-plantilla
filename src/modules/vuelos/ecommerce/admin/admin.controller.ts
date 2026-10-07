import { Body, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentAuth, JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import type { AuthClaims } from '../../auth/token.service';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { ProblemController } from '../../common/problem-controller';
import { OrdenParamDto } from '../ordenes/dto/ordenes.dto';
import {
  AdminAccionVueloViewDto,
  AdminActualizarVueloDto,
  AdminAsientosVueloDto,
  AdminCancelarVueloDto,
  AdminCrearVueloDto,
  AdminOrdenViewDto,
  AdminOrdenesPaginaDto,
  AdminOrdenesQueryDto,
  AdminReprogramarVueloDto,
  AdminVueloParamDto,
  AdminVueloViewDto,
  AdminVuelosPaginaDto,
  AdminVuelosQueryDto,
} from './admin.dto';
import { AdminService } from './admin.service';
import { VuelosAdminService } from './vuelos-admin.service';

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
  constructor(
    private readonly admin: AdminService,
    private readonly vuelosAdmin: VuelosAdminService,
  ) {}

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

  @Post('vuelos')
  @ApiOperation({
    summary: 'Crear un vuelo (ADMIN)',
    description:
      'Agrega un vuelo al calendario: todos sus asientos quedan disponibles y aparece en la búsqueda. El código lleva la aerolínea en sus dos primeros caracteres; origen y destino deben existir en el catálogo; la salida debe ser futura. 409 si ese código ya sale a esa hora.',
  })
  @ApiResponse({ status: 201, type: AdminVueloViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, CONFLICT)
  crearVuelo(@CurrentAuth() auth: AuthClaims, @Body() body: AdminCrearVueloDto) {
    return this.vuelosAdmin.crear(auth.ownerId, body);
  }

  @Patch('vuelos/:vueloId')
  @ApiOperation({
    summary: 'Editar un vuelo (ADMIN)',
    description:
      'Cambia aerolínea, tarifa base, duración (recalcula la llegada) o capacidad. Solo vuelos programados que no han salido. La capacidad no puede bajar de los asientos ya vendidos ni dejar asientos numerados fuera de la cabina. Para mover la salida usa reprogramar.',
  })
  @ApiResponse({ status: 200, type: AdminVueloViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  actualizarVuelo(@CurrentAuth() auth: AuthClaims, @Param() params: AdminVueloParamDto, @Body() body: AdminActualizarVueloDto) {
    return this.vuelosAdmin.actualizar(auth.ownerId, params.vueloId, body);
  }

  @Delete('vuelos/:vueloId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar un vuelo (ADMIN)',
    description:
      'Borra un vuelo que nunca tuvo retenciones, reservas ni asientos asignados. Si tiene historial responde 409 FLIGHT_IN_USE: cancélalo en su lugar (cierra la venta y reembolsa las reservas).',
  })
  @ApiResponse({ status: 204, description: 'Eliminado' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  async eliminarVuelo(@CurrentAuth() auth: AuthClaims, @Param() params: AdminVueloParamDto): Promise<void> {
    await this.vuelosAdmin.eliminar(auth.ownerId, params.vueloId);
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
