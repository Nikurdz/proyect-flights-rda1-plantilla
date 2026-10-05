import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';
import { IsDateOnly, ToUpperTrimmed } from './validators';

export class ItinerarySearchDto {
  @ApiProperty({ example: 'UIO', pattern: '^[A-Z]{3}$' })
  @ToUpperTrimmed()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  origin: string;

  @ApiProperty({ example: 'JFK', pattern: '^[A-Z]{3}$' })
  @ToUpperTrimmed()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  destination: string;

  @ApiProperty({ example: '2026-12-01', format: 'date' })
  @IsDateOnly()
  departureDate: string;
}

export class PassengerBreakdownDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 50, default: 1 })
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  adults?: number = 1;

  @ApiPropertyOptional({ example: 0, minimum: 0, maximum: 50, default: 0 })
  @IsInt()
  @Min(0)
  @Max(50)
  @IsOptional()
  youths?: number = 0;

  @ApiPropertyOptional({ example: 0, minimum: 0, maximum: 50, default: 0 })
  @IsInt()
  @Min(0)
  @Max(50)
  @IsOptional()
  children?: number = 0;

  @ApiPropertyOptional({ example: 0, minimum: 0, maximum: 50, default: 0 })
  @IsInt()
  @Min(0)
  @Max(50)
  @IsOptional()
  infants?: number = 0;
}

export class SearchRequestDto {
  @ApiProperty({ type: [ItinerarySearchDto], minItems: 1, maxItems: 6 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => ItinerarySearchDto)
  itineraries: ItinerarySearchDto[];

  @ApiProperty()
  @ValidateNested()
  @Type(() => PassengerBreakdownDto)
  passengers: PassengerBreakdownDto;
}

// --- Response shapes (output-only: no class-validator decorators needed) ---

const MONEY = '^\\d+\\.\\d{2}$';

export class MoneyAmountDto {
  @ApiProperty({ example: 'USD', pattern: '^[A-Z]{3}$' })
  currency: string;
  @ApiPropertyOptional({ example: '100.00', pattern: MONEY })
  baseFare?: string;
  @ApiPropertyOptional({ example: '20.00', pattern: MONEY })
  taxes?: string;
  @ApiProperty({ example: '120.00', pattern: MONEY })
  total: string;
}

export class FlightEndpointDto {
  @ApiProperty({ example: 'BOG' })
  iataCode: string;
  @ApiProperty({ example: '2026-10-15T08:00:00.000Z' })
  at: string;
  @ApiPropertyOptional({ nullable: true })
  terminal: string | null;
}

export class FlightSegmentDto {
  @ApiProperty()
  segmentId: string;
  @ApiProperty({ example: 'AV123' })
  flightNumber: string;
  @ApiProperty()
  departure: FlightEndpointDto;
  @ApiProperty()
  arrival: FlightEndpointDto;
  @ApiProperty()
  marketingCarrier: string;
  @ApiProperty()
  operatingCarrier: string;
  @ApiPropertyOptional({ nullable: true })
  aircraft: string | null;
  @ApiPropertyOptional({ nullable: true })
  durationMinutes: number | null;
  @ApiPropertyOptional({ nullable: true, enum: ['SCHEDULED', 'BOARDING', 'DEPARTED', 'DELAYED', 'ARRIVED', 'CANCELLED', 'DIVERTED'] })
  status: string | null;
}

export class BaggageAllowanceDto {
  @ApiProperty()
  personalItemIncluded: boolean;
  @ApiProperty()
  carryOnIncluded: number;
  @ApiProperty()
  checkedBaggageIncluded: number;
}

export class FareRulesDto {
  @ApiProperty()
  isRefundable: boolean;
  @ApiProperty()
  isChangeable: boolean;
}

export class PricePerPassengerTypeDto {
  @ApiProperty({ enum: ['ADULT', 'YOUTH', 'CHILD', 'INFANT'] })
  passengerType: string;
  @ApiProperty()
  price: MoneyAmountDto;
}

export class CabinPricingDto {
  @ApiProperty({ enum: ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'] })
  cabinClass: string;
  @ApiProperty({ example: 'BASIC' })
  fareBrand: string;
  @ApiProperty()
  availableSeats: number;
  @ApiProperty()
  fareRules: FareRulesDto;
  @ApiProperty()
  baggageAllowance: BaggageAllowanceDto;
  @ApiProperty({ type: [PricePerPassengerTypeDto], description: 'Unit price for every passenger type present in the request.' })
  pricePerPassengerType: PricePerPassengerTypeDto[];
}

export class ItineraryOptionDto {
  @ApiProperty()
  itineraryId: string;
  @ApiProperty()
  totalDurationMinutes: number;
  @ApiProperty({ description: 'Always 0 in this phase — direct flights only' })
  stopsCount: number;
  @ApiProperty({ type: [FlightSegmentDto] })
  segments: FlightSegmentDto[];
  @ApiProperty({ type: [CabinPricingDto] })
  pricingOptions: CabinPricingDto[];
}

export class FlightOfferDto {
  @ApiProperty({ format: 'uuid' })
  offerId: string;
  @ApiProperty()
  airline: { code: string; name: string };
  @ApiProperty({ type: [ItineraryOptionDto] })
  itineraries: ItineraryOptionDto[];
  @ApiProperty({ description: 'Cheapest fare per itinerary, for the whole party.' })
  grandTotal: MoneyAmountDto;
}

export class SearchResponseDto {
  @ApiProperty()
  totalOffers: number;
  @ApiProperty({ type: [FlightOfferDto] })
  offers: FlightOfferDto[];
}
