import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsString, IsUUID, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
import { PaymentReferenceDto, SeatAssignmentDto } from './booking.dto';
import { IsDateOnly } from './validators';

export class AddBaggageRequestDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,100}$/)
  passengerId: string;

  @ApiProperty({ format: 'uuid' })
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

  @ApiProperty()
  @ValidateNested()
  @Type(() => PaymentReferenceDto)
  payment: PaymentReferenceDto;

  @ApiProperty({ type: [SeatAssignmentDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SeatAssignmentDto)
  assignedSeats: SeatAssignmentDto[];
}

export class CancelBookingRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  quoteId: string;

  @ApiProperty()
  @IsString()
  @Length(3, 500)
  reason: string;
}
