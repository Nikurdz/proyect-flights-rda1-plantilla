import { Body, Delete, Get, Headers, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IdempotencyKeyGuard } from '../../../../common/guards/idempotency-key.guard';
import { CurrentAuth, JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { AuthClaims } from '../../auth/token.service';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { ProblemController } from '../../common/problem-controller';
import {
  AceptarCondicionesDto,
  AceptarPrecioDto,
  ArmarOfertaDto,
  FacturacionDto,
  MedioPagoViewDto,
  OfertaParamDto,
  OfertaViewDto,
  RegistrarPasajerosDto,
  RevalidacionViewDto,
} from './dto/ofertas.dto';
import { OfertasService } from './ofertas.service';

const { BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, GONE, UNPROCESSABLE_ENTITY, TOO_MANY_REQUESTS, SERVICE_UNAVAILABLE } = HttpStatus;

@ProblemController('ofertas', 'E-commerce · Ofertas y checkout')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OfertasController {
  constructor(private readonly ofertas: OfertasService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(IdempotencyKeyGuard)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Armar una oferta de viaje',
    description:
      'RF-CRT-001: consolida los trayectos elegidos (ida y, si aplica, vuelta), su familia y la composición de pasajeros, fija el mercado y la moneda (RN-01) y retiene el inventario hasta `venceEn`. ' +
      'Requiere sesión: de cliente o de invitado (POST /auth/invitado).',
  })
  @ApiResponse({ status: 201, type: OfertaViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY, TOO_MANY_REQUESTS, SERVICE_UNAVAILABLE)
  armar(@CurrentAuth() auth: AuthClaims, @Headers('idempotency-key') key: string, @Body() dto: ArmarOfertaDto) {
    return this.ofertas.armar(auth, key, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar una oferta vigente', description: 'RF-CRT-004/006: resumen con total persistente, vigencia y lo que falta antes de pagar.' })
  @ApiResponse({ status: 200, type: OfertaViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  obtener(@CurrentAuth() auth: AuthClaims, @Param() params: OfertaParamDto) {
    return this.ofertas.obtener(auth, params.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Descartar la oferta y liberar el inventario' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  cancelar(@CurrentAuth() auth: AuthClaims, @Param() params: OfertaParamDto) {
    return this.ofertas.cancelar(auth, params.id);
  }

  @Post(':id/revalidacion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revalidar precio y disponibilidad', description: 'RF-CRT-003 / RN-12: si el precio cambió, la oferta queda en revisión hasta que el cliente acepte el nuevo total.' })
  @ApiResponse({ status: 200, type: RevalidacionViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, GONE)
  revalidar(@CurrentAuth() auth: AuthClaims, @Param() params: OfertaParamDto) {
    return this.ofertas.revalidar(auth, params.id);
  }

  @Post(':id/aceptacion-precio')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aceptar el nuevo precio tras una revalidación' })
  @ApiResponse({ status: 200, type: OfertaViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, GONE)
  aceptarPrecio(@CurrentAuth() auth: AuthClaims, @Param() params: OfertaParamDto, @Body() dto: AceptarPrecioDto) {
    return this.ofertas.aceptarPrecio(auth, params.id, dto);
  }

  @Put(':id/pasajeros')
  @ApiOperation({
    summary: 'Registrar pasajeros y contacto',
    description:
      'RF-CHK-002..010: valida la composición, normaliza los nombres, comprueba el tipo según la edad el día del primer vuelo (RN-14), duplicados, infantes y el vencimiento del documento. Los datos personales se guardan cifrados.',
  })
  @ApiResponse({ status: 200, type: OfertaViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, GONE, UNPROCESSABLE_ENTITY)
  pasajeros(@CurrentAuth() auth: AuthClaims, @Param() params: OfertaParamDto, @Body() dto: RegistrarPasajerosDto) {
    return this.ofertas.registrarPasajeros(auth, params.id, dto);
  }

  @Put(':id/facturacion')
  @ApiOperation({ summary: 'Registrar los datos de facturación', description: 'RF-CHK-011: los tipos de identificación y su formato salen de la configuración del mercado.' })
  @ApiResponse({ status: 200, type: OfertaViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, GONE, UNPROCESSABLE_ENTITY)
  facturacion(@CurrentAuth() auth: AuthClaims, @Param() params: OfertaParamDto, @Body() dto: FacturacionDto) {
    return this.ofertas.registrarFacturacion(auth, params.id, dto);
  }

  @Post(':id/condiciones')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aceptar las condiciones', description: 'RF-CHK-012: se registra la versión aceptada y la fecha; debe ser la vigente del mercado.' })
  @ApiResponse({ status: 200, type: OfertaViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, GONE)
  condiciones(@CurrentAuth() auth: AuthClaims, @Param() params: OfertaParamDto, @Body() dto: AceptarCondicionesDto) {
    return this.ofertas.aceptarCondiciones(auth, params.id, dto);
  }

  @Get(':id/medios-pago')
  @ApiOperation({ summary: 'Medios de pago habilitados para la oferta', description: 'RF-PAY-001/002: según el mercado y el producto.' })
  @ApiResponse({ status: 200, type: [MedioPagoViewDto] })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  medios(@CurrentAuth() auth: AuthClaims, @Param() params: OfertaParamDto) {
    return this.ofertas.mediosDePago(auth, params.id);
  }
}
