import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { E164_PHONE, IsDateOnly, ToLowerTrimmed } from '../../dto/validators';

export const ROLES_USUARIO = ['CUSTOMER', 'ADMIN'] as const;

export class AdminUsuariosQueryDto {
  @ApiPropertyOptional({ description: 'Texto a buscar en el correo, los nombres o los apellidos.' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ enum: ROLES_USUARIO, description: 'Solo los usuarios que tienen este rol.' })
  @IsIn(ROLES_USUARIO)
  @IsOptional()
  rol?: string;

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

export class AdminCrearUsuarioDto {
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

  @ApiPropertyOptional({ enum: ROLES_USUARIO, isArray: true, default: ['CUSTOMER'], description: 'Todo usuario conserva CUSTOMER; agrega ADMIN para crear un administrador.' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(ROLES_USUARIO, { each: true })
  @IsOptional()
  roles?: string[];
}

export class AdminCambiarRolesDto {
  @ApiProperty({ enum: ROLES_USUARIO, isArray: true, example: ['CUSTOMER', 'ADMIN'], description: 'Roles que debe tener el usuario. CUSTOMER siempre se conserva.' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(ROLES_USUARIO, { each: true })
  roles: string[];
}

export class AdminUsuarioParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clienteId: string;
}

export class AdminUsuarioViewDto {
  @ApiProperty({ format: 'uuid' }) clienteId: string;
  @ApiProperty() correo: string;
  @ApiProperty() nombres: string;
  @ApiProperty() apellidos: string;
  @ApiProperty({ enum: ROLES_USUARIO, isArray: true }) roles: string[];
  @ApiProperty() correoVerificado: boolean;
  @ApiProperty({ description: 'La cuenta está bloqueada temporalmente por intentos fallidos de inicio de sesión.' }) bloqueada: boolean;
  @ApiProperty() creadoEn: string;
}

export class AdminUsuariosPaginaDto {
  @ApiProperty({ type: [AdminUsuarioViewDto] }) items: AdminUsuarioViewDto[];
  @ApiProperty() total: number;
  @ApiProperty() pagina: number;
  @ApiProperty() limite: number;
}
