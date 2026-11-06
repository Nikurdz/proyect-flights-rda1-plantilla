import { Body, HttpStatus, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiResponse } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { DataSource } from 'typeorm';
import { CurrentAuth, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import type { AuthClaims } from '../auth/token.service';
import { ApiProblemResponses } from '../common/api-problem-responses';
import { ProblemController } from '../common/problem-controller';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { AuditoriaCambio } from '../ecommerce/mercados/entities/auditoria-cambio.entity';
import { Vuelo } from '../entities/vuelo.entity';
import { FLIGHT_OPERATIONAL_STATUSES, FlightOperationalStatus } from './dto-v2';
import { FlightOpsV2Service } from './flight-ops-v2.service';

export class AdminEstadoVueloParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vueloId: string;
}

export class AdminEstadoVueloDto {
  @ApiProperty({ enum: FLIGHT_OPERATIONAL_STATUSES })
  @IsIn(FLIGHT_OPERATIONAL_STATUSES)
  status: FlightOperationalStatus;

  @ApiPropertyOptional({ format: 'date-time', description: 'Obligatoria si el vuelo queda DELAYED.' })
  @IsOptional()
  @IsISO8601()
  estimatedDepartureAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  estimatedArrivalAt?: string;

  @ApiPropertyOptional({ example: 'B12', description: 'Puerta de embarque.' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  departureGate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason?: string;
}

/**
 * Operational status of a flight from the back office (delay, gate, boarding...): the same operation Booking can call
 * (PATCH /api/v2/vuelos/flights/{n}/status), with the same transitions, and it announces `flight.status_changed`.
 * It lives in the v2 module because it reuses that operation.
 */
@ProblemController('admin/vuelos', 'E-commerce · Back-office')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminEstadoVueloController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly flightOps: FlightOpsV2Service,
  ) {}

  @Patch(':vueloId/estado')
  @ApiOperation({ summary: 'Estado operativo de un vuelo: retraso, puerta, embarque... (ADMIN)', description: 'Transiciones válidas como en la API v2; un vuelo DELAYED exige la salida estimada. Publica flight.status_changed.' })
  @ApiResponse({ status: 200, description: 'Estado del vuelo tras el cambio.' })
  @ApiProblemResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  async cambiarEstado(@CurrentAuth() auth: AuthClaims, @Param() params: AdminEstadoVueloParamDto, @Body() body: AdminEstadoVueloDto) {
    const vuelo = await this.dataSource.manager.findOneBy(Vuelo, { id: params.vueloId });
    if (!vuelo) throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Vuelo no encontrado', `No existe el vuelo ${params.vueloId}.`);
    const date = new Date(vuelo.fechaSalida).toISOString().slice(0, 10);
    const result = await this.flightOps.updateStatus(vuelo.codigoVuelo, { ...body, date });
    await this.dataSource.manager.save(
      this.dataSource.manager.create(AuditoriaCambio, { entidad: 'vuelo', entidadId: vuelo.id, actorId: auth.ownerId, accion: 'ESTADO', antes: { estado: vuelo.estado }, despues: { ...body } }),
    );
    return result;
  }
}
