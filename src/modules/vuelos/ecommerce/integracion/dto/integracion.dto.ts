import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, IsUrl, Length, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { IsDateOnly, ToLowerTrimmed } from '../../../dto/validators';
import { MontoDto } from '../../catalogo/dto/catalogo.dto';
import { FacturacionDto } from '../../ofertas/dto/ofertas.dto';
import { MedioCompraDto } from '../../ordenes/dto/ordenes.dto';
import { TIPOS_SERVICIO } from '../entities/proveedor.entity';

// ---------- Gestión de Proveedores (ADMIN) ----------

export class RegistrarProveedorDto {
  @ApiProperty({ example: 'Atracciones Quito' })
  @IsString()
  @Length(2, 100)
  nombre: string;

  @ApiProperty({ example: 'Equipo Atracciones' })
  @IsString()
  @Length(2, 100)
  equipo: string;

  @ApiProperty({ example: 'https://atracciones.example.com/api/v2', description: 'Con o sin el prefijo /api/v2: se completa solo.' })
  @IsUrl({ require_protocol: true, require_tld: false, protocols: ['http', 'https'] })
  @MaxLength(300)
  baseUrl: string;

  @ApiProperty({ enum: TIPOS_SERVICIO })
  @IsIn(TIPOS_SERVICIO)
  tipoServicio: (typeof TIPOS_SERVICIO)[number];
}

export class ActualizarProveedorDto {
  @ApiPropertyOptional()
  @IsString()
  @Length(2, 100)
  @IsOptional()
  nombre?: string;

  @ApiPropertyOptional()
  @IsString()
  @Length(2, 100)
  @IsOptional()
  equipo?: string;

  @ApiPropertyOptional()
  @IsUrl({ require_protocol: true, require_tld: false, protocols: ['http', 'https'] })
  @MaxLength(300)
  @IsOptional()
  baseUrl?: string;

  @ApiPropertyOptional({ description: 'Kill-switch: false apaga el proveedor (no se le llama, su catálogo se oculta y no se aceptan reservas).' })
  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}

export class ProveedorParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id: string;
}

export class SaludViewDto {
  @ApiProperty({ enum: ['UP', 'DEGRADADO', 'DOWN', 'SIN_DATOS', 'APAGADO'], description: 'Semáforo: UP verde, DEGRADADO ámbar (responde lento), DOWN rojo.' })
  estado: string;
  @ApiPropertyOptional({ nullable: true }) latenciaMs: number | null;
  @ApiPropertyOptional({ nullable: true }) detalle: string | null;
  @ApiPropertyOptional({ nullable: true }) comprobadoEn: string | null;
}

export class ProveedorViewDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() nombre: string;
  @ApiProperty() equipo: string;
  @ApiProperty() baseUrl: string;
  @ApiProperty({ enum: TIPOS_SERVICIO }) tipoServicio: string;
  @ApiProperty() activo: boolean;
  @ApiProperty() salud: SaludViewDto;
  @ApiProperty({ enum: ['CERRADO', 'ABIERTO', 'SEMIABIERTO'], description: 'Circuit breaker: ABIERTO = se rechazan las llamadas sin intentarlas.' }) circuito: string;
  @ApiProperty({ description: 'Productos activos del catálogo sincronizado.' }) productos: number;
}

export class SincronizacionViewDto {
  @ApiProperty() importados: number;
  @ApiProperty() nuevos: number;
  @ApiProperty() actualizados: number;
  @ApiProperty({ description: 'Productos que el proveedor ya no lista: quedan ocultos.' }) desactivados: number;
}

// ---------- Experiencias (catálogo sincronizado, público) ----------

export class ExperienciasQueryDto {
  @ApiPropertyOptional({ description: 'Texto a buscar en el nombre.' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 24 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limite?: number = 24;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  desde?: number = 0;
}

export class ExperienciaParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id: string;
}

export class ExperienciaViewDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ description: 'Quién la ofrece.' }) proveedor: string;
  @ApiProperty() tipo: string;
  @ApiProperty() nombre: string;
  @ApiProperty() descripcion: string;
  @ApiPropertyOptional({ nullable: true }) duracion: string | null;
  @ApiProperty({ description: 'Precio por persona.' }) precio: MontoDto;
  @ApiPropertyOptional({ nullable: true }) imagenUrl: string | null;
  @ApiProperty() cancelacionGratis: boolean;
  @ApiProperty({ type: [String] }) categorias: string[];
}

export class ExperienciasPaginaViewDto {
  @ApiProperty({ type: [ExperienciaViewDto] }) items: ExperienciaViewDto[];
  @ApiProperty() total: number;
}

// ---------- Reservas de experiencias ----------

export class ReservarExperienciaDto {
  @ApiProperty({ example: '2026-12-20', format: 'date' })
  @IsDateOnly()
  fecha: string;

  @ApiPropertyOptional({ example: '10:30' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @IsOptional()
  hora?: string;

  @ApiProperty({ minimum: 1, maximum: 10, description: 'Personas.' })
  @IsInt()
  @Min(1)
  @Max(10)
  cantidad: number;

  @ApiProperty()
  @IsString()
  @Length(2, 150)
  nombre: string;

  @ApiProperty({ format: 'email' })
  @ToLowerTrimmed()
  @IsEmail()
  @MaxLength(150)
  correo: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => FacturacionDto)
  facturacion: FacturacionDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => MedioCompraDto)
  medio: MedioCompraDto;
}

export class CancelarReservaExternaDto {
  @ApiPropertyOptional({ example: 'Cambio de planes' })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  motivo?: string;
}

export class ReservaExternaParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id: string;
}

export class ReservaExternaViewDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: ['PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'FALLIDA_COMPENSADA'] }) estado: string;
  @ApiProperty() experiencia: { id: string; nombre: string; proveedor: string };
  @ApiProperty({ format: 'date' }) fecha: string;
  @ApiPropertyOptional({ nullable: true }) hora: string | null;
  @ApiProperty() cantidad: number;
  @ApiProperty() total: MontoDto;
  @ApiProperty({ description: 'Si la experiencia admite cancelación gratuita (si no, cancelar responde 409 EXTERNAL_RESERVATION_NOT_REFUNDABLE).' }) cancelacionGratis: boolean;
  @ApiPropertyOptional({ nullable: true, description: 'Identificador de la reserva en el sistema del proveedor.' }) referenciaProveedor: string | null;
  @ApiPropertyOptional({ nullable: true }) factura: string | null;
  @ApiPropertyOptional({ nullable: true }) motivo: string | null;
  @ApiProperty() creadaEn: string;
}

export class ReservasExternasPaginaViewDto {
  @ApiProperty({ type: [ReservaExternaViewDto] }) items: ReservaExternaViewDto[];
}
