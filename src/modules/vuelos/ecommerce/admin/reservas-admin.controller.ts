import { Body, Get, Headers, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentAuth, JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import type { AuthClaims } from '../../auth/token.service';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { IdempotencyKeyGuard } from '../../../../common/guards/idempotency-key.guard';
import { ProblemController } from '../../common/problem-controller';
import { CancelBookingRequestDto } from '../../dto/postventa.dto';
import { ReservaParamDto, ReservasQueryDto } from './reservas-admin.dto';
import { ReservasAdminService } from './reservas-admin.service';

const { BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT } = HttpStatus;

/**
 * Counter of the airline (ADMIN): every GDS booking of every channel, with check-in and cancellation on behalf of the
 * passenger. The only other route that reaches a booking of someone else is the cancellation of a whole flight.
 */
@ProblemController('admin/reservas', 'E-commerce · Back-office')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class ReservasAdminController {
  constructor(private readonly reservas: ReservasAdminService) {}

  @Get()
  @ApiOperation({
    summary: 'Reservas de todos los canales (ADMIN)',
    description: 'Busca por localizador, orden del socio (ORD-BKP-…), referencia de pago (PAY-BKP-…), canal o documento del pasajero (cédula o pasaporte, por índice ciego). El documento sale enmascarado.',
  })
  @ApiResponse({ status: 200, description: 'Página de reservas con canal, pago, vuelos, pasajeros (travellerId), asientos y check-in.' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN)
  list(@Query() query: ReservasQueryDto) {
    return this.reservas.list(query);
  }

  @Get(':bookingId')
  @ApiOperation({ summary: 'Detalle de una reserva (ADMIN)' })
  @ApiResponse({ status: 200, description: 'La reserva con su historial de cambios.' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  detail(@Param() params: ReservaParamDto) {
    return this.reservas.detail(params.bookingId);
  }

  @Post(':bookingId/check-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check-in de mostrador (ADMIN)', description: 'Mismas reglas y ventana que el check-in del viajero (409 fuera de ella). Booking lo ve en el feed de eventos.' })
  @ApiResponse({ status: 200, description: 'Pasajeros con check-in hecho.' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  checkIn(@CurrentAuth() auth: AuthClaims, @Param() params: ReservaParamDto) {
    return this.reservas.checkIn(auth, params.bookingId);
  }

  @Get(':bookingId/cotizacion-cancelacion')
  @ApiOperation({ summary: 'Cotización de cancelación de mostrador (ADMIN)' })
  @ApiResponse({ status: 200, description: 'Reembolso y penalidad de la reserva.' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  quote(@CurrentAuth() auth: AuthClaims, @Param() params: ReservaParamDto) {
    return this.reservas.quote(auth, params.bookingId);
  }

  @Post(':bookingId/cancelar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(IdempotencyKeyGuard)
  @ApiOperation({
    summary: 'Cancelación de mostrador (ADMIN)',
    description: 'Misma penalidad y reembolso que la cancelación del viajero; libera los asientos y publica booking.cancelled al dueño de la reserva (el feed del socio). Requiere Idempotency-Key.',
  })
  @ApiResponse({ status: 200, description: 'Resultado de la cancelación.' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  cancel(@CurrentAuth() auth: AuthClaims, @Headers('idempotency-key') idempotencyKey: string, @Param() params: ReservaParamDto, @Body() body: CancelBookingRequestDto) {
    return this.reservas.cancel(auth, idempotencyKey, params.bookingId, body);
  }
}
