import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsIn, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { WEBHOOK_EVENTS } from './enums';

export class WebhookSubscriptionDto {
  @ApiProperty({ format: 'uri' })
  // http only passes here so the SSRF guard (resolveSafeTarget) decides: it refuses it unless private hosts are allowed.
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true, require_tld: false })
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

/** A subscription as it is shown back: the secret is write-only. */
export class WebhookSubscriptionViewDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uri' })
  url: string;

  @ApiProperty({ type: [String], enum: WEBHOOK_EVENTS })
  events: string[];
}
