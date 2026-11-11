import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class WebhookEntregasQueryDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'DELIVERED', 'DEAD'], description: 'Estado de la entrega.' })
  @IsIn(['PENDING', 'DELIVERED', 'DEAD'])
  @IsOptional()
  estado?: 'PENDING' | 'DELIVERED' | 'DEAD';

  @ApiPropertyOptional({ example: 'booking.cancelled', description: 'Tipo de evento.' })
  @IsString()
  @MaxLength(40)
  @IsOptional()
  tipo?: string;

  @ApiPropertyOptional({ example: 'partner:booking-prototipo', description: 'Dueño de la suscripción (partner:<cliente> para Booking).' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  owner?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Una suscripción concreta.' })
  @IsUUID()
  @IsOptional()
  suscripcionId?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pagina?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limite?: number = 20;
}

export class WebhookEntregaParamDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  deliveryId: string;
}
