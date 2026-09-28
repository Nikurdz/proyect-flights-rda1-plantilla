import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseFilters, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IdempotencyKeyGuard } from '../../common/guards/idempotency-key.guard';
import { resolveOwnerId } from './common/owner.util';
import { VuelosProblemDetailsFilter } from './common/problem-details.filter';
import { BookingRequestDto, BookingDetailResponseDto, TicketResponseDto } from './dto/booking.dto';
import { HoldRequestDto, HoldResponseDto, HoldStatusResponseDto } from './dto/hold.dto';
import { AddBaggageRequestDto, DateChangeSearchRequestDto, DateChangeRequestDto, CancelBookingRequestDto } from './dto/postventa.dto';
import { SearchRequestDto, SearchResponseDto } from './dto/search.dto';
import { WebhookSubscriptionDto } from './dto/webhooks.dto';
import { BookingsService } from './services/bookings.service';
import { FlightStatusService } from './services/flight-status.service';
import { OffersService } from './services/offers.service';
import { SearchService } from './services/search.service';

@ApiTags('Búsqueda y Catálogo')
@Controller()
@UseFilters(VuelosProblemDetailsFilter)
export class VuelosController {
  constructor(
    private readonly searchService: SearchService,
    private readonly offersService: OffersService,
    private readonly bookingsService: BookingsService,
    private readonly flightStatusService: FlightStatusService,
  ) {}

  // --- Búsqueda y Catálogo ---
  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Búsqueda de vuelos (Multidestino)' })
  @ApiHeader({ name: 'X-Device-Fingerprint', required: true })
  @ApiResponse({ status: 200, description: 'Ofertas de vuelos encontradas', type: SearchResponseDto })
  search(@Headers('X-Device-Fingerprint') deviceFingerprint: string, @Body() searchRequestDto: SearchRequestDto) {
    return this.searchService.search(searchRequestDto);
  }

  @Get('offers/:offerId/seatmap')
  @ApiTags('Búsqueda y Catálogo')
  @ApiOperation({ summary: 'Obtener mapa de asientos por segmento' })
  @ApiParam({ name: 'offerId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Mapa de asientos' })
  getSeatmap(@Param('offerId') offerId: string, @Query('segmentId') segmentId: string) {
    return this.offersService.getSeatmap(offerId, segmentId);
  }

  // --- Bloqueo de Cupos (Hold) ---
  @Post('offers/hold')
  @UseGuards(IdempotencyKeyGuard)
  @ApiTags('Bloqueo de Cupos (Hold)')
  @ApiSecurity('OAuth2Security', ['flights:hold'])
  @ApiOperation({ summary: 'Bloquear inventario' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiResponse({ status: 201, description: 'Inventario retenido. Devuelve precio congelado.', type: HoldResponseDto })
  holdOffer(@Headers('Idempotency-Key') idempotencyKey: string, @Body() holdRequestDto: HoldRequestDto) {
    return this.offersService.createHold(idempotencyKey, holdRequestDto);
  }

  @Get('offers/hold/:holdId')
  @ApiTags('Bloqueo de Cupos (Hold)')
  @ApiSecurity('OAuth2Security', ['flights:read'])
  @ApiOperation({ summary: 'Consultar estado de un hold' })
  @ApiParam({ name: 'holdId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Estado del hold', type: HoldStatusResponseDto })
  getHoldStatus(@Param('holdId', ParseUUIDPipe) holdId: string) {
    return this.offersService.getHoldStatus(holdId);
  }

  @Delete('offers/hold/:holdId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTags('Bloqueo de Cupos (Hold)')
  @ApiSecurity('OAuth2Security', ['flights:hold'])
  @ApiOperation({ summary: 'Liberar hold anticipadamente' })
  @ApiParam({ name: 'holdId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Liberado exitosamente' })
  releaseHold(@Param('holdId', ParseUUIDPipe) holdId: string) {
    return this.offersService.releaseHold(holdId);
  }

  // --- Reservas y Emisión ---
  @Get('bookings')
  @ApiTags('Reservas y Emisión')
  @ApiSecurity('OAuth2Security', ['flights:read'])
  @ApiOperation({ summary: 'Listar reservas del usuario actual (Paginado)' })
  @ApiResponse({ status: 200, description: 'Lista resumida' })
  listBookings(
    @Headers('Authorization') authorization: string | undefined,
    @Query('pnr') pnr?: string,
    @Query('status') status?: string,
    @Query('createdFrom') createdFrom?: string,
    @Query('createdTo') createdTo?: string,
    @Query('limit') limit: number = 10,
    @Query('cursor') cursor?: string
  ) {
    const ownerId = resolveOwnerId(authorization);
    return this.bookingsService.listBookings(ownerId, { pnr, status, limit: Number(limit) || 10 });
  }

  @Post('bookings')
  @UseGuards(IdempotencyKeyGuard)
  @ApiTags('Reservas y Emisión')
  @ApiSecurity('OAuth2Security', ['flights:book'])
  @ApiOperation({ summary: 'Crear reserva y gestionar emisión de ticket' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiResponse({ status: 201, description: 'Reserva creada y ticket emitido correctamente.', type: BookingDetailResponseDto })
  @ApiResponse({ status: 202, description: 'Reserva creada; pago o emisión de ticket continúa de forma asíncrona.' })
  createBooking(
    @Headers('Idempotency-Key') idempotencyKey: string,
    @Headers('Authorization') authorization: string | undefined,
    @Body() bookingRequestDto: BookingRequestDto,
  ) {
    return this.bookingsService.createBooking(idempotencyKey, bookingRequestDto, authorization);
  }

  @Get('bookings/:bookingId')
  @ApiTags('Reservas y Emisión')
  @ApiSecurity('OAuth2Security', ['flights:read'])
  @ApiOperation({ summary: 'Detalle completo de reserva' })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Detalle de reserva (itinerarios, pasajeros, historial)', type: BookingDetailResponseDto })
  getBookingDetail(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.bookingsService.getBookingDetail(bookingId);
  }

  @Get('bookings/:bookingId/tickets')
  @ApiTags('Reservas y Emisión')
  @ApiSecurity('OAuth2Security', ['flights:read'])
  @ApiOperation({ summary: 'Consultar tickets de una reserva' })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Tickets asociados a la reserva', type: [TicketResponseDto] })
  getBookingTickets(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.bookingsService.getBookingTickets(bookingId);
  }

  @Get('bookings/:bookingId/tickets/:ticketId')
  @ApiTags('Reservas y Emisión')
  @ApiSecurity('OAuth2Security', ['flights:read'])
  @ApiOperation({ summary: 'Consultar un ticket' })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'ticketId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Detalle del ticket', type: TicketResponseDto })
  getTicketDetail(@Param('bookingId', ParseUUIDPipe) bookingId: string, @Param('ticketId') ticketId: string) {
    return this.bookingsService.getTicketDetail(bookingId, ticketId);
  }

  // --- Postventa (Maletas, Fechas y Cancelaciones) ---
  // Stretch scope for this pass: kept contract-shaped but not backed by real logic yet.
  @Get('bookings/:bookingId/baggage-options')
  @ApiTags('Postventa (Maletas, Fechas y Cancelaciones)')
  @ApiSecurity('OAuth2Security', ['flights:read'])
  @ApiOperation({ summary: 'Opciones de equipaje post-emisión' })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Tarifas y límites de maletas' })
  getBaggageOptions(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return [];
  }

  @Post('bookings/:bookingId/baggage')
  @ApiTags('Postventa (Maletas, Fechas y Cancelaciones)')
  @ApiSecurity('OAuth2Security', ['flights:book'])
  @ApiOperation({ summary: 'Agregar maleta extra post-emisión' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Maleta agregada' })
  addBaggage(@Headers('Idempotency-Key') idempotencyKey: string, @Param('bookingId', ParseUUIDPipe) bookingId: string, @Body() addBaggageRequestDto: AddBaggageRequestDto) {
    return {};
  }

  @Post('bookings/:bookingId/date-change/search')
  @ApiTags('Postventa (Maletas, Fechas y Cancelaciones)')
  @ApiSecurity('OAuth2Security', ['flights:read'])
  @ApiOperation({ summary: 'Buscar disponibilidad para cambio de fecha' })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Opciones de cambio' })
  searchDateChange(@Param('bookingId', ParseUUIDPipe) bookingId: string, @Body() dateChangeSearchRequestDto: DateChangeSearchRequestDto) {
    return [];
  }

  @Post('bookings/:bookingId/date-change')
  @ApiTags('Postventa (Maletas, Fechas y Cancelaciones)')
  @ApiSecurity('OAuth2Security', ['flights:book'])
  @ApiOperation({ summary: 'Confirmar cambio de fecha' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cambio confirmado' })
  confirmDateChange(@Headers('Idempotency-Key') idempotencyKey: string, @Param('bookingId', ParseUUIDPipe) bookingId: string, @Body() dateChangeRequestDto: DateChangeRequestDto) {
    return {};
  }

  @Get('bookings/:bookingId/cancellation-quote')
  @ApiTags('Postventa (Maletas, Fechas y Cancelaciones)')
  @ApiSecurity('OAuth2Security', ['flights:read'])
  @ApiOperation({ summary: 'Cotizar reembolso por cancelación' })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cotización de cancelación' })
  getCancellationQuote(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return {};
  }

  @Post('bookings/:bookingId/cancel')
  @ApiTags('Postventa (Maletas, Fechas y Cancelaciones)')
  @ApiSecurity('OAuth2Security', ['flights:cancel'])
  @ApiOperation({ summary: 'Cancelar reserva' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cancelación exitosa' })
  cancelBooking(@Headers('Idempotency-Key') idempotencyKey: string, @Param('bookingId', ParseUUIDPipe) bookingId: string, @Body() cancelBookingRequestDto: CancelBookingRequestDto) {
    return {};
  }

  // --- Check-in y Boarding Pass ---
  @Post('bookings/:bookingId/check-in')
  @ApiTags('Check-in y Boarding Pass')
  @ApiSecurity('OAuth2Security', ['flights:book'])
  @ApiOperation({ summary: 'Realizar check-in de la reserva' })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Check-in realizado' })
  checkIn(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return {};
  }

  @Get('bookings/:bookingId/boarding-passes')
  @ApiTags('Check-in y Boarding Pass')
  @ApiSecurity('OAuth2Security', ['flights:read'])
  @ApiOperation({ summary: 'Consultar pases de abordar' })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Pases de abordar disponibles' })
  getBoardingPasses(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return {};
  }

  // --- Estado de Vuelos ---
  @Get('flights/:flightNumber/status')
  @ApiTags('Estado de Vuelos')
  @ApiOperation({ summary: 'Consultar estado de un vuelo' })
  @ApiParam({ name: 'flightNumber', type: 'string' })
  @ApiResponse({ status: 200, description: 'Estado operativo del vuelo' })
  getFlightStatus(@Param('flightNumber') flightNumber: string, @Query('date') date: string) {
    return this.flightStatusService.getStatus(flightNumber, date);
  }

  // --- Webhooks ---
  // Stretch scope for this pass: kept contract-shaped but not backed by real logic yet.
  @Get('webhooks')
  @ApiTags('Webhooks')
  @ApiSecurity('OAuth2Security', ['flights:webhooks'])
  @ApiOperation({ summary: 'Listar suscripciones' })
  @ApiResponse({ status: 200, description: 'Suscripciones activas' })
  listWebhooks() {
    return [];
  }

  @Post('webhooks')
  @ApiTags('Webhooks')
  @ApiSecurity('OAuth2Security', ['flights:webhooks'])
  @ApiOperation({ summary: 'Registrar webhook' })
  @ApiResponse({ status: 201, description: 'Webhook registrado' })
  createWebhook(@Body() webhookSubscriptionDto: WebhookSubscriptionDto) {
    return {};
  }

  @Delete('webhooks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTags('Webhooks')
  @ApiSecurity('OAuth2Security', ['flights:webhooks'])
  @ApiOperation({ summary: 'Eliminar suscripción' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Eliminado' })
  deleteWebhook(@Param('id', ParseUUIDPipe) id: string) {
    return;
  }
}
