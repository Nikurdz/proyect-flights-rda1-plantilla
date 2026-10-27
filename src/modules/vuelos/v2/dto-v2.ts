import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { VUELOS_EVENT_NAMES } from '../common/cloud-events';
import { PaymentReferenceDto } from '../dto/booking.dto';
import { CABIN_CLASSES } from '../dto/enums';
import { IsDateOnly, ToUpperTrimmed } from '../dto/validators';

export const FLIGHT_OPERATIONAL_STATUSES = ['SCHEDULED', 'BOARDING', 'DEPARTED', 'DELAYED', 'ARRIVED', 'CANCELLED', 'DIVERTED'] as const;
export type FlightOperationalStatus = (typeof FLIGHT_OPERATIONAL_STATUSES)[number];

// ------------------------------------------------------------------------------------------------ seats

export class SeatChangeItemDto {
  @ApiProperty({ description: 'passengerId as sent when the booking was created.' })
  @IsString()
  @MaxLength(100)
  passengerId: string;

  @ApiProperty({ format: 'uuid', description: 'segmentId as returned by /search.' })
  @IsUUID()
  segmentId: string;

  @ApiProperty({ example: '14C', pattern: '^\\d{1,3}[A-F]$' })
  @ToUpperTrimmed()
  @Matches(/^\d{1,3}[A-F]$/)
  seatNumber: string;
}

export class SeatChangeRequestDto {
  @ApiProperty({ type: [SeatChangeItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SeatChangeItemDto)
  seats: SeatChangeItemDto[];

  @ApiPropertyOptional({ type: PaymentReferenceDto, description: 'Only when the seat has a cost; seats are free in this phase.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentReferenceDto)
  payment?: PaymentReferenceDto;
}

// ------------------------------------------------------------------------------------------------ flights

export class FlightStatusUpdateRequestDto {
  @ApiProperty({ format: 'date' })
  @IsDateOnly()
  date: string;

  @ApiProperty({ enum: FLIGHT_OPERATIONAL_STATUSES })
  @IsIn(FLIGHT_OPERATIONAL_STATUSES)
  status: FlightOperationalStatus;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  estimatedDepartureAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  estimatedArrivalAt?: string;

  @ApiPropertyOptional({ example: 'B12' })
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

export class OperationsQueryDto {
  @ApiProperty({ format: 'date' })
  @IsDateOnly()
  date: string;

  @ApiPropertyOptional({ pattern: '^[A-Z]{3}$' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z]{3}$/)
  @IsOptional()
  origin?: string;

  @ApiPropertyOptional({ pattern: '^[A-Z]{3}$' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z]{3}$/)
  @IsOptional()
  destination?: string;

  @ApiPropertyOptional({ enum: FLIGHT_OPERATIONAL_STATUSES })
  @IsIn(FLIGHT_OPERATIONAL_STATUSES)
  @IsOptional()
  status?: FlightOperationalStatus;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @Transform(({ value }) => (value === undefined ? value : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  cursor?: string;
}

// ------------------------------------------------------------------------------------------------ events and promotions

export class EventsQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @Transform(({ value }) => (value === undefined ? value : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'evt-vue-000120' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  after?: string;

  @ApiPropertyOptional({ enum: VUELOS_EVENT_NAMES })
  @IsIn(VUELOS_EVENT_NAMES)
  @IsOptional()
  type?: string;
}

export class PromocionesContratoRequestDto {
  @ApiProperty()
  @IsBoolean()
  permite_promociones: boolean;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentaje_descuento_maximo: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @Matches(/^[A-Z]{3}$/, { each: true })
  destinos_habilitados?: string[];

  @ApiPropertyOptional({ type: [String], example: ['UIO-GYE'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @Matches(/^[A-Z]{3}-[A-Z]{3}$/, { each: true })
  rutas_habilitadas?: string[];

  @ApiPropertyOptional({ type: [String], enum: CABIN_CLASSES })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(CABIN_CLASSES, { each: true })
  cabinas_habilitadas?: string[];

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateOnly()
  vigencia_hasta?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  condiciones_combo?: string;
}

// ------------------------------------------------------------------------------------------------ webhooks

export class WebhookSubscriptionV2Dto {
  @ApiProperty({ format: 'uri' })
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true, require_tld: false })
  @MaxLength(500)
  url: string;

  @ApiProperty({ type: [String], enum: VUELOS_EVENT_NAMES })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(VUELOS_EVENT_NAMES, { each: true })
  events: string[];

  @ApiProperty({ minLength: 16, writeOnly: true })
  @IsString()
  @MinLength(16)
  @MaxLength(200)
  secret: string;
}
