import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BaseResponseDto } from '../../../../../common/dto/base-response.dto';
import { E164_PHONE, IsDateOnly, ToLowerTrimmed } from '../../../dto/validators';

export const CANALES = ['EMAIL', 'SMS', 'PUSH', 'WHATSAPP'] as const;

export class RegistroClienteDto {
  @ApiProperty({ format: 'email' })
  @ToLowerTrimmed()
  @IsEmail()
  @MaxLength(150)
  correo: string;

  @ApiProperty({ minLength: 10, description: 'Mínimo 10 caracteres, con al menos una letra y un número.' })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'contrasena must contain at least one letter and one number' })
  contrasena: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  nombres: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  apellidos: string;

  @ApiProperty({ format: 'date' })
  @IsDateOnly()
  fechaNacimiento: string;

  @ApiPropertyOptional({ example: '+593999999999', description: 'E.164' })
  @Matches(E164_PHONE, { message: 'telefono must be an E.164 number such as +593999999999' })
  @IsOptional()
  telefono?: string;

  @ApiPropertyOptional({ example: 'ec', default: 'ec' })
  @ToLowerTrimmed()
  @Matches(/^[a-z]{2,5}$/)
  @IsOptional()
  mercado?: string;

  @ApiProperty({ description: 'Debe ser true: aceptación de términos y política de datos.' })
  @Equals(true, { message: 'aceptaTerminos must be true to create an account' })
  aceptaTerminos: boolean;

  @ApiPropertyOptional({ default: false, description: 'Consentimiento de marketing: separado y no obligatorio.' })
  @IsBoolean()
  @IsOptional()
  consentimientoMarketing?: boolean;
}

export class LoginDto {
  @ApiProperty({ format: 'email' })
  @ToLowerTrimmed()
  @IsEmail()
  correo: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  contrasena: string;
}

export class VerificarCorreoDto {
  @ApiProperty({ description: 'Token de un solo uso recibido por correo.' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{20,100}$/)
  token: string;
}

export class PreferenciasDto {
  @ApiPropertyOptional({ enum: CANALES })
  @IsIn(CANALES)
  @IsOptional()
  canalNotificacion?: (typeof CANALES)[number];

  @ApiPropertyOptional({ example: 'es' })
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/)
  @IsOptional()
  idioma?: string;

  @ApiPropertyOptional({ example: 'ec' })
  @ToLowerTrimmed()
  @Matches(/^[a-z]{2,5}$/)
  @IsOptional()
  mercado?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  consentimientoMarketing?: boolean;
}

export class ClienteViewDto extends BaseResponseDto {
  @ApiProperty({ format: 'uuid' }) clienteId: string;
  @ApiProperty() correo: string;
  @ApiProperty() correoVerificado: boolean;
  @ApiProperty() nombres: string;
  @ApiProperty() apellidos: string;
  @ApiProperty({ description: 'Número LATAM Pass vinculado a la cuenta.' }) numeroSocio: string;
  @ApiProperty() mercado: string;
  @ApiProperty() idioma: string;
  @ApiProperty({ enum: CANALES }) canalNotificacion: string;
  @ApiProperty() consentimientoMarketing: boolean;
}

export class TokenViewDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ example: 'Bearer' }) tokenType: string;
  @ApiProperty({ description: 'Segundos de vigencia.' }) expiresIn: number;
}

export class ClienteParamDto {
  @ApiProperty({ description: 'Id del cliente o el alias "me".' })
  @Matches(/^(me|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)
  id: string;
}
