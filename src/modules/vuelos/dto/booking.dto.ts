import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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

/** An amount sent by the caller (contract v2 `PaymentReference.amount`). */
export class MoneyInputDto {
  @ApiProperty({ example: 'USD', pattern: '^[A-Z]{3}$' })
  @Matches(/^[A-Z]{3}$/)
  currency: string;

  @ApiProperty({ example: '120.00', pattern: '^\\d+\\.\\d{2}$' })
  @Matches(/^\d+\.\d{2}$/)
  total: string;
}

export class PaymentReferenceDto {
  @ApiProperty({ description: 'Referencia a un pago gestionado por la Payment API', pattern: '^[A-Za-z0-9._:-]{8,100}$' })
  @IsString()
  @Matches(/^[A-Za-z0-9._:-]{8,100}$/, { message: 'paymentReference must be 8-100 characters: letters, digits, . _ : -' })
  paymentReference: string;

  @ApiPropertyOptional({ type: MoneyInputDto, description: 'Monto cobrado por Booking; si viene y no coincide con el precio retenido, 409 AMOUNT_MISMATCH (contrato v2).' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyInputDto)
  amount?: MoneyInputDto;

  @ApiPropertyOptional({ enum: ['BOOKING_PROTOTIPO', 'AIRLINE_DIRECT'], default: 'BOOKING_PROTOTIPO' })
  @IsOptional()
  @IsIn(['BOOKING_PROTOTIPO', 'AIRLINE_DIRECT'])
  provider?: string;
}

/** Where the sale came from (contract v2 `SalesChannel`): the partner order, an optional package and the promotion applied. */
export class SalesChannelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  partnerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  partnerOrderId?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  packageId?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  promotionApplied?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Min(0)
  @Max(100)
  discountPercentage?: number;
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

  @ApiProperty({ minimum: 1, maximum: 10, description: 'El tope real lo fija POSTSALE_BAGGAGE_MAX_PER_LEG (409 BAGGAGE_LIMIT_EXCEEDED).' })
  @IsInt()
  @Min(1)
  @Max(10)
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

  @ApiPropertyOptional({ type: SalesChannelDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SalesChannelDto)
  salesChannel?: SalesChannelDto;
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
  @ApiPropertyOptional({ description: 'segmentId of one of the offer itineraries. If omitted: the first one.' })
  @IsUUID()
  @IsOptional()
  segmentId?: string;
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
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Texto firmado para el código QR del pasajero (v1.<billete>.<PNR>.<firma>); no contiene datos personales.' })
  qrPayload?: string | null;
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
  @ApiPropertyOptional({ description: 'History of changes (date changes, flight reschedules, cancellation).' })
  changes?: { changedAt: string; description: string }[];
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
