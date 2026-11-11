import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { IsDateOnly } from '../../dto/validators';
import { BOOKING_STATUSES, BookingStatus } from '../../entities/booking.entity';

/** Filters of the reconciliation of the sales of a partner (Booking). The days are Ecuador calendar days. */
export class ConciliacionQueryDto {
  @ApiPropertyOptional({ format: 'date', description: 'Ventas desde este día de Ecuador (inclusive).' })
  @IsDateOnly()
  @IsOptional()
  desde?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Ventas hasta este día de Ecuador (inclusive).' })
  @IsDateOnly()
  @IsOptional()
  hasta?: string;

  @ApiPropertyOptional({ example: 'booking-prototipo', description: 'Socio (client id OAuth2).' })
  @IsString()
  @MaxLength(60)
  @Matches(/^[A-Za-z0-9_-]+$/)
  @IsOptional()
  partnerId?: string;

  @ApiPropertyOptional({ enum: BOOKING_STATUSES })
  @IsIn(BOOKING_STATUSES)
  @IsOptional()
  estado?: BookingStatus;

  @ApiPropertyOptional({ description: 'Solo las ventas cuyo IVA no cuadra con el 15 %.' })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  soloAlertas?: boolean;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pagina?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limite?: number = 25;
}
