import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { IsDateOnly, ToUpperTrimmed } from './validators';

export class FlightStatusParamDto {
  @ApiProperty({ example: 'LA800', pattern: '^[A-Z0-9]{2}\\d{1,4}$' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z0-9]{2}\d{1,4}$/, { message: 'flightNumber must look like LA800' })
  flightNumber: string;
}

export class FlightStatusQueryDto {
  @ApiProperty({ format: 'date', description: 'Departure day (required).' })
  @IsDateOnly()
  date: string;
}
