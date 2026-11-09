import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { ToUpperTrimmed } from '../../dto/validators';
import { BOOKING_STATUSES, BookingStatus } from '../../entities/booking.entity';

/** A date (YYYY-MM-DD) or a UTC date-time (YYYY-MM-DDTHH:mm[:ss[.sss]][Z]). */
const UTC_BOUND = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z?)?$/;

export class ReservasQueryDto {
  @ApiPropertyOptional({ example: 'ABC123', description: 'Localizador (PNR).' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z0-9]{6}$/)
  @IsOptional()
  pnr?: string;

  @ApiPropertyOptional({ example: 'ORD-BKP-20261104-000123', description: 'Orden del socio (salesChannel.partnerOrderId).' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  partnerOrderId?: string;

  @ApiPropertyOptional({ example: 'PAY-BKP-20261104-000123', description: 'Referencia del pago.' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  paymentReference?: string;

  @ApiPropertyOptional({ enum: ['SOCIO', 'DIRECTO'], description: 'SOCIO: vendida por un socio (Booking) con OAuth2; DIRECTO: vendida por la web de la aerolínea.' })
  @IsIn(['SOCIO', 'DIRECTO'])
  @IsOptional()
  canal?: 'SOCIO' | 'DIRECTO';

  @ApiPropertyOptional({ example: '1710034065', description: 'Documento del pasajero (cédula o pasaporte); se busca por su índice ciego, sin descifrar.' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  documento?: string;

  @ApiPropertyOptional({ enum: ['NATIONAL_ID', 'PASSPORT'], default: 'NATIONAL_ID' })
  @IsIn(['NATIONAL_ID', 'PASSPORT'])
  @IsOptional()
  tipoDocumento?: string;

  @ApiPropertyOptional({ example: 'EC', default: 'EC', description: 'Nacionalidad del documento (2 letras).' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z]{2}$/)
  @IsOptional()
  nacionalidad?: string;

  @ApiPropertyOptional({ enum: BOOKING_STATUSES, description: 'Estado de la reserva (CONFIRMED, CANCELLED…).' })
  @IsIn(BOOKING_STATUSES)
  @IsOptional()
  estado?: BookingStatus;

  @ApiPropertyOptional({ example: '2026-11-08', description: 'Creadas desde (fecha o fecha-hora UTC, inclusive).' })
  @Matches(UTC_BOUND)
  @IsOptional()
  desde?: string;

  @ApiPropertyOptional({ example: '2026-11-08', description: 'Creadas hasta (una fecha cubre el día UTC completo).' })
  @Matches(UTC_BOUND)
  @IsOptional()
  hasta?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pagina?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limite?: number = 20;
}

export class ReservaParamDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  bookingId: string;
}
