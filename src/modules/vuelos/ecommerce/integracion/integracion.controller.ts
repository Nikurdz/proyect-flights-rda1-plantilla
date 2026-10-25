import { Body, Delete, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { IdempotencyKeyGuard } from '../../../../common/guards/idempotency-key.guard';
import { CurrentAuth, JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import type { AuthClaims } from '../../auth/token.service';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { ProblemController } from '../../common/problem-controller';
import { VUELOS_CONFIG, VuelosConfig } from '../../common/vuelos-config';
import { Inject } from '@nestjs/common';
import {
  ActualizarProveedorDto,
  CancelarReservaExternaDto,
  ExperienciaParamDto,
  ExperienciaViewDto,
  ExperienciasPaginaViewDto,
  ExperienciasQueryDto,
  ProveedorParamDto,
  ProveedorViewDto,
  RegistrarProveedorDto,
  ReservaExternaParamDto,
  ReservaExternaViewDto,
  ReservarExperienciaDto,
  ReservasExternasPaginaViewDto,
  SaludViewDto,
  SincronizacionViewDto,
} from './dto/integracion.dto';
import { ExperienciasService } from './experiencias.service';
import { ProveedoresService, SaludActual } from './proveedores.service';
import { ReservasExternasService } from './reservas-externas.service';

const { BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY, PAYMENT_REQUIRED, TOO_MANY_REQUESTS, BAD_GATEWAY, SERVICE_UNAVAILABLE } = HttpStatus;

const saludVista = (s: SaludActual): SaludViewDto => ({ estado: s.estado, latenciaMs: s.latenciaMs, detalle: s.detalle, comprobadoEn: s.comprobadoEn ? s.comprobadoEn.toISOString() : null });

/** Microservicios e integración → Gestión de Proveedores. */
@ProblemController('admin/proveedores', 'E-commerce · Proveedores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class ProveedoresController {
  constructor(
    private readonly proveedores: ProveedoresService,
    private readonly reservas: ReservasExternasService,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar proveedores con su semáforo (ADMIN)', description: 'Estado de la última comprobación (UP, DEGRADADO, DOWN), latencia en ms, estado del circuit breaker y productos sincronizados.' })
  @ApiResponse({ status: 200, type: [ProveedorViewDto] })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN)
  async listar() {
    return (await this.proveedores.listar()).map((p) => ({ ...p, salud: saludVista(p.salud) }));
  }

  @Post()
  @ApiOperation({
    summary: 'Registrar un proveedor (ADMIN)',
    description: 'Nombre, equipo, URL base (con o sin /api/v2) y tipo de servicio. La URL pasa la defensa SSRF: https público (http y redes privadas solo con PROVEEDORES_ALLOW_PRIVATE_HOSTS fuera de producción).',
  })
  @ApiResponse({ status: 201, type: ProveedorViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, CONFLICT)
  async registrar(@CurrentAuth() auth: AuthClaims, @Body() body: RegistrarProveedorDto) {
    const p = await this.proveedores.crear(auth.ownerId, body);
    return { ...p, salud: saludVista(p.salud) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un proveedor (ADMIN)' })
  @ApiResponse({ status: 200, type: ProveedorViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  async obtener(@Param() params: ProveedorParamDto) {
    const p = await this.proveedores.obtener(params.id);
    return { ...p, salud: saludVista(p.salud) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar o apagar un proveedor (ADMIN)', description: 'Con `activo: false` (kill-switch) no se le llama, su catálogo se oculta y no se aceptan reservas; `activo: true` lo reactiva y cierra su circuito.' })
  @ApiResponse({ status: 200, type: ProveedorViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  async actualizar(@CurrentAuth() auth: AuthClaims, @Param() params: ProveedorParamDto, @Body() body: ActualizarProveedorDto) {
    const p = await this.proveedores.actualizar(auth.ownerId, params.id, body);
    return { ...p, salud: saludVista(p.salud) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un proveedor (ADMIN)', description: 'Solo si nunca vendió nada; si no, 409 PROVIDER_IN_USE y hay que apagarlo.' })
  @ApiResponse({ status: 204 })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  async eliminar(@CurrentAuth() auth: AuthClaims, @Param() params: ProveedorParamDto): Promise<void> {
    await this.proveedores.eliminar(auth.ownerId, params.id);
  }

  @Post(':id/ping')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '🔄 Comprobar el proveedor ahora (ADMIN)', description: 'Llama a su healthcheck, guarda el resultado y devuelve el semáforo con la latencia en ms.' })
  @ApiResponse({ status: 200, type: SaludViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  async ping(@Param() params: ProveedorParamDto) {
    return saludVista(await this.proveedores.ping(params.id));
  }

  @Get(':id/salud')
  @ApiOperation({ summary: 'Historial de comprobaciones (ADMIN)' })
  @ApiResponse({ status: 200, type: [SaludViewDto] })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  async salud(@Param() params: ProveedorParamDto) {
    return (await this.proveedores.historialSalud(params.id)).map(saludVista);
  }

  @Post(':id/sincronizar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '📥 Sincronizar el catálogo del proveedor (ADMIN)', description: 'Importa el catálogo del socio a la caché local que ven los clientes (Experiencias). Lo que el socio deja de listar queda oculto.' })
  @ApiResponse({ status: 200, type: SincronizacionViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY, SERVICE_UNAVAILABLE)
  sincronizar(@CurrentAuth() auth: AuthClaims, @Param() params: ProveedorParamDto) {
    return this.proveedores.sincronizar(auth.ownerId, params.id, this.config.integraciones.syncMaxItems);
  }

  @Get('/reservas/todas')
  @ApiOperation({ summary: 'Reservas de experiencias de todos los clientes (ADMIN)' })
  @ApiResponse({ status: 200, type: ReservasExternasPaginaViewDto })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN)
  async reservasTodas() {
    return { items: await this.reservas.listarTodas() };
  }
}

@ProblemController('experiencias', 'E-commerce · Experiencias')
export class ExperienciasController {
  constructor(
    private readonly experiencias: ExperienciasService,
    private readonly reservas: ReservasExternasService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Catálogo de experiencias', description: 'Productos de los proveedores sincronizados (atracciones, tours…). Público. Solo los de proveedores encendidos.' })
  @ApiResponse({ status: 200, type: ExperienciasPaginaViewDto })
  @ApiProblemResponses(BAD_REQUEST)
  listar(@Query() query: ExperienciasQueryDto) {
    return this.experiencias.listar(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una experiencia' })
  @ApiResponse({ status: 200, type: ExperienciaViewDto })
  @ApiProblemResponses(BAD_REQUEST, NOT_FOUND)
  obtener(@Param() params: ExperienciaParamDto) {
    return this.experiencias.obtener(params.id);
  }

  @Post(':id/reservas')
  @UseGuards(JwtAuthGuard, IdempotencyKeyGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Reservar y pagar una experiencia',
    description:
      'Saga: autoriza el pago (antifraude + pasarela) → reserva en la API del proveedor → confirma y factura aquí (una transacción) → captura el cobro. ' +
      'Si el proveedor rechaza o falla se anula la autorización (no se cobra); si falla la confirmación local se cancela la reserva del proveedor. Un reintento con la misma Idempotency-Key devuelve el resultado original.',
  })
  @ApiResponse({ status: 201, type: ReservaExternaViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY, PAYMENT_REQUIRED, TOO_MANY_REQUESTS, BAD_GATEWAY, SERVICE_UNAVAILABLE)
  async reservar(@CurrentAuth() auth: AuthClaims, @Param() params: ExperienciaParamDto, @Headers('idempotency-key') key: string, @Body() dto: ReservarExperienciaDto, @Res({ passthrough: true }) res: Response) {
    const resultado = await this.reservas.reservar(auth, params.id, dto, key);
    res.status(resultado.status);
    if (resultado.status >= 400) res.type('application/problem+json');
    return resultado.body;
  }
}

@ProblemController('reservas-externas', 'E-commerce · Experiencias')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReservasExternasController {
  constructor(private readonly reservas: ReservasExternasService) {}

  @Get()
  @ApiOperation({ summary: 'Mis reservas de experiencias' })
  @ApiResponse({ status: 200, type: ReservasExternasPaginaViewDto })
  @ApiProblemResponses(UNAUTHORIZED)
  async listar(@CurrentAuth() auth: AuthClaims) {
    return { items: await this.reservas.listarPropias(auth) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una reserva de experiencia (solo el dueño)' })
  @ApiResponse({ status: 200, type: ReservaExternaViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, NOT_FOUND)
  obtener(@CurrentAuth() auth: AuthClaims, @Param() params: ReservaExternaParamDto) {
    return this.reservas.obtenerPropia(auth, params.id);
  }

  @Post(':id/cancelar')
  @UseGuards(IdempotencyKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Cancelar una reserva de experiencia', description: 'Cancela primero en el proveedor (si no puede, no cambia nada) y devuelve el pago. Solo experiencias con cancelación gratuita.' })
  @ApiResponse({ status: 200, type: ReservaExternaViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, NOT_FOUND, CONFLICT, SERVICE_UNAVAILABLE)
  async cancelar(@CurrentAuth() auth: AuthClaims, @Param() params: ReservaExternaParamDto, @Headers('idempotency-key') key: string, @Body() dto: CancelarReservaExternaDto, @Res({ passthrough: true }) res: Response) {
    const resultado = await this.reservas.cancelar(auth, params.id, dto, key);
    res.status(resultado.status);
    return resultado.body;
  }
}
