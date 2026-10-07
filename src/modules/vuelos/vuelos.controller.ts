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
import { SWAGGER_TAGS } from './common/swagger-tags';
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
import {
  AddBaggageRequestDto,
  BaggageAddedResponseDto,
  BaggageOptionDto,
  BoardingPassListResponseDto,
  CancelBookingRequestDto,
  CancelBookingResponseDto,
  CancellationQuoteResponseDto,
  CheckInResponseDto,
  DateChangeOptionDto,
  DateChangeRequestDto,
  DateChangeSearchRequestDto,
} from './dto/postventa.dto';
import { SearchRequestDto, SearchResponseDto } from './dto/search.dto';
import { WebhookSubscriptionDto, WebhookSubscriptionViewDto } from './dto/webhooks.dto';
import { BaggageService } from './services/baggage.service';
import { BookingsService } from './services/bookings.service';
import { CancellationService } from './services/cancellation.service';
import { CheckInService } from './services/check-in.service';
import { DateChangeService } from './services/date-change.service';
import { FlightStatusService } from './services/flight-status.service';
import { OffersService } from './services/offers.service';
import { SearchService } from './services/search.service';
import { WebhooksService } from './services/webhooks.service';

// Statuses used across the routes below.
const { BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, GONE, UNPROCESSABLE_ENTITY, SERVICE_UNAVAILABLE } = HttpStatus;

@Controller()
@UseFilters(VuelosProblemDetailsFilter)
@UseInterceptors(CorrelationInterceptor)
export class VuelosController {
  constructor(
    private readonly searchService: SearchService,
    private readonly offersService: OffersService,
    private readonly bookingsService: BookingsService,
    private readonly flightStatusService: FlightStatusService,
    private readonly baggageService: BaggageService,
    private readonly dateChangeService: DateChangeService,
    private readonly cancellationService: CancellationService,
    private readonly checkInService: CheckInService,
    private readonly webhooksService: WebhooksService,
  ) {}

  // --- Búsqueda y Catálogo (público) ---
  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiTags(SWAGGER_TAGS.nucleoBusqueda)
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
  @ApiTags(SWAGGER_TAGS.nucleoBusqueda)
  @ApiOperation({
    summary: 'Obtener mapa de asientos por segmento',
    description:
      'Muestra los asientos ya emitidos (reservados por una reserva confirmada). Un hold no fija asientos concretos: ' +
      'dos clientes pueden elegir el mismo asiento libre y el perdedor recibe 409 `SEAT_TAKEN` al confirmar la reserva, ' +
      'sin cobro. Es un mapa de cabina, no una reserva de inventario.',
  })
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
  @ApiTags(SWAGGER_TAGS.nucleoHold)
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
  @ApiTags(SWAGGER_TAGS.nucleoHold)
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
  @ApiTags(SWAGGER_TAGS.nucleoHold)
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
  @ApiTags(SWAGGER_TAGS.nucleoReservas)
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
  @ApiTags(SWAGGER_TAGS.nucleoReservas)
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
  @ApiTags(SWAGGER_TAGS.nucleoReservas)
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
  @ApiTags(SWAGGER_TAGS.nucleoReservas)
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
  @ApiTags(SWAGGER_TAGS.nucleoReservas)
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

  // --- Gestionar la reserva: equipaje, cambio de fecha y cancelación ---
  @Get('bookings/:bookingId/baggage-options')
  @UseGuards(JwtAuthGuard)
  @ApiTags(SWAGGER_TAGS.gestionar)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Opciones y precio del equipaje extra',
    description: 'Scope de referencia: flights:read. Por pasajero y tramo: precio de una maleta, máximo permitido y las ya compradas. Los bebés en brazos no compran equipaje.',
  })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Tarifas y límites de maletas', type: [BaggageOptionDto] })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  getBaggageOptions(@CurrentAuth() auth: AuthClaims, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.baggageService.options(auth.ownerId, bookingId);
  }

  @Post('bookings/:bookingId/baggage')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, IdempotencyKeyGuard)
  @ApiTags(SWAGGER_TAGS.gestionar)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Agregar equipaje extra',
    description:
      'Scope de referencia: flights:book. Hasta 3 h antes de la salida, máximo 2 maletas extra por pasajero y tramo. La referencia de pago es de un solo uso. Una sola transacción; con la misma Idempotency-Key devuelve el mismo resultado.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Maleta agregada', type: BaggageAddedResponseDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY)
  addBaggage(
    @CurrentAuth() auth: AuthClaims,
    @Headers('idempotency-key') idempotencyKey: string,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() body: AddBaggageRequestDto,
  ) {
    return this.baggageService.add(auth, idempotencyKey, bookingId, body);
  }

  @Post('bookings/:bookingId/date-change/search')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiTags(SWAGGER_TAGS.gestionar)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Buscar opciones de cambio de fecha',
    description:
      'Scope de referencia: flights:read. Solo tarifas que permiten cambios. Devuelve vuelos directos de la misma ruta con cupo, con la diferencia de tarifa e impuestos más el cargo de cambio; cada opción vive 15 minutos.',
  })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Opciones de cambio', type: [DateChangeOptionDto] })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  searchDateChange(@CurrentAuth() auth: AuthClaims, @Param('bookingId', ParseUUIDPipe) bookingId: string, @Body() body: DateChangeSearchRequestDto) {
    return this.dateChangeService.searchOptions(auth.ownerId, bookingId, body);
  }

  @Post('bookings/:bookingId/date-change')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, IdempotencyKeyGuard)
  @ApiTags(SWAGGER_TAGS.gestionar)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Confirmar el cambio de fecha',
    description:
      'Scope de referencia: flights:book. Una sola transacción: toma los cupos del vuelo nuevo, devuelve los del viejo y actualiza la reserva. Si hay algo que pagar, hay que enviar payment.paymentReference (de un solo uso). Los asientos se asignan a los pasajeros que ocupan asiento en orden ascendente de passengerId.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cambio confirmado', type: BookingDetailResponseDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, GONE, UNPROCESSABLE_ENTITY)
  confirmDateChange(
    @CurrentAuth() auth: AuthClaims,
    @Headers('idempotency-key') idempotencyKey: string,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() body: DateChangeRequestDto,
  ) {
    return this.dateChangeService.confirm(auth, idempotencyKey, bookingId, body);
  }

  @Get('bookings/:bookingId/cancellation-quote')
  @UseGuards(JwtAuthGuard)
  @ApiTags(SWAGGER_TAGS.gestionar)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cotizar la cancelación',
    description:
      'Scope de referencia: flights:read. Tarifa reembolsable (FULL): el total menos 10 % de penalidad; no reembolsable (BASIC/LIGHT): solo los impuestos; el equipaje extra se devuelve completo. La cotización vive 15 minutos. No se cancela un vuelo que ya salió ni a menos de 3 h de la salida.',
  })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cotización de cancelación', type: CancellationQuoteResponseDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  getCancellationQuote(@CurrentAuth() auth: AuthClaims, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.cancellationService.quote(auth.ownerId, bookingId);
  }

  @Post('bookings/:bookingId/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, IdempotencyKeyGuard)
  @ApiTags(SWAGGER_TAGS.gestionar)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancelar la reserva',
    description:
      'Scope de referencia: flights:cancel. Una sola transacción: la reserva pasa a CANCELLED, los billetes a REFUNDED (o VOIDED si no hay nada que devolver), los asientos y cupos vuelven al inventario. El reembolso se ejecuta en la pasarela y la orden del e-commerce pasa a REEMBOLSADA.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cancelación exitosa', type: CancelBookingResponseDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, GONE)
  cancelBooking(
    @CurrentAuth() auth: AuthClaims,
    @Headers('idempotency-key') idempotencyKey: string,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() body: CancelBookingRequestDto,
  ) {
    return this.cancellationService.cancel(auth, idempotencyKey, bookingId, body);
  }

  // --- Check-in y pases de abordar ---
  @Post('bookings/:bookingId/check-in')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiTags(SWAGGER_TAGS.checkin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Hacer el check-in',
    description:
      'Scope de referencia: flights:book. Abre 48 h y cierra 1 h antes de la salida de cada tramo. Usa el asiento elegido o asigna el primero libre; los bebés en brazos no llevan asiento. Repetirlo no cambia nada (no necesita Idempotency-Key).',
  })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Check-in realizado', type: CheckInResponseDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  checkIn(@CurrentAuth() auth: AuthClaims, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.checkInService.checkIn(auth, bookingId);
  }

  @Get('bookings/:bookingId/boarding-passes')
  @UseGuards(JwtAuthGuard)
  @ApiTags(SWAGGER_TAGS.checkin)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Pases de abordar',
    description:
      'Scope de referencia: flights:read. Uno por pasajero con asiento y tramo, con su grupo y posición de embarque y un código QR firmado (sin datos personales). Antes del check-in responde 404 BOARDING_PASS_NOT_AVAILABLE.',
  })
  @ApiParam({ name: 'bookingId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Pases de abordar disponibles', type: BoardingPassListResponseDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  getBoardingPasses(@CurrentAuth() auth: AuthClaims, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.checkInService.boardingPasses(auth.ownerId, bookingId);
  }

  // --- Estado de Vuelos (público) ---
  @Get('flights/:flightNumber/status')
  @ApiTags(SWAGGER_TAGS.nucleoEstado)
  @ApiOperation({ summary: 'Consultar estado de un vuelo' })
  @ApiResponse({ status: 200, description: 'Estado operativo del vuelo' })
  @ApiProblemResponses(BAD_REQUEST, NOT_FOUND)
  getFlightStatus(@Param() params: FlightStatusParamDto, @Query() query: FlightStatusQueryDto) {
    return this.flightStatusService.getStatus(params.flightNumber, query.date);
  }

  // --- Webhooks ---
  @Get('webhooks')
  @UseGuards(JwtAuthGuard)
  @ApiTags(SWAGGER_TAGS.webhooks)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar mis suscripciones', description: 'Scope de referencia: flights:webhooks. El secreto nunca se devuelve.' })
  @ApiResponse({ status: 200, description: 'Suscripciones activas', type: [WebhookSubscriptionViewDto] })
  @ApiProblemResponses(UNAUTHORIZED)
  listWebhooks(@CurrentAuth() auth: AuthClaims) {
    return this.webhooksService.list(auth.ownerId);
  }

  @Post('webhooks')
  @UseGuards(JwtAuthGuard)
  @ApiTags(SWAGGER_TAGS.webhooks)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Registrar un webhook',
    description:
      'Scope de referencia: flights:webhooks. Solo URLs https que resuelvan a direcciones públicas (se rechazan localhost y redes privadas). Cada entrega es un POST con X-Webhook-Id, X-Webhook-Event, X-Webhook-Timestamp y X-Webhook-Signature = sha256=HMAC(secret, timestamp.cuerpo); se reintenta 5 veces (1 min, 5 min, 30 min, 2 h, 6 h). Máximo 10 por cuenta.',
  })
  @ApiResponse({ status: 201, description: 'Webhook registrado', type: WebhookSubscriptionViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, UNPROCESSABLE_ENTITY)
  registerWebhook(@CurrentAuth() auth: AuthClaims, @Body() body: WebhookSubscriptionDto) {
    return this.webhooksService.create(auth.ownerId, body);
  }

  @Delete('webhooks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiTags(SWAGGER_TAGS.webhooks)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar un webhook', description: 'Scope de referencia: flights:webhooks. Las entregas pendientes de esa suscripción se descartan.' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Eliminado' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, NOT_FOUND)
  async deleteWebhook(@CurrentAuth() auth: AuthClaims, @Param('id', ParseUUIDPipe) id: string) {
    await this.webhooksService.remove(auth.ownerId, id);
  }
}
