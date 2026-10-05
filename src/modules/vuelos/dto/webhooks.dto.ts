import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsIn, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { WEBHOOK_EVENTS } from './enums';

export class WebhookSubscriptionDto {
  @ApiProperty({ format: 'uri' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  url: string;

  @ApiProperty({ type: [String], enum: WEBHOOK_EVENTS })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events: string[];

  @ApiProperty({ minLength: 16, description: 'Shared secret used to sign deliveries (HMAC-SHA256).' })
  @IsString()
  @MinLength(16)
  @MaxLength(200)
  secret: string;
}
