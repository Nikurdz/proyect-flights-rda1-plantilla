import { Body, Delete, Get, Headers, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { IdempotencyKeyGuard } from '../../../common/guards/idempotency-key.guard';
import { CurrentAuth } from '../auth/jwt-auth.guard';
import type { AuthClaims } from '../auth/token.service';
import { ProblemDetailsBody, ProblemDetailsException } from '../common/problem-details.exception';
import { formatMinorUnits } from '../common/money.util';
import { BookingRequestDto, ListBookingsQueryDto, SeatmapQueryDto } from '../dto/booking.dto';
import { FlightStatusParamDto } from '../dto/flight-status.dto';
import { HoldRequestDto } from '../dto/hold.dto';
import {
  AddBaggageRequestDto,
  CancelBookingRequestDto,
  DateChangeRequestDto,
  DateChangeSearchRequestDto,
} from '../dto/postventa.dto';
import { SearchRequestDto } from '../dto/search.dto';
import { BaggageService } from '../services/baggage.service';
import { BookingsService } from '../services/bookings.service';
import { CancellationService } from '../services/cancellation.service';
import { CheckInService } from '../services/check-in.service';
import { DateChangeService } from '../services/date-change.service';
import { FlightStatusService } from '../services/flight-status.service';
import { OffersService } from '../services/offers.service';
import { SearchService } from '../services/search.service';
import { WebhooksService, viewV2 } from '../services/webhooks.service';
import { PartnerAuthGuard, RequiresScope } from './auth/partner-auth.guard';
import { BookingViewV2Service } from './booking-view-v2.service';
import { EventsQueryDto, FlightStatusRequiredDateDto, FlightStatusUpdateRequestDto, OperationsQueryDto, PromocionesContratoRequestDto, SeatChangeRequestDto, WebhookSubscriptionV2Dto } from './dto-v2';
import { FlightOpsV2Service } from './flight-ops-v2.service';
import { HealthV2Service } from './health-v2.service';
import { OutboxV2Service } from './outbox-v2.service';
import { PromotionsV2Service } from './promotions-v2.service';
import { SeatChangeV2Service } from './seat-change-v2.service';
import { TicketsV2Service } from './tickets-v2.service';
import { bookingLinks, checkInLinks, holdLinks } from './v2-links';
import { V2Controller } from './v2-controller';

/**
 * Contract v2 (`contracts/vuelos-openapi-v2.yaml`): the flight API Booking Prototipo integrates with, at
 * /api/v2/vuelos. It is a thin layer: every operation runs the same service as /api/v1 and only the entry (OAuth2
 * scopes, X-User-Id), the error format and the shape of the answers (`_links`, tickets per segment, richer cancel)
 * are v2's. Operations that took a `quoteId` or a UUID ticket id in v1 are relaxed where v2 says so.
 */
@V2Controller('', 'Contrato v2 · vuelos')
@UseGuards(PartnerAuthGuard)
export class VuelosV2Controller {
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
    private readonly view: BookingViewV2Service,
    private readonly seatChange: SeatChangeV2Service,
    private readonly tickets: TicketsV2Service,
    private readonly flightOps: FlightOpsV2Service,
    private readonly outbox: OutboxV2Service,
    private readonly promotions: PromotionsV2Service,
    private readonly health: HealthV2Service,
  ) {}

  // --- MS.Vuelos · Telemetría ---
  @Get('health')
  @ApiOperation({ operationId: 'getHealth', summary: 'Salud y telemetría del nodo (semáforo del Panel 1)' })
  async getHealth(@Res({ passthrough: true }) res: Response) {
    const result = await this.health.check();
    if (result.status === 'DOWN') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }

  @Get('eventos')
  @RequiresScope('flights:read')
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'listOutboxEvents', summary: 'Feed outbox de eventos CloudEvents' })
  listOutboxEvents(@Query() query: EventsQueryDto) {
    return this.outbox.list(query);
  }

  // --- MS.Vuelos · Promociones B2B ---
  @Get('promociones/contrato')
  @RequiresScope('flights:read')
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'getPromotionAgreement', summary: 'Acuerdo de promociones vigente' })
  getPromotionAgreement() {
    return this.promotions.get();
  }

  @Put('promociones/contrato')
  @RequiresScope('flights:admin')
  @UseGuards(IdempotencyKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'putPromotionAgreement', summary: 'Registrar el acuerdo de promociones' })
  putPromotionAgreement(@Body() body: PromocionesContratoRequestDto) {
    return this.promotions.put(body);
  }

  // --- MS.Vuelos · Búsqueda y catálogo (público) ---
  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'searchFlights', summary: 'Búsqueda de vuelos (multidestino)' })
  search(@Headers('x-device-fingerprint') deviceFingerprint: string | undefined, @Body() body: SearchRequestDto) {
    if (!deviceFingerprint || deviceFingerprint.trim() === '') {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Falta X-Device-Fingerprint', 'Envíe un encabezado X-Device-Fingerprint no vacío.', [
        { name: 'X-Device-Fingerprint', reason: 'required header is missing or empty' },
      ]);
    }
    return this.searchService.search(body);
  }

  @Get('offers/:offerId/seatmap')
  @ApiOperation({ operationId: 'getSeatMap', summary: 'Mapa de asientos por segmento, con el estado de cada asiento' })
  async getSeatMap(@Param('offerId', ParseUUIDPipe) offerId: string, @Query() query: SeatmapQueryDto) {
    return this.view.seatmap(await this.offersService.getSeatmap(offerId, query.segmentId));
  }

  @Get('flights/:flightNumber/status')
  @ApiOperation({ operationId: 'getFlightStatus', summary: 'Estado público de un vuelo' })
  getFlightStatus(@Param() params: FlightStatusParamDto, @Query() query: FlightStatusRequiredDateDto) {
    return this.flightStatusService.getStatus(params.flightNumber, query.date);
  }

  // --- MS.Vuelos · Operaciones ---
  @Patch('flights/:flightNumber/status')
  @RequiresScope('flights:ops')
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'updateFlightStatus', summary: 'Registrar demora, puerta, desvío o cancelación' })
  updateFlightStatus(@Param() params: FlightStatusParamDto, @Body() body: FlightStatusUpdateRequestDto) {
    return this.flightOps.updateStatus(params.flightNumber, body);
  }

  @Get('operaciones/vuelos')
  @RequiresScope('flights:ops')
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'listFlightOperations', summary: 'Panel de ocupación por vuelo y cabina' })
  listFlightOperations(@Query() query: OperationsQueryDto) {
    return this.flightOps.operations(query);
  }

  // --- MS.Reservas · Hold ---
  @Post('offers/hold')
  @RequiresScope('flights:hold')
  @UseGuards(IdempotencyKeyGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'createHold', summary: 'Bloquear inventario (precio congelado, ttlMinutes 5–30)' })
  async createHold(@CurrentAuth() auth: AuthClaims, @Headers('idempotency-key') key: string, @Body() body: HoldRequestDto, @Res({ passthrough: true }) res: Response) {
    const hold = await this.offersService.createHold(auth, key, body);
    res.setHeader('Location', `/api/v2/vuelos/offers/hold/${hold.holdId}`);
    return { ...hold, _links: holdLinks(hold.holdId) };
  }

  @Get('offers/hold/:holdId')
  @RequiresScope('flights:read')
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'getHold', summary: 'Estado de un hold' })
  async getHold(@CurrentAuth() auth: AuthClaims, @Param('holdId', ParseUUIDPipe) holdId: string) {
    const status = await this.offersService.getHoldStatus(auth.ownerId, holdId);
    return { holdId, ...status, _links: holdLinks(holdId) };
  }

  @Delete('offers/hold/:holdId')
  @RequiresScope('flights:hold')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'releaseHold', summary: 'Liberar un hold (idempotente; vencido o liberado responde 204)' })
  async releaseHold(@CurrentAuth() auth: AuthClaims, @Param('holdId', ParseUUIDPipe) holdId: string) {
    try {
      await this.offersService.releaseHold(auth.ownerId, holdId);
    } catch (error) {
      // v2: releasing a hold that already expired is a no-op, like releasing a released one.
      const body = error instanceof ProblemDetailsException ? (error.getResponse() as ProblemDetailsBody) : null;
      if (!(body && error instanceof ProblemDetailsException && error.v2?.code === 'HOLD_EXPIRED')) throw error;
    }
  }

  // --- MS.Reservas · Reservas y emisión ---
  @Get('bookings')
  @RequiresScope('flights:read')
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'listBookings', summary: 'Reservas del usuario (X-User-Id), paginadas' })
  async listBookings(@CurrentAuth() auth: AuthClaims, @Query() query: ListBookingsQueryDto) {
    const page = await this.bookingsService.listBookings(auth.ownerId, query);
    return { items: page.items.map((item) => ({ ...item, _links: bookingLinks(item.bookingId, 'CONFIRMED') })), nextCursor: page.nextCursor ?? null };
  }

  @Post('bookings')
  @RequiresScope('flights:book')
  @UseGuards(IdempotencyKeyGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'createBooking', summary: 'Convertir el hold en reserva (Booking ya cobró: llega paymentReference)' })
  async createBooking(@CurrentAuth() auth: AuthClaims, @Headers('idempotency-key') key: string, @Body() body: BookingRequestDto, @Res({ passthrough: true }) res: Response) {
    if (body.salesChannel?.promotionApplied) await this.promotions.assertDiscountAllowed(body.salesChannel.discountPercentage);
    const created = await this.bookingsService.createBooking(auth, key, body, { passportForInternational: true });
    res.setHeader('Location', `/api/v2/vuelos/bookings/${created.bookingId}`);
    return this.view.detail(auth.ownerId, created.bookingId);
  }

  @Get('bookings/:bookingId')
  @RequiresScope('flights:read')
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'getBooking', summary: 'Detalle de la reserva' })
  getBooking(@CurrentAuth() auth: AuthClaims, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.view.detail(auth.ownerId, bookingId);
  }

  @Post('bookings/:bookingId/tickets')
  @RequiresScope('flights:book')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'issueTickets', summary: 'Emitir boletos (idempotente: ya emitidos responde issued 0)' })
  issueTickets(@CurrentAuth() auth: AuthClaims, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.tickets.issue(auth, bookingId);
  }

  @Get('bookings/:bookingId/tickets')
  @RequiresScope('flights:read')
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'listTickets', summary: 'Boletos de la reserva' })
  async listTickets(@CurrentAuth() auth: AuthClaims, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return { bookingId, tickets: await this.view.tickets(auth.ownerId, bookingId) };
  }

  @Get('bookings/:bookingId/tickets/:ticketId')
  @RequiresScope('flights:read')
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'getTicket', summary: 'Un boleto' })
  getTicket(@CurrentAuth() auth: AuthClaims, @Param('bookingId', ParseUUIDPipe) bookingId: string, @Param('ticketId') ticketId: string) {
    return this.view.ticket(auth.ownerId, bookingId, ticketId);
  }

  // --- MS.Reservas · Asientos, check-in y pases ---
  @Put('bookings/:bookingId/seats')
  @RequiresScope('flights:book')
  @UseGuards(IdempotencyKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'changeSeats', summary: 'Cambiar asientos dentro de la misma cabina (atómico)' })
  changeSeats(@CurrentAuth() auth: AuthClaims, @Headers('idempotency-key') key: string, @Param('bookingId', ParseUUIDPipe) bookingId: string, @Body() body: SeatChangeRequestDto) {
    return this.seatChange.changeSeats(auth, key, bookingId, body);
  }

  @Post('bookings/:bookingId/check-in')
  @RequiresScope('flights:book')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'checkIn', summary: 'Check-in en línea' })
  async checkIn(@CurrentAuth() auth: AuthClaims, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return { ...(await this.checkInService.checkIn(auth, bookingId)), _links: checkInLinks(bookingId) };
  }

  @Get('bookings/:bookingId/boarding-passes')
  @RequiresScope('flights:read')
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'listBoardingPasses', summary: 'Pases de abordar' })
  async listBoardingPasses(@CurrentAuth() auth: AuthClaims, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.view.boardingPasses(await this.checkInService.boardingPasses(auth.ownerId, bookingId));
  }

  // --- MS.Postventa ---
  @Get('bookings/:bookingId/baggage-options')
  @RequiresScope('flights:read')
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'getBaggageOptions', summary: 'Opciones y precio del equipaje extra' })
  getBaggageOptions(@CurrentAuth() auth: AuthClaims, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.baggageService.options(auth.ownerId, bookingId);
  }

  @Post('bookings/:bookingId/baggage')
  @RequiresScope('flights:book')
  @UseGuards(IdempotencyKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'addBaggage', summary: 'Agregar equipaje extra' })
  addBaggage(@CurrentAuth() auth: AuthClaims, @Headers('idempotency-key') key: string, @Param('bookingId', ParseUUIDPipe) bookingId: string, @Body() body: AddBaggageRequestDto) {
    return this.baggageService.add(auth, key, bookingId, body);
  }

  @Post('bookings/:bookingId/date-change/search')
  @RequiresScope('flights:read')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'searchDateChange', summary: 'Buscar opciones de cambio de fecha' })
  searchDateChange(@CurrentAuth() auth: AuthClaims, @Param('bookingId', ParseUUIDPipe) bookingId: string, @Body() body: DateChangeSearchRequestDto) {
    return this.dateChangeService.searchOptions(auth.ownerId, bookingId, body);
  }

  @Post('bookings/:bookingId/date-change')
  @RequiresScope('flights:book')
  @UseGuards(IdempotencyKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'confirmDateChange', summary: 'Confirmar el cambio de fecha' })
  async confirmDateChange(@CurrentAuth() auth: AuthClaims, @Headers('idempotency-key') key: string, @Param('bookingId', ParseUUIDPipe) bookingId: string, @Body() body: DateChangeRequestDto) {
    await this.dateChangeService.confirm(auth, key, bookingId, body);
    return this.view.detail(auth.ownerId, bookingId);
  }

  @Get('bookings/:bookingId/cancellation-quote')
  @RequiresScope('flights:read')
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'getCancellationQuote', summary: 'Cotizar la cancelación' })
  getCancellationQuote(@CurrentAuth() auth: AuthClaims, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.cancellationService.quote(auth.ownerId, bookingId);
  }

  @Post('bookings/:bookingId/cancel')
  @RequiresScope('flights:cancel')
  @UseGuards(IdempotencyKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'cancelBooking', summary: 'Cancelar la reserva (la aerolínea calcula el reembolso; Booking lo ejecuta)' })
  async cancelBooking(@CurrentAuth() auth: AuthClaims, @Headers('idempotency-key') key: string, @Param('bookingId', ParseUUIDPipe) bookingId: string, @Body() body: CancelBookingRequestDto) {
    let outcome;
    try {
      outcome = await this.cancellationService.cancelWithEvent(auth, key, bookingId, body);
    } catch (error) {
      // v2 names "the booking is not in a state that can be cancelled" BOOKING_NOT_CANCELLABLE.
      if (error instanceof ProblemDetailsException && (error.getResponse() as ProblemDetailsBody).code === 'BOOKING_NOT_CONFIRMED') error.forV2('BOOKING_NOT_CANCELLABLE');
      throw error;
    }
    const { response, event } = outcome;
    const tickets = await this.view.tickets(auth.ownerId, bookingId);
    const refundMinor = Number(event.refundMinor ?? 0);
    const penaltyMinor = Number(event.penaltyMinor ?? 0);
    return {
      bookingId,
      pnr: event.pnr,
      status: response.status,
      cancelledAt: new Date().toISOString(),
      reasonCode: event.reasonCode ?? 'CUSTOMER_REQUEST',
      refund: {
        refundId: event.refundId,
        amount: response.refundAmount,
        penaltyAmount: response.penaltyAmount,
        currency: response.currency,
        percentage: refundMinor + penaltyMinor > 0 ? Math.round((refundMinor / (refundMinor + penaltyMinor)) * 100) : 0,
        originalPaymentReference: event.paymentReference,
        status: refundMinor > 0 ? 'CALCULATED' : 'NOT_REFUNDABLE',
      },
      ticketsVoided: tickets.map((t) => t.ticketId),
      inventoryRestoration: { status: 'RESTORED', seatsReleased: event.seatsReleased ?? 0, newSeatStatus: 'AVAILABLE' },
      message: refundMinor > 0 ? `Reembolso de ${formatMinorUnits(refundMinor)} ${response.currency} calculado; Booking lo ejecuta al cliente.` : 'La tarifa no es reembolsable.',
      _links: bookingLinks(bookingId, response.status),
    };
  }

  // --- MS.Clientes · Webhooks ---
  @Get('webhooks')
  @RequiresScope('flights:webhooks')
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'listWebhooks', summary: 'Mis suscripciones' })
  async listWebhooks(@CurrentAuth() auth: AuthClaims) {
    return (await this.webhooksService.listRows(auth.ownerId)).map(viewV2);
  }

  @Post('webhooks')
  @RequiresScope('flights:webhooks')
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'createWebhook', summary: 'Registrar un webhook (CloudEvents firmados)' })
  async createWebhook(@CurrentAuth() auth: AuthClaims, @Body() body: WebhookSubscriptionV2Dto) {
    return viewV2(await this.webhooksService.createRow(auth.ownerId, body, 2));
  }

  @Delete('webhooks/:id')
  @RequiresScope('flights:webhooks')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ operationId: 'deleteWebhook', summary: 'Eliminar un webhook' })
  async deleteWebhook(@CurrentAuth() auth: AuthClaims, @Param('id', ParseUUIDPipe) id: string) {
    await this.webhooksService.remove(auth.ownerId, id);
  }
}
