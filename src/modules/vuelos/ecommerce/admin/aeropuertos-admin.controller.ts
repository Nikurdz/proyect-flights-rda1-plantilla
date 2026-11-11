import { Body, Get, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentAuth, JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import type { AuthClaims } from '../../auth/token.service';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { ProblemController } from '../../common/problem-controller';
import { AdminAeropuertoViewDto, AdminAeropuertosPaginaDto, AdminAeropuertosQueryDto, AdminCrearAeropuertoDto } from './admin-aeropuertos.dto';
import { AeropuertosAdminService } from './aeropuertos-admin.service';

const { BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, CONFLICT, UNPROCESSABLE_ENTITY } = HttpStatus;

/** Airport catalogue of the ADMIN: see the codes the system knows and create a new one (with an explicit confirmation). */
@ProblemController('admin/aeropuertos', 'E-commerce · Back-office')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AeropuertosAdminController {
  constructor(private readonly aeropuertos: AeropuertosAdminService) {}

  @Get()
  @ApiOperation({ summary: 'Listar aeropuertos (ADMIN)', description: 'Catálogo completo con búsqueda por código, ciudad o nombre, filtro por país y el número de vuelos que usan cada aeropuerto.' })
  @ApiResponse({ status: 200, type: AdminAeropuertosPaginaDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN)
  listar(@Query() query: AdminAeropuertosQueryDto) {
    return this.aeropuertos.listar(query);
  }

  @Post()
  @ApiOperation({
    summary: 'Crear un código de aeropuerto (ADMIN)',
    description:
      'Agrega un aeropuerto al catálogo para poder crear vuelos desde y hacia él. Exige `confirmar: true` (422 si falta). El código IATA son tres letras y la zona horaria debe ser una zona IANA real. 409 si el código ya existe. Queda en la auditoría administrativa.',
  })
  @ApiResponse({ status: 201, type: AdminAeropuertoViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, CONFLICT, UNPROCESSABLE_ENTITY)
  crear(@CurrentAuth() auth: AuthClaims, @Body() body: AdminCrearAeropuertoDto) {
    return this.aeropuertos.crear(auth.ownerId, body);
  }
}
