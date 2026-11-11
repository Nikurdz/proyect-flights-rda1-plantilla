import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { IsDateOnly } from '../../dto/validators';

export const FUENTES_TRAZA = ['evento', 'saga', 'admin'] as const;
export type FuenteTraza = (typeof FUENTES_TRAZA)[number];

/** Filters of the unified timeline. The days are Ecuador calendar days (inclusive). */
export class TrazabilidadQueryDto {
  @ApiPropertyOptional({ description: 'Todo lo que hizo una misma petición (X-Correlation-Id / correlation_id).' })
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9._-]+$/)
  @IsOptional()
  correlationId?: string;

  @ApiPropertyOptional({ description: 'Número de orden (ORD-…) o localizador (PNR): trae toda la traza de esa compra o reserva.' })
  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9-]+$/)
  @IsOptional()
  numero?: string;

  @ApiPropertyOptional({ description: 'Entidad (orden, booking, pago, oferta, hold, vuelo, cliente…); con `id`, filtra por el agregado.' })
  @IsString()
  @MaxLength(30)
  @IsOptional()
  entidad?: string;

  @ApiPropertyOptional({ description: 'Identificador del agregado de la entidad.' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  id?: string;

  @ApiPropertyOptional({ description: 'Quién lo hizo: cuenta (sub verificado) o partner:<cliente>[:user:<id>].' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  actor?: string;

  @ApiPropertyOptional({ description: 'Tipo exacto de evento (booking.cancelled), de saga (COMPRA) o de cambio administrativo (vuelo.CREAR).' })
  @IsString()
  @MaxLength(60)
  @IsOptional()
  tipo?: string;

  @ApiPropertyOptional({ enum: FUENTES_TRAZA })
  @IsIn(FUENTES_TRAZA)
  @IsOptional()
  fuente?: FuenteTraza;

  @ApiPropertyOptional({ format: 'date' })
  @IsDateOnly()
  @IsOptional()
  desde?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsDateOnly()
  @IsOptional()
  hasta?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Cursor: solo lo anterior a este instante (el `siguiente` de la página previa).' })
  @IsISO8601()
  @IsOptional()
  antes?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limite?: number;
}

/** Window of the general map. */
export class MapaQueryDto {
  @ApiPropertyOptional({ format: 'date' })
  @IsDateOnly()
  @IsOptional()
  desde?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsDateOnly()
  @IsOptional()
  hasta?: string;
}

/** What the flow of one request or purchase is drawn from: a correlation id or a number. */
export class FlujoQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9._-]+$/)
  @IsOptional()
  correlationId?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9-]+$/)
  @IsOptional()
  numero?: string;
}
