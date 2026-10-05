import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { BOOKING_STATUSES } from '../entities/booking.entity';
import { DOCUMENT_TYPES, GENDERS, PASSENGER_TYPE_VALUES } from './enums';
import { MoneyAmountDto } from './search.dto';
import { E164_PHONE, IsDateOnly, ToUpperTrimmed } from './validators';

export class PaymentReferenceDto {
  @ApiProperty({ description: 'Referencia a un pago gestionado por la Payment API', pattern: '^[A-Za-z0-9._:-]{8,100}$' })
  @IsString()
  @Matches(/^[A-Za-z0-9._:-]{8,100}$/, { message: 'paymentReference must be 8-100 characters: letters, digits, . _ : -' })
  paymentReference: string;
}

export class SeatAssignmentDto {
  @ApiProperty({ format: 'uuid', description: 'segmentId as returned by /search (the flight segment).' })
  @IsUUID()
  segmentId: string;

  @ApiProperty({ example: '14C', pattern: '^\\d{1,3}[A-F]$' })
  @ToUpperTrimmed()
  @Matches(/^\d{1,3}[A-F]$/)
  seatNumber: string;
}

export class ExtraBaggageDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  itineraryId: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  quantity: number;
}

export class PassengerContactDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  @MaxLength(150)
  email: string;

  @ApiProperty({ example: '+593999999999', description: 'E.164 phone number' })
  @Matches(E164_PHONE, { message: 'phone must be an E.164 number such as +593999999999' })
  phone: string;
}

export class PassengerItemDto {
  @ApiProperty({ description: 'Caller-chosen id, unique within the booking' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,100}$/)
  passengerId: string;

  @ApiProperty({ enum: PASSENGER_TYPE_VALUES })
  @IsIn(PASSENGER_TYPE_VALUES)
  passengerType: string;

  @ApiPropertyOptional({ description: 'passengerId of the adult an INFANT travels with' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,100}$/)
  @IsOptional()
  associatedAdultId?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  firstName: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  lastName: string;

  @ApiProperty({ enum: DOCUMENT_TYPES })
  @IsIn(DOCUMENT_TYPES)
  documentType: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{4,50}$/)
  documentNumber: string;

  @ApiProperty({ example: 'EC', description: 'ISO 3166-1 alpha-2' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z]{2}$/)
  nationality: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsDateOnly()
  @IsOptional()
  documentExpiryDate?: string;

  @ApiProperty({ format: 'date' })
  @IsDateOnly()
  birthDate: string;

  @ApiProperty({ enum: GENDERS })
  @IsIn(GENDERS)
  gender: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => PassengerContactDto)
  contact: PassengerContactDto;

  @ApiPropertyOptional({ type: [SeatAssignmentDto] })
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => SeatAssignmentDto)
  @IsOptional()
  assignedSeats?: SeatAssignmentDto[];

  @ApiPropertyOptional({ type: [ExtraBaggageDto] })
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => ExtraBaggageDto)
  @IsOptional()
  extraBaggage?: ExtraBaggageDto[];
}

export class BookingRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  holdId: string;

  @ApiProperty({ type: [PassengerItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PassengerItemDto)
  passengers: PassengerItemDto[];

  @ApiProperty()
  @ValidateNested()
  @Type(() => PaymentReferenceDto)
  payment: PaymentReferenceDto;
}

export class ListBookingsQueryDto {
  @ApiPropertyOptional({ example: 'ABC123' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z0-9]{6}$/)
  @IsOptional()
  pnr?: string;

  @ApiPropertyOptional({ enum: BOOKING_STATUSES })
  @IsIn(BOOKING_STATUSES)
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsDateOnly()
  @IsOptional()
  createdFrom?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsDateOnly()
  @IsOptional()
  createdTo?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Opaque cursor from a previous page (nextCursor).' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @IsOptional()
  cursor?: string;
}

export class SeatmapQueryDto {
  @ApiProperty({ description: 'segmentId of one of the offer itineraries (required).' })
  @IsUUID()
  segmentId: string;
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
  @ApiProperty({ enum: BOOKING_STATUSES })
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

export class BookingListItemDto {
  @ApiProperty({ format: 'uuid' })
  bookingId: string;
  @ApiProperty()
  pnr: string;
  @ApiProperty({ enum: BOOKING_STATUSES })
  status: string;
  @ApiProperty({ example: 'BOG' })
  origin: string;
  @ApiProperty({ example: 'SCL' })
  destination: string;
  @ApiProperty({ format: 'date' })
  departureDate: string;
  @ApiProperty()
  grandTotal: MoneyAmountDto;
}

export class BookingListResponseDto {
  @ApiProperty({ type: [BookingListItemDto] })
  items: BookingListItemDto[];
  @ApiPropertyOptional({ description: 'Present when another page exists.' })
  nextCursor?: string;
}
