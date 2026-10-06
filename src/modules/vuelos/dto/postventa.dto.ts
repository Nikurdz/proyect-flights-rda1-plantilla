import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
import { PaymentReferenceDto, SeatAssignmentDto } from './booking.dto';
import { FlightSegmentDto, MoneyAmountDto } from './search.dto';
import { IsDateOnly } from './validators';

// ---------------------------------------------------------------------------------------------------- requests

export class AddBaggageRequestDto {
  @ApiProperty({ description: 'passengerId chosen in the booking request.' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,100}$/)
  passengerId: string;

  @ApiProperty({ format: 'uuid', description: 'itineraryId of the leg the bags travel on.' })
  @IsUUID()
  itineraryId: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  quantity: number;

  @ApiProperty()
  @ValidateNested()
  @Type(() => PaymentReferenceDto)
  payment: PaymentReferenceDto;
}

export class DateChangeSearchItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  itineraryId: string;

  @ApiProperty({ format: 'date' })
  @IsDateOnly()
  newDepartureDate: string;
}

export class DateChangeSearchRequestDto {
  @ApiProperty({ type: [DateChangeSearchItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => DateChangeSearchItemDto)
  changes: DateChangeSearchItemDto[];
}

export class DateChangeRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  changeOfferId: string;

  @ApiPropertyOptional({ description: 'Required when the change has an amount to pay (totalToPay > 0). The reference is single-use.' })
  @ValidateNested()
  @Type(() => PaymentReferenceDto)
  @IsOptional()
  payment?: PaymentReferenceDto;

  @ApiPropertyOptional({ type: [SeatAssignmentDto], description: 'Seats on the new flight; without them the passengers keep none (check-in assigns one).' })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SeatAssignmentDto)
  @IsOptional()
  assignedSeats?: SeatAssignmentDto[];
}

export class CancelBookingRequestDto {
  @ApiProperty({ format: 'uuid', description: 'quoteId of a live cancellation quote of this booking.' })
  @IsUUID()
  quoteId: string;

  @ApiPropertyOptional()
  @IsString()
  @Length(3, 500)
  @IsOptional()
  reason?: string;
}

// --------------------------------------------------------------------------------------------------- responses

export class BaggageOptionDto {
  @ApiProperty() passengerId: string;
  @ApiProperty({ format: 'uuid' }) itineraryId: string;
  @ApiProperty({ type: MoneyAmountDto, description: 'Price of one extra bag on this leg.' }) price: MoneyAmountDto;
  @ApiProperty({ description: 'Most extra bags the passenger can have on this leg; equals alreadyPurchased when the sale is closed.' }) maxAllowed: number;
  @ApiProperty() alreadyPurchased: number;
}

export class BaggageAddedResponseDto {
  @ApiProperty() passengerId: string;
  @ApiProperty({ format: 'uuid' }) itineraryId: string;
  @ApiProperty({ description: 'Extra bags the passenger now has on this leg.' }) totalBaggage: number;
}

export class PriceDifferenceDto {
  @ApiProperty({ example: '40.00', description: 'Negative when the new flight is cheaper; it is never refunded.' }) fareDifference: string;
  @ApiProperty({ example: '6.00' }) taxDifference: string;
  @ApiProperty({ example: '30.00' }) changeFee: string;
  @ApiProperty({ example: '76.00', description: 'What has to be paid: the difference (never below zero) plus the fee.' }) totalToPay: string;
}

export class DateChangeOptionDto {
  @ApiProperty({ format: 'uuid' }) changeOfferId: string;
  @ApiProperty({ format: 'date-time' }) expiresAt: string;
  @ApiProperty({ type: [FlightSegmentDto] }) segments: FlightSegmentDto[];
  @ApiProperty({ type: PriceDifferenceDto }) priceDifference: PriceDifferenceDto;
}

export class CancellationQuoteResponseDto {
  @ApiProperty({ format: 'uuid' }) quoteId: string;
  @ApiProperty({ description: 'The fare rule: false for a non-refundable fare (only the taxes come back).' }) isRefundable: boolean;
  @ApiProperty({ example: '315.00' }) refundAmount: string;
  @ApiProperty({ example: '35.00' }) penaltyAmount: string;
  @ApiProperty({ example: 'USD' }) currency: string;
  @ApiProperty({ format: 'date-time' }) expiresAt: string;
}

export class CancelBookingResponseDto {
  @ApiProperty({ format: 'uuid' }) bookingId: string;
  @ApiProperty({ example: 'CANCELLED' }) status: string;
  @ApiProperty({ example: '315.00' }) refundAmount: string;
  @ApiProperty({ example: '35.00' }) penaltyAmount: string;
  @ApiProperty({ example: 'USD' }) currency: string;
}

export class CheckInSegmentDto {
  @ApiProperty({ format: 'uuid' }) segmentId: string;
  @ApiPropertyOptional({ nullable: true, example: '12A', description: 'null for a lap infant.' }) seat: string | null;
  @ApiProperty({ enum: ['CHECKED_IN', 'NOT_CHECKED_IN', 'FAILED'] }) status: string;
}

export class CheckedInPassengerDto {
  @ApiProperty() passengerId: string;
  @ApiProperty({ enum: ['CHECKED_IN', 'NOT_CHECKED_IN', 'FAILED'] }) status: string;
  @ApiProperty({ type: [CheckInSegmentDto] }) segments: CheckInSegmentDto[];
}

export class CheckInResponseDto {
  @ApiProperty({ format: 'uuid' }) bookingId: string;
  @ApiProperty({ enum: ['NOT_ELIGIBLE', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] }) status: string;
  @ApiProperty({ type: [CheckedInPassengerDto] }) checkedInPassengers: CheckedInPassengerDto[];
}

export class BoardingPassDto {
  @ApiProperty() passengerId: string;
  @ApiProperty({ format: 'uuid' }) segmentId: string;
  @ApiProperty({ example: '12A' }) seat: string;
  @ApiPropertyOptional({ nullable: true, example: 'A' }) boardingGroup: string | null;
  @ApiPropertyOptional({ nullable: true, example: '7' }) boardingPosition: string | null;
  @ApiProperty({ description: 'Signed text (bp1.<e-ticket>.<PNR>.<flight>.<seat>.<signature>); carries no personal data.' }) barcode: string;
  @ApiProperty({ enum: ['AZTEC', 'PDF417', 'QR'] }) barcodeType: string;
}

export class BoardingPassListResponseDto {
  @ApiProperty({ format: 'uuid' }) bookingId: string;
  @ApiProperty({ type: [BoardingPassDto] }) boardingPasses: BoardingPassDto[];
}
