import { Get, HttpStatus, Param, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiResponse } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { toIso } from '../../common/date.util';
import { ProblemDetailsException } from '../../common/problem-details.exception';
import { ProblemController } from '../../common/problem-controller';
import { MontoDto } from '../catalogo/dto/catalogo.dto';
import { money } from '../common/moneda.util';
import { Factura } from './entities/factura.entity';

export class AdminFacturasQueryDto {
  @ApiPropertyOptional({ enum: ['EMITIDA', 'ANULADA'] })
  @IsIn(['EMITIDA', 'ANULADA'])
  @IsOptional()
  estado?: 'EMITIDA' | 'ANULADA';

  @ApiPropertyOptional({ enum: ['ORDEN', 'EXPERIENCIA'], description: 'Factura de un vuelo (orden) o de una experiencia (reserva externa).' })
  @IsIn(['ORDEN', 'EXPERIENCIA'])
  @IsOptional()
  origen?: 'ORDEN' | 'EXPERIENCIA';

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limite?: number = 50;
}

export class AdminFacturaParamDto {
  @ApiProperty({ example: 'FAC-7K3M9PQ2XA' })
  @IsString()
  @Matches(/^FAC-[A-Z0-9]{10}$/)
  numero: string;
}

export class AdminFacturaDetalleDto {
  @ApiProperty() linea: number;
  @ApiProperty() tipo: string;
  @ApiProperty() concepto: string;
  @ApiProperty() cantidad: number;
  @ApiProperty() precioUnitario: MontoDto;
  @ApiProperty() iva: MontoDto;
  @ApiProperty() total: MontoDto;
}

export class AdminFacturaViewDto {
  @ApiProperty() numeroFactura: string;
  @ApiProperty({ enum: ['EMITIDA', 'ANULADA'] }) estado: string;
  @ApiProperty() emitidaEn: string;
  @ApiProperty({ enum: ['ORDEN', 'EXPERIENCIA'] }) origen: string;
  @ApiProperty({ description: 'Id de la orden o de la reserva de experiencia facturada.' }) referencia: string;
  @ApiProperty() subtotal: MontoDto;
  @ApiProperty() iva: MontoDto;
  @ApiProperty() total: MontoDto;
  @ApiPropertyOptional({ type: [AdminFacturaDetalleDto], description: 'Solo en el detalle.' }) detalles?: AdminFacturaDetalleDto[];
}

export class AdminFacturasPaginaDto {
  @ApiProperty({ type: [AdminFacturaViewDto] }) items: AdminFacturaViewDto[];
  @ApiProperty({ description: 'Suma de los totales de las facturas emitidas del listado.' }) totalEmitido: MontoDto;
}

const vista = (f: Factura, conDetalle: boolean): AdminFacturaViewDto => ({
  numeroFactura: f.numeroFactura,
  estado: f.estado,
  emitidaEn: toIso(f.emitidaEn),
  origen: f.ordenId ? 'ORDEN' : 'EXPERIENCIA',
  referencia: (f.ordenId ?? f.reservaExternaId) as string,
  subtotal: money(f.subtotalMinor, f.moneda),
  iva: money(f.ivaMinor, f.moneda),
  total: money(f.totalMinor, f.moneda),
  ...(conDetalle
    ? {
        detalles: [...(f.detalles ?? [])].sort((a, b) => a.linea - b.linea).map((d) => ({
          linea: d.linea,
          tipo: d.tipo,
          concepto: d.concepto,
          cantidad: d.cantidad,
          precioUnitario: money(d.precioUnitarioMinor, f.moneda),
          iva: money(d.ivaMinor, f.moneda),
          total: money(d.totalMinor, f.moneda),
        })),
      }
    : {}),
});

const { BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND } = HttpStatus;

/** Consola fiscal del back-office: las facturas de vuelos y de experiencias. */
@ProblemController('admin/facturas', 'E-commerce · Back-office')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class FacturacionAdminController {
  constructor(@InjectRepository(Factura) private readonly facturas: Repository<Factura>) {}

  @Get()
  @ApiOperation({ summary: 'Listar facturas (ADMIN)', description: 'Más recientes primero, con filtro por estado y por origen (vuelo o experiencia).' })
  @ApiResponse({ status: 200, type: AdminFacturasPaginaDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN)
  async listar(@Query() query: AdminFacturasQueryDto): Promise<AdminFacturasPaginaDto> {
    const qb = this.facturas.createQueryBuilder('f');
    if (query.estado) qb.andWhere('f.estado = :estado', { estado: query.estado });
    if (query.origen === 'ORDEN') qb.andWhere('f.ordenId IS NOT NULL');
    if (query.origen === 'EXPERIENCIA') qb.andWhere('f.reservaExternaId IS NOT NULL');
    const filas = await qb.orderBy('f.emitidaEn', 'DESC').addOrderBy('f.facturaId', 'DESC').take(query.limite ?? 50).getMany();
    const emitidas = filas.filter((f) => f.estado === 'EMITIDA');
    const moneda = filas[0]?.moneda ?? 'USD';
    return { items: filas.map((f) => vista(f, false)), totalEmitido: money(emitidas.reduce((s, f) => s + f.totalMinor, 0), moneda) };
  }

  @Get(':numero')
  @ApiOperation({ summary: 'Detalle de una factura con sus líneas (ADMIN)' })
  @ApiResponse({ status: 200, type: AdminFacturaViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  async obtener(@Param() params: AdminFacturaParamDto): Promise<AdminFacturaViewDto> {
    const factura = await this.facturas.findOne({ where: { numeroFactura: params.numero }, relations: { detalles: true } });
    if (!factura) throw new ProblemDetailsException(NOT_FOUND, 'NOT_FOUND', 'Invoice not found', `No invoice ${params.numero}.`);
    return vista(factura, true);
  }
}
