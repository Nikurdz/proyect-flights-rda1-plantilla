import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsArray, ValidateNested, IsOptional, IsInt } from 'class-validator';
import { MoneyAmountDto } from './search.dto';

export class PaymentReferenceDto {
  @ApiProperty({ description: 'Referencia a un pago gestionado por la Payment API' })
  @IsString()
  paymentReference: string;
}

export class SeatAssignmentDto {
  @ApiProperty()
  @IsString()
  segmentId: string;

  @ApiProperty()
  @IsString()
  seatNumber: string;
}

export class ExtraBaggageDto {
  @ApiProperty()
  @IsString()
  itineraryId: string;

  @ApiProperty()
  @IsInt()
  quantity: number;
}

export class PassengerContactDto {
  @ApiProperty()
  @IsString()
  email: string;

  @ApiProperty()
  @IsString()
  phone: string;
}

export class PassengerItemDto {
  @ApiProperty()
  @IsString()
  passengerId: string;

  @ApiProperty({ enum: ['ADULT', 'YOUTH', 'CHILD', 'INFANT'] })
  @IsString()
  passengerType: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  associatedAdultId?: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty({ enum: ['PASSPORT', 'NATIONAL_ID'] })
  @IsString()
  documentType: string;

  @ApiProperty()
  @IsString()
  documentNumber: string;

  @ApiProperty()
  @IsString()
  nationality: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsString()
  @IsOptional()
  documentExpiryDate?: string;

  @ApiProperty({ format: 'date' })
  @IsString()
  birthDate: string;

  @ApiProperty({ enum: ['M', 'F', 'X'] })
  @IsString()
  gender: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => PassengerContactDto)
  contact: PassengerContactDto;

  @ApiPropertyOptional({ type: [SeatAssignmentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeatAssignmentDto)
  @IsOptional()
  assignedSeats?: SeatAssignmentDto[];

  @ApiPropertyOptional({ type: [ExtraBaggageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtraBaggageDto)
  @IsOptional()
  extraBaggage?: ExtraBaggageDto[];
}

export class BookingRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsString()
  holdId: string;

  @ApiProperty({ type: [PassengerItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PassengerItemDto)
  passengers: PassengerItemDto[];

  @ApiProperty()
  @ValidateNested()
  @Type(() => PaymentReferenceDto)
  payment: PaymentReferenceDto;
}

export class TicketResponseDto {
  @ApiProperty()
  ticketId: string;
  @ApiProperty({ format: 'uuid' })
  bookingId: string;
  @ApiProperty()
  passengerId: string;
  @ApiPropertyOptional({ nullable: true })
  eTicketNumber: string | null;
  @ApiProperty({ enum: ['PENDING', 'ISSUING', 'ISSUED', 'FAILED', 'VOIDED', 'REFUNDED'] })
  status: string;
  @ApiPropertyOptional({ nullable: true })
  issuedAt: string | null;
}

export class BookingDetailResponseDto {
  @ApiProperty({ format: 'uuid' })
  bookingId: string;
  @ApiProperty()
  pnr: string;
  @ApiProperty({
    enum: [
      'PENDING',
      'PENDING_PAYMENT',
      'TICKET_ISSUING',
      'CONFIRMED',
      'FAILED',
      'CHANGE_PENDING',
      'CANCELLATION_PENDING',
      'CANCELLED',
    ],
  })
  status: string;
  @ApiProperty()
  grandTotal: MoneyAmountDto;
  @ApiProperty()
  createdAt: string;
  @ApiProperty()
  updatedAt: string;
  @ApiPropertyOptional({ type: [TicketResponseDto] })
  tickets?: TicketResponseDto[];
}
