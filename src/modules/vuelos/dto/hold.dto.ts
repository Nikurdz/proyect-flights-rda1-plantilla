import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min, ValidateNested } from 'class-validator';
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
