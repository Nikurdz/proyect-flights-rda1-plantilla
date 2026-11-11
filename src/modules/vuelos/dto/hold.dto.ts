import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min, ValidateNested } from 'class-validator';
import { SeatAssignmentDto } from './booking.dto';
import { CABIN_CLASSES } from './enums';
import { MoneyAmountDto, PassengerBreakdownDto } from './search.dto';
import { ToUpperTrimmed } from './validators';

export class ItinerarySelectionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  itineraryId: string;

  @ApiProperty({ enum: CABIN_CLASSES })
  @IsIn(CABIN_CLASSES)
  cabinClass: string;

  @ApiProperty({ example: 'LIGHT' })
  @ToUpperTrimmed()
  @IsString()
  @Matches(/^[A-Z_]{2,20}$/)
  fareBrand: string;
}

export class HoldRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  offerId: string;

  @ApiProperty({ type: [ItinerarySelectionDto], minItems: 1, maxItems: 6 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => ItinerarySelectionDto)
  itinerarySelections: ItinerarySelectionDto[];

  @ApiProperty()
  @ValidateNested()
  @Type(() => PassengerBreakdownDto)
  passengersBreakdown: PassengerBreakdownDto;

  @ApiPropertyOptional({ minimum: 5, maximum: 30, default: 15, description: 'Minutos que dura el bloqueo (contrato v2). Sin él, HOLD_TTL_MINUTES.' })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(30)
  ttlMinutes?: number;

  @ApiPropertyOptional({
    type: [SeatAssignmentDto],
    maxItems: 300,
    description:
      'Asientos que el bloqueo aparta mientras está HELD (se ven `HELD` en el seatmap). Como mucho uno por pasajero con asiento y tramo. 409 SEAT_TAKEN si alguno ya está vendido o apartado por otro bloqueo activo.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300) // 6 legs x the highest MAX_PASSENGERS_PER_ORDER; the real cap is one seat per seat-taking passenger and leg
  @ValidateNested({ each: true })
  @Type(() => SeatAssignmentDto)
  assignedSeats?: SeatAssignmentDto[];
}

export class HoldResponseDto {
  @ApiProperty({ format: 'uuid' })
  holdId: string;
  @ApiProperty({ enum: ['HELD'] })
  status: string;
  @ApiProperty()
  expiresAt: string;
  @ApiProperty()
  ttlMinutes: number;
  @ApiProperty()
  lockedPrice: MoneyAmountDto;
}

export class HoldStatusResponseDto {
  @ApiProperty({ enum: ['HELD', 'RELEASED', 'EXPIRED', 'CONSUMED'] })
  status: string;
  @ApiProperty()
  expiresAt: string;
  @ApiProperty()
  remainingSeconds: number;
  @ApiProperty()
  lockedPrice: MoneyAmountDto;
}
