import { Body, Get, Headers, HttpCode, HttpStatus, Ip, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { IdempotencyKeyGuard } from '../../../../common/guards/idempotency-key.guard';
import { CurrentAuth, JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { AuthClaims } from '../../auth/token.service';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { ProblemController } from '../../common/problem-controller';
import { SWAGGER_TAGS } from '../../common/swagger-tags';
import { ClienteParamDto } from '../identidad/dto/identidad.dto';
import { OfertaParamDto } from '../ofertas/dto/ofertas.dto';
import { ComprasService } from './compras.service';
import { CompraDto, HistorialOrdenesQueryDto, OrdenParamDto, OrdenViewDto, OrdenesPaginaViewDto, RecuperarOrdenQueryDto, VerificacionBilleteViewDto, VerificarBilleteQueryDto, VincularOrdenDto } from './dto/ordenes.dto';
import { OrdenesService } from './ordenes.service';

const { BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, GONE, UNPROCESSABLE_ENTITY, PAYMENT_REQUIRED, TOO_MANY_REQUESTS, BAD_GATEWAY, SERVICE_UNAVAILABLE } = HttpStatus;

@ProblemController('tickets', SWAGGER_TAGS.viajes)
export class VerificacionBilletesController {
  constructor(private readonly ordenes: OrdenesService) {}

  @Get('verificar')
  @ApiOperation({
    summary: 'Paso 5C · Verificar un billete a partir de su código QR (público)',
    description:
      'Acceso público: quien escanea el QR de un pasajero ve si el billete es auténtico y está emitido, con el vuelo y el estado. La firma (HMAC) impide inventar o alterar códigos; no devuelve nombres ni contacto. Limita los intentos por IP.',
  })
  @ApiResponse({ status: 200, type: VerificacionBilleteViewDto })
  @ApiProblemResponses(BAD_REQUEST, TOO_MANY_REQUESTS)
  verificar(@Query() query: VerificarBilleteQueryDto, @Ip() ip: string) {
    return this.ordenes.verificarBillete(query.codigo, ip);
  }
}

@ProblemController('ofertas', SWAGGER_TAGS.pagar)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ComprasController {
  constructor(private readonly compras: ComprasService) {}

  @Post(':id/compra')
  @UseGuards(IdempotencyKeyGuard)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Paso 4 · Pagar y emitir la orden',
    description:
      'SRS §8.4 (pagarYEmitirOrden): revalida el precio, autoriza el pago (antifraude + pasarela), crea la orden y emite la reserva y los billetes en una sola transacción, y captura el cobro. ' +
      'Si la emisión falla después de autorizar el pago, la autorización se anula automáticamente (RN-19). ' +
      'Un reintento con la misma Idempotency-Key devuelve el resultado original y nunca cobra dos veces (RF-PAY-008). ' +
      'Un pago rechazado devuelve 402 y la oferta sigue vigente para probar otro medio (RF-PAY-009).',
  })
  @ApiResponse({ status: 201, type: OrdenViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, GONE, UNPROCESSABLE_ENTITY, PAYMENT_REQUIRED, TOO_MANY_REQUESTS, BAD_GATEWAY, SERVICE_UNAVAILABLE)
  async comprar(
    @CurrentAuth() auth: AuthClaims,
    @Param() params: OfertaParamDto,
    @Headers('idempotency-key') key: string,
    @Body() dto: CompraDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const resultado = await this.compras.comprar(auth, params.id, dto, key);
    // The saga decides the status (201 issued, 402 declined, ...); failures keep the problem media type.
    res.status(resultado.status);
    if (resultado.status >= 400) res.type('application/problem+json');
    return resultado.body;
  }
}

@ProblemController('ordenes', SWAGGER_TAGS.viajes)
export class OrdenesController {
  constructor(private readonly ordenes: OrdenesService) {}

  @Get()
  @ApiOperation({
    summary: 'Paso 5B · Recuperar un viaje con número de orden o PNR y apellido (público)',
    description: 'RF-ORD-010 / RF-CHK-001: acceso público para quien compró sin cuenta. No devuelve datos de contacto y limita los intentos por IP.',
  })
  @ApiResponse({ status: 200, type: OrdenViewDto })
  @ApiProblemResponses(BAD_REQUEST, NOT_FOUND, TOO_MANY_REQUESTS)
  recuperar(@Query() query: RecuperarOrdenQueryDto, @Ip() ip: string) {
    return this.ordenes.recuperar(query, ip);
  }

  @Get(':numero')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Paso 5A · Consultar una orden propia' })
  @ApiResponse({ status: 200, type: OrdenViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, NOT_FOUND)
  obtener(@CurrentAuth() auth: AuthClaims, @Param() params: OrdenParamDto) {
    return this.ordenes.obtenerPropia(auth, params.numero);
  }
}

@ProblemController('clientes', SWAGGER_TAGS.viajes)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ClienteOrdenesController {
  constructor(private readonly ordenes: OrdenesService) {}

  @Post(':id/ordenes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Agregar a mi cuenta un viaje comprado como invitado',
    description: 'Con el número de orden o el código de reserva y un apellido de los pasajeros. Solo se puede reclamar un viaje que aún no pertenece a ninguna cuenta; a partir de ahí aparece en el historial.',
  })
  @ApiResponse({ status: 200, type: OrdenViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, TOO_MANY_REQUESTS)
  vincular(@CurrentAuth() auth: AuthClaims, @Param() params: ClienteParamDto, @Body() body: VincularOrdenDto, @Ip() ip: string) {
    return this.ordenes.vincular(auth, params.id, body, ip);
  }

  @Get(':id/ordenes')
  @ApiOperation({ summary: 'Historial de órdenes del cliente', description: 'RF-ORD-011: más recientes primero, paginado por cursor. Use "me" como id.' })
  @ApiResponse({ status: 200, type: OrdenesPaginaViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN)
  historial(@CurrentAuth() auth: AuthClaims, @Param() params: ClienteParamDto, @Query() query: HistorialOrdenesQueryDto) {
    return this.ordenes.historial(auth, params.id, query);
  }
}
