import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsArray, ValidateNested } from 'class-validator';
import { MoneyAmountDto, PassengerBreakdownDto } from './search.dto';

export class ItinerarySelectionDto {
  @ApiProperty()
  @IsString()
  itineraryId: string;

  @ApiProperty({ enum: ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'] })
  @IsString()
  cabinClass: string;

  @ApiProperty()
  @IsString()
  fareBrand: string;
}

export class HoldRequestDto {
  @ApiProperty()
  @IsString()
  offerId: string;

  @ApiProperty({ type: [ItinerarySelectionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItinerarySelectionDto)
  itinerarySelections: ItinerarySelectionDto[];

  @ApiProperty()
  @ValidateNested()
  @Type(() => PassengerBreakdownDto)
  passengersBreakdown: PassengerBreakdownDto;
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
