import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { ToUpperTrimmed } from '../../dto/validators';

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
