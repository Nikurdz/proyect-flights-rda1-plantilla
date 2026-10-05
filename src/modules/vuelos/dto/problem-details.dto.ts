import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InvalidParamDto {
  @ApiProperty()
  name: string;
  @ApiProperty()
  reason: string;
}

/** Swagger model of the ProblemDetails body every error of this module is serialised as. */
export class ProblemDetailsDto {
  @ApiProperty({ example: 'https://api.booking-hub.com/errors/seat-taken' })
  type: string;
  @ApiProperty()
  title: string;
  @ApiProperty({ example: 409 })
  status: number;
  @ApiProperty({ example: 'SEAT_TAKEN', description: "The contract's ProblemDetails.code enum, plus UNAUTHORIZED/FORBIDDEN/NOT_FOUND/CONFLICT/INTERNAL_ERROR/NOT_IMPLEMENTED/SERVICE_UNAVAILABLE for statuses the contract does not define." })
  code: string;
  @ApiPropertyOptional()
  detail?: string;
  @ApiPropertyOptional({ type: [InvalidParamDto] })
  invalidParams?: InvalidParamDto[];
}
