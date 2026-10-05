import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IdempotencyKeyGuard } from '../../common/guards/idempotency-key.guard';
import { CurrentAuth, JwtAuthGuard } from './auth/jwt-auth.guard';
import type { AuthClaims } from './auth/token.service';
import { ApiProblemResponses } from './common/api-problem-responses';
import { CorrelationInterceptor } from './common/correlation';
import { ProblemDetailsException } from './common/problem-details.exception';
import { VuelosProblemDetailsFilter } from './common/problem-details.filter';
import {
  BookingDetailResponseDto,
  BookingListResponseDto,
  BookingRequestDto,
  ListBookingsQueryDto,
  SeatmapQueryDto,
  TicketResponseDto,
} from './dto/booking.dto';
import { FlightStatusParamDto, FlightStatusQueryDto } from './dto/flight-status.dto';
import { HoldRequestDto, HoldResponseDto, HoldStatusResponseDto } from './dto/hold.dto';
import { AddBaggageRequestDto, CancelBookingRequestDto, DateChangeRequestDto, DateChangeSearchRequestDto } from './dto/postventa.dto';
import { SearchRequestDto, SearchResponseDto } from './dto/search.dto';
import { WebhookSubscriptionDto } from './dto/webhooks.dto';
import { BookingsService } from './services/bookings.service';
import { FlightStatusService } from './services/flight-status.service';
import { OffersService } from './services/offers.service';
import { SearchService } from './services/search.service';

// Statuses used across the routes below.
const { BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, GONE, UNPROCESSABLE_ENTITY, NOT_IMPLEMENTED, SERVICE_UNAVAILABLE } = HttpStatus;

/**
 * Honest placeholder for operations that exist in the contract but have no implementation
 * yet. A 501 can never be mistaken for a success, unlike the empty 200 it replaces.
 */
function notImplemented(feature: string): never {
  throw new ProblemDetailsException(
    NOT_IMPLEMENTED,
    'NOT_IMPLEMENTED',
    'Not implemented',
    `${feature} is part of the contract but is not implemented in this phase.`,
  );
}

@Controller()
@UseFilters(VuelosProblemDetailsFilter)
@UseInterceptors(CorrelationInterceptor)
export class VuelosController {
  constructor(
    private readonly searchService: SearchService,
    private readonly offersService: OffersService,
    private readonly bookingsService: BookingsService,
    private readonly flightStatusService: FlightStatusService,
  ) {}

  // --- Búsqueda y Catálogo (público) ---
  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiTags('Búsqueda y Catálogo')
  @ApiOperation({
    summary: 'Búsqueda de vuelos (Multidestino)',
    description: 'Vuelos directos. Se devuelven como máximo OFFER_MAX_COMBINATIONS ofertas (por defecto 5), las más baratas primero.',
  })
  @ApiHeader({ name: 'X-Device-Fingerprint', required: true })
  @ApiResponse({ status: 200, description: 'Ofertas de vuelos encontradas', type: SearchResponseDto })
  @ApiProblemResponses(BAD_REQUEST, UNPROCESSABLE_ENTITY, SERVICE_UNAVAILABLE)
  search(@Headers('x-device-fingerprint') deviceFingerprint: string | undefined, @Body() searchRequestDto: SearchRequestDto) {
    if (!deviceFingerprint || deviceFingerprint.trim() === '') {
      throw new ProblemDetailsException(BAD_REQUEST, 'VALIDATION_FAILED', 'X-Device-Fingerprint header is required', 'Send a non-empty X-Device-Fingerprint header.', [
        { name: 'X-Device-Fingerprint', reason: 'required header is missing or empty' },
      ]);
    }
    return this.searchService.search(searchRequestDto);
  }

  @Get('offers/:offerId/seatmap')
  @ApiTags('Búsqueda y Catálogo')
  @ApiOperation({ summary: 'Obtener mapa de asientos por segmento' })
  @ApiParam({ name: 'offerId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Mapa de asientos' })
  @ApiProblemResponses(BAD_REQUEST, NOT_FOUND, GONE)
  getSeatmap(@Param('offerId', ParseUUIDPipe) offerId: string, @Query() query: SeatmapQueryDto) {
    return this.offersService.getSeatmap(offerId, query.segmentId);
  }

  // --- Bloqueo de Cupos (Hold) ---
  @Post('offers/hold')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, IdempotencyKeyGuard)
  @ApiTags('Bloqueo de Cupos (Hold)')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bloquear inventario', description: 'Scope de referencia: flights:hold. Descuenta los asientos del inventario hasta que el hold expire, se libere o se consuma.' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiResponse({ status: 201, description: 'Inventario retenido. Devuelve precio congelado.', type: HoldResponseDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, NOT_FOUND, CONFLICT, GONE, UNPROCESSABLE_ENTITY)
  holdOffer(
    @CurrentAuth() auth: AuthClaims,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() holdRequestDto: HoldRequestDto,
  ) {
    return this.offersService.createHold(auth, idempotencyKey, holdRequestDto);
  }

  @Get('offers/hold/:holdId')
  @UseGuards(JwtAuthGuard)
  @ApiTags('Bloqueo de Cupos (Hold)')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar estado de un hold', description: 'Scope de referencia: flights:read.' })
  @ApiParam({ name: 'holdId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Estado del hold', type: HoldStatusResponseDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  getHoldStatus(@CurrentAuth() auth: AuthClaims, @Param('holdId', ParseUUIDPipe) holdId: string) {
    return this.offersService.getHoldStatus(auth.ownerId, holdId);
  }

  @Delete('offers/hold/:holdId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiTags('Bloqueo de Cupos (Hold)')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Liberar hold anticipadamente', description: 'Scope de referencia: flights:hold. Idempotente; devuelve los asientos al inventario.' })
  @ApiParam({ name: 'holdId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Liberado exitosamente' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, GONE)
  releaseHold(@CurrentAuth() auth: AuthClaims, @Param('holdId', ParseUUIDPipe) holdId: string) {
    return this.offersService.releaseHold(auth.ownerId, holdId);
  }

  // --- Reservas y Emisión ---
  @Get('bookings')
  @UseGuards(JwtAuthGuard)
  @ApiTags('Reservas y Emisión')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar reservas del usuario actual (Paginado)', description: 'Scope de referencia: flights:read. Paginación por cursor (limit máx. 50).' })
  @ApiResponse({ status: 200, description: 'Lista resumida', type: BookingListResponseDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED)
  listBookings(@CurrentAuth() auth: AuthClaims, @Query() query: ListBookingsQueryDto) {
    return this.bookingsService.listBookings(auth.ownerId, query);
  }

  @Post('bookings')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, IdempotencyKeyGuard)
  @ApiTags('Reservas y Emisión')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear reserva y gestionar emisión de ticket', description: 'Scope de referencia: flights:book. Atómico: reserva, pasajeros, asientos y tickets se confirman juntos o no se confirma nada.' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiResponse({ status: 201, description: 'Reserva creada y ticket emitido correctamente.', type: BookingDetailResponseDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, GONE, UNPROCESSABLE_ENTITY)
  createBooking(
    @CurrentAuth() auth: AuthClaims,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() bookingRequestDto: BookingRequestDto,
  ) {
    return this.bookingsService.createBooking(auth, idempotencyKey, bookingRequestDto);
  }

  @Get('bookings/:bookingId')
  @UseGuards(JwtAuthGuard)
  @ApiTags('Reservas y Emisión')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detalle completo de reserva', description: 'Scope de referencia: flights:read.' })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Detalle de reserva', type: BookingDetailResponseDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  getBookingDetail(@CurrentAuth() auth: AuthClaims, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.bookingsService.getBookingDetail(auth.ownerId, bookingId);
  }

  @Get('bookings/:bookingId/tickets')
  @UseGuards(JwtAuthGuard)
  @ApiTags('Reservas y Emisión')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar tickets de una reserva', description: 'Scope de referencia: flights:read.' })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Tickets asociados a la reserva', type: [TicketResponseDto] })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  getBookingTickets(@CurrentAuth() auth: AuthClaims, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.bookingsService.getBookingTickets(auth.ownerId, bookingId);
  }

  @Get('bookings/:bookingId/tickets/:ticketId')
  @UseGuards(JwtAuthGuard)
  @ApiTags('Reservas y Emisión')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar un ticket', description: 'Scope de referencia: flights:read.' })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'ticketId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Detalle del ticket', type: TicketResponseDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  getTicketDetail(
    @CurrentAuth() auth: AuthClaims,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ) {
    return this.bookingsService.getTicketDetail(auth.ownerId, bookingId, ticketId);
  }

  // --- Postventa (Maletas, Fechas y Cancelaciones) ---
  // En el contrato pero sin implementar en esta fase: responden 501, nunca un 200 vacío.
  @Get('bookings/:bookingId/baggage-options')
  @UseGuards(JwtAuthGuard)
  @ApiTags('Postventa (Maletas, Fechas y Cancelaciones)')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Opciones de equipaje post-emisión (no implementado)' })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiProblemResponses(UNAUTHORIZED, NOT_IMPLEMENTED)
  getBaggageOptions(@Param('bookingId', ParseUUIDPipe) _bookingId: string) {
    return notImplemented('Post-sale baggage options');
  }

  @Post('bookings/:bookingId/baggage')
  @UseGuards(JwtAuthGuard, IdempotencyKeyGuard)
  @ApiTags('Postventa (Maletas, Fechas y Cancelaciones)')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Agregar maleta extra post-emisión (no implementado)' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, NOT_IMPLEMENTED)
  addBaggage(@Param('bookingId', ParseUUIDPipe) _bookingId: string, @Body() _addBaggageRequestDto: AddBaggageRequestDto) {
    return notImplemented('Adding post-sale baggage');
  }

  @Post('bookings/:bookingId/date-change/search')
  @UseGuards(JwtAuthGuard)
  @ApiTags('Postventa (Maletas, Fechas y Cancelaciones)')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar disponibilidad para cambio de fecha (no implementado)' })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, NOT_IMPLEMENTED)
  searchDateChange(@Param('bookingId', ParseUUIDPipe) _bookingId: string, @Body() _dateChangeSearchRequestDto: DateChangeSearchRequestDto) {
    return notImplemented('Date-change search');
  }

  @Post('bookings/:bookingId/date-change')
  @UseGuards(JwtAuthGuard, IdempotencyKeyGuard)
  @ApiTags('Postventa (Maletas, Fechas y Cancelaciones)')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirmar cambio de fecha (no implementado)' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, NOT_IMPLEMENTED)
  confirmDateChange(@Param('bookingId', ParseUUIDPipe) _bookingId: string, @Body() _dateChangeRequestDto: DateChangeRequestDto) {
    return notImplemented('Date-change confirmation');
  }

  @Get('bookings/:bookingId/cancellation-quote')
  @UseGuards(JwtAuthGuard)
  @ApiTags('Postventa (Maletas, Fechas y Cancelaciones)')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cotizar reembolso por cancelación (no implementado)' })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiProblemResponses(UNAUTHORIZED, NOT_IMPLEMENTED)
  getCancellationQuote(@Param('bookingId', ParseUUIDPipe) _bookingId: string) {
    return notImplemented('Cancellation quote');
  }

  @Post('bookings/:bookingId/cancel')
  @UseGuards(JwtAuthGuard, IdempotencyKeyGuard)
  @ApiTags('Postventa (Maletas, Fechas y Cancelaciones)')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancelar reserva (no implementado)' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, NOT_IMPLEMENTED)
  cancelBooking(@Param('bookingId', ParseUUIDPipe) _bookingId: string, @Body() _cancelBookingRequestDto: CancelBookingRequestDto) {
    return notImplemented('Booking cancellation');
  }

  // --- Check-in y Boarding Pass (no implementado) ---
  @Post('bookings/:bookingId/check-in')
  @UseGuards(JwtAuthGuard)
  @ApiTags('Check-in y Boarding Pass')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Realizar check-in de la reserva (no implementado)' })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiProblemResponses(UNAUTHORIZED, NOT_IMPLEMENTED)
  checkIn(@Param('bookingId', ParseUUIDPipe) _bookingId: string) {
    return notImplemented('Check-in');
  }

  @Get('bookings/:bookingId/boarding-passes')
  @UseGuards(JwtAuthGuard)
  @ApiTags('Check-in y Boarding Pass')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar pases de abordar (no implementado)' })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiProblemResponses(UNAUTHORIZED, NOT_IMPLEMENTED)
  getBoardingPasses(@Param('bookingId', ParseUUIDPipe) _bookingId: string) {
    return notImplemented('Boarding passes');
  }

  // --- Estado de Vuelos (público) ---
  @Get('flights/:flightNumber/status')
  @ApiTags('Estado de Vuelos')
  @ApiOperation({ summary: 'Consultar estado de un vuelo' })
  @ApiResponse({ status: 200, description: 'Estado operativo del vuelo' })
  @ApiProblemResponses(BAD_REQUEST, NOT_FOUND)
  getFlightStatus(@Param() params: FlightStatusParamDto, @Query() query: FlightStatusQueryDto) {
    return this.flightStatusService.getStatus(params.flightNumber, query.date);
  }

  // --- Webhooks (no implementado) ---
  @Get('webhooks')
  @UseGuards(JwtAuthGuard)
  @ApiTags('Webhooks')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar suscripciones (no implementado)' })
  @ApiProblemResponses(UNAUTHORIZED, NOT_IMPLEMENTED)
  listWebhooks() {
    return notImplemented('Webhook subscriptions');
  }

  @Post('webhooks')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiTags('Webhooks')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar webhook (no implementado)' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, NOT_IMPLEMENTED)
  createWebhook(@Body() _webhookSubscriptionDto: WebhookSubscriptionDto) {
    return notImplemented('Webhook registration');
  }

  @Delete('webhooks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiTags('Webhooks')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar suscripción (no implementado)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, NOT_IMPLEMENTED)
  deleteWebhook(@Param('id', ParseUUIDPipe) _id: string) {
    return notImplemented('Webhook deletion');
  }
}
