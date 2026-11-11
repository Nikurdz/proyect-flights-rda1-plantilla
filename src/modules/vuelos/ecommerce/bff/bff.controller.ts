import { Get, HttpStatus, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentAuth, JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import type { AuthClaims } from '../../auth/token.service';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { ProblemController } from '../../common/problem-controller';
import { HistorialOrdenesQueryDto, OrdenParamDto } from '../ordenes/dto/ordenes.dto';
import { BffOrdenesService } from './bff-ordenes.service';
import { ExpedienteOrdenDto, MovilOrdenDto, MovilOrdenesPaginaDto, WebOrdenDto } from './dto/bff.dto';

const { BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND } = HttpStatus;

/** Compact views for the mobile app: small answers, no personal data beyond the traveller's own. */
@ProblemController('movil/ordenes', 'E-commerce · BFF móvil')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MovilOrdenesController {
  constructor(private readonly bff: BffOrdenesService) {}

  @Get()
  @ApiOperation({
    summary: 'Mis órdenes (resumen móvil)',
    description: 'Una fila mínima por orden (número, estado, total, ruta, salida y pasajeros), más recientes primero y paginado por cursor. Solo cuentas con sesión; los invitados reciben 403.',
  })
  @ApiResponse({ status: 200, type: MovilOrdenesPaginaDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN)
  listar(@CurrentAuth() auth: AuthClaims, @Query() query: HistorialOrdenesQueryDto) {
    return this.bff.movilListado(auth, query);
  }

  @Get(':numero')
  @ApiOperation({
    summary: 'Detalle de una orden propia (móvil)',
    description: 'Tramos, pasajeros con su billete, asientos y QR, y las acciones disponibles ahora. Sin contacto, pago ni historial. Una orden ajena responde 404.',
  })
  @ApiResponse({ status: 200, type: MovilOrdenDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, NOT_FOUND)
  detalle(@CurrentAuth() auth: AuthClaims, @Param() params: OrdenParamDto) {
    return this.bff.movilDetalle(auth, params.numero);
  }
}

/** The customer's complete view for the web app. */
@ProblemController('web/ordenes', 'E-commerce · BFF web')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WebOrdenesController {
  constructor(private readonly bff: BffOrdenesService) {}

  @Get(':numero')
  @ApiOperation({
    summary: 'Detalle completo de una orden propia (web)',
    description: 'La vista de la orden más el desglose de importes, la factura, el estado actual de cada vuelo y las acciones con su enlace. Una orden ajena responde 404.',
  })
  @ApiResponse({ status: 200, type: WebOrdenDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, NOT_FOUND)
  detalle(@CurrentAuth() auth: AuthClaims, @Param() params: OrdenParamDto) {
    return this.bff.webDetalle(auth, params.numero);
  }
}

/** The back-office file of an order: everything, with the audit trail, and the contact always masked. */
@ProblemController('admin/ordenes', 'E-commerce · BFF back-office')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class ExpedienteOrdenesController {
  constructor(private readonly bff: BffOrdenesService) {}

  @Get(':numero/expediente')
  @ApiOperation({
    summary: 'Expediente de una orden (ADMIN)',
    description:
      'Vista de cualquier cliente con pago (estado y referencia), factura, estado de vuelos, transiciones posibles y auditoría: sagas con sus pasos y hasta 50 eventos con su correlation id. El contacto va enmascarado.',
  })
  @ApiResponse({ status: 200, type: ExpedienteOrdenDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  expediente(@Param() params: OrdenParamDto) {
    return this.bff.expediente(params.numero);
  }
}
