import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { ToUpperTrimmed } from '../../dto/validators';

export class AdminAeropuertosQueryDto {
  @ApiPropertyOptional({ example: 'loja', description: 'Busca por código, ciudad o nombre del aeropuerto (sin tildes ni mayúsculas).' })
  @IsString()
  @MaxLength(60)
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ example: 'EC', description: 'País (ISO 3166-1 alfa-2).' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z]{2}$/)
  @IsOptional()
  pais?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pagina?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limite?: number = 25;
}

export class AdminCrearAeropuertoDto {
  @ApiProperty({ example: 'LOH', description: 'Código IATA de tres letras.' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z]{3}$/)
  iata: string;

  @ApiProperty({ example: 'Loja', maxLength: 100 })
  @IsString()
  @Length(1, 100)
  ciudad: string;

  @ApiProperty({ example: 'Camilo Ponce Enríquez (Catamayo)', maxLength: 150 })
  @IsString()
  @Length(1, 150)
  nombre: string;

  @ApiProperty({ example: 'EC', description: 'País (ISO 3166-1 alfa-2).' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z]{2}$/)
  pais: string;

  @ApiProperty({ example: 'Ecuador', maxLength: 100 })
  @IsString()
  @Length(1, 100)
  paisNombre: string;

  @ApiProperty({ example: 'America/Guayaquil', description: 'Zona horaria IANA real; con ella se muestran las horas del aeropuerto.' })
  @IsString()
  @MaxLength(50)
  zonaHoraria: string;

  @ApiProperty({ example: true, description: 'Debe ser true: confirma que el administrador revisó el código, porque un aeropuerto ya creado no se puede borrar ni editar desde aquí.' })
  @IsBoolean()
  @IsOptional()
  confirmar?: boolean;
}

export class AdminAeropuertoViewDto {
  @ApiProperty({ example: 'LOH' }) iata: string;
  @ApiProperty() ciudad: string;
  @ApiProperty() nombre: string;
  @ApiProperty({ example: 'EC' }) pais: string;
  @ApiProperty() paisNombre: string;
  @ApiProperty({ example: 'America/Guayaquil' }) zonaHoraria: string;
  @ApiProperty({ description: 'Vuelos del calendario que salen o llegan a este aeropuerto.' }) vuelos: number;
}

export class AdminAeropuertosPaginaDto {
  @ApiProperty({ type: [AdminAeropuertoViewDto] }) items: AdminAeropuertoViewDto[];
  @ApiProperty() total: number;
  @ApiProperty() pagina: number;
  @ApiProperty() limite: number;
}
