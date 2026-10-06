import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { IsDateOnly, ToUpperTrimmed } from '../../dto/validators';
import { OrdenViewDto } from '../ordenes/dto/ordenes.dto';

const ESTADOS = ['PENDIENTE_PAGO', 'PAGO_EN_VERIFICACION', 'PAGADA', 'EMITIDA', 'FALLIDA_COMPENSADA', 'MODIFICADA', 'DEVOLUCION_EN_CURSO', 'REEMBOLSADA', 'EN_VIAJE', 'COMPLETADA', 'EXPIRADA'] as const;

class PaginationDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 25;

  @ApiPropertyOptional({ description: 'Cursor opaco de la página anterior (nextCursor).' })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  cursor?: string;
}

export class AdminOrdenesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ESTADOS })
  @IsIn(ESTADOS)
  @IsOptional()
  estado?: string;

  @ApiPropertyOptional({ example: 'ORD-7K3M9PQ2XA' })
  @ToUpperTrimmed()
  @Matches(/^ORD-[A-Z0-9]{10}$/)
  @IsOptional()
  numero?: string;

  @ApiPropertyOptional({ example: 'ABC123' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z0-9]{6}$/)
  @IsOptional()
  pnr?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Creadas desde este día (UTC).' })
  @IsDateOnly()
  @IsOptional()
  desde?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Creadas hasta este día (UTC, inclusive).' })
  @IsDateOnly()
  @IsOptional()
  hasta?: string;
}

export class AdminOrdenViewDto extends OrdenViewDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Cuenta del comprador; null si compró como invitado.' })
  clienteId: string | null;
  @ApiProperty({ enum: ['cliente', 'invitado'] })
  comprador: 'cliente' | 'invitado';
  @ApiProperty()
  canal: string;
}

export class AdminOrdenesPaginaDto {
  @ApiProperty({ type: [AdminOrdenViewDto] }) items: AdminOrdenViewDto[];
  @ApiPropertyOptional() nextCursor?: string;
}

export class AdminVuelosQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'BOG' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z]{3}$/)
  @IsOptional()
  origen?: string;

  @ApiPropertyOptional({ example: 'SCL' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z]{3}$/)
  @IsOptional()
  destino?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Día de salida (UTC). Sin fecha: desde hoy.' })
  @IsDateOnly()
  @IsOptional()
  fecha?: string;

  @ApiPropertyOptional({ example: 'LA800' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z0-9]{2}\d{1,4}$/)
  @IsOptional()
  vuelo?: string;
}

export class AdminVueloViewDto {
  @ApiProperty({ format: 'uuid' }) vueloId: string;
  @ApiProperty({ example: 'LA800' }) codigoVuelo: string;
  @ApiProperty() aerolinea: string;
  @ApiProperty({ example: 'BOG' }) origen: string;
  @ApiProperty({ example: 'SCL' }) destino: string;
  @ApiProperty() salida: string;
  @ApiProperty() llegada: string;
  @ApiProperty() duracionMinutos: number;
  @ApiProperty({ description: 'Tarifa base por adulto en USD, antes de familia e impuestos.' }) precioBaseUsd: number;
  @ApiProperty() asientosDisponibles: number;
  @ApiProperty() capacidadTotal: number;
}

export class AdminVuelosPaginaDto {
  @ApiProperty({ type: [AdminVueloViewDto] }) items: AdminVueloViewDto[];
  @ApiPropertyOptional() nextCursor?: string;
}
