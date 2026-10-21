import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { IsDateOnly, ToUpperTrimmed } from '../../dto/validators';
import { OrdenViewDto } from '../ordenes/dto/ordenes.dto';

const ESTADOS = ['PENDIENTE_PAGO', 'PAGO_EN_VERIFICACION', 'PAGADA', 'EMITIDA', 'FALLIDA_COMPENSADA', 'MODIFICADA', 'DEVOLUCION_EN_CURSO', 'REEMBOLSADA', 'EN_VIAJE', 'COMPLETADA', 'EXPIRADA'] as const;

class PaginationDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 25;

  @ApiPropertyOptional({ description: 'Cursor opaco de la página anterior (nextCursor).' })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  cursor?: string;
}

export class AdminOrdenesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ESTADOS })
  @IsIn(ESTADOS)
  @IsOptional()
  estado?: string;

  @ApiPropertyOptional({ example: 'ORD-7K3M9PQ2XA' })
  @ToUpperTrimmed()
  @Matches(/^ORD-[A-Z0-9]{10}$/)
  @IsOptional()
  numero?: string;

  @ApiPropertyOptional({ example: 'ABC123' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z0-9]{6}$/)
  @IsOptional()
  pnr?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Creadas desde este día (UTC).' })
  @IsDateOnly()
  @IsOptional()
  desde?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Creadas hasta este día (UTC, inclusive).' })
  @IsDateOnly()
  @IsOptional()
  hasta?: string;
}

export class AdminOrdenViewDto extends OrdenViewDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Cuenta del comprador; null si compró como invitado.' })
  clienteId: string | null;
  @ApiProperty({ enum: ['cliente', 'invitado'] })
  comprador: 'cliente' | 'invitado';
  @ApiProperty()
  canal: string;
}

export class AdminOrdenesPaginaDto {
  @ApiProperty({ type: [AdminOrdenViewDto] }) items: AdminOrdenViewDto[];
  @ApiPropertyOptional() nextCursor?: string;
}

export class AdminVuelosQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'BOG' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z]{3}$/)
  @IsOptional()
  origen?: string;

  @ApiPropertyOptional({ example: 'SCL' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z]{3}$/)
  @IsOptional()
  destino?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Día de salida (UTC). Sin fecha: desde hoy.' })
  @IsDateOnly()
  @IsOptional()
  fecha?: string;

  @ApiPropertyOptional({ example: 'LA800' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z0-9]{2}\d{1,4}$/)
  @IsOptional()
  vuelo?: string;
}

export class AdminVueloViewDto {
  @ApiProperty({ format: 'uuid' }) vueloId: string;
  @ApiProperty({ example: 'LA800' }) codigoVuelo: string;
  @ApiProperty() aerolinea: string;
  @ApiProperty({ example: 'BOG' }) origen: string;
  @ApiProperty({ example: 'SCL' }) destino: string;
  @ApiProperty() salida: string;
  @ApiProperty() llegada: string;
  @ApiProperty() duracionMinutos: number;
  @ApiProperty({ description: 'Tarifa base por adulto en USD, antes de familia e impuestos.' }) precioBaseUsd: number;
  @ApiProperty() asientosDisponibles: number;
  @ApiProperty() capacidadTotal: number;
  @ApiProperty({ description: 'Asientos con número ya reservados (los pasajeros que no eligieron asiento no cuentan).' }) asientosReservados: number;
  @ApiProperty({ enum: ['SCHEDULED', 'CANCELLED'], description: 'Un vuelo cancelado está cerrado a la venta y ya no admite ediciones.' }) estado: string;
}

export class AdminVueloParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vueloId: string;
}

class AdminAsientoReservadoDto {
  @ApiProperty({ example: '12A' }) asiento: string;
  @ApiProperty({ example: 'ABC234', description: 'Código de reserva que lo tiene (sin nombres).' }) pnr: string;
  @ApiPropertyOptional({ nullable: true, example: 'ORD-7K3M9PQ2XA', description: 'Orden del e-commerce, si la reserva salió de una.' }) numeroOrden: string | null;
}

class AdminAsientoMapaDto {
  @ApiProperty({ example: '12A' }) seatNumber: string;
  @ApiProperty() isAvailable: boolean;
  @ApiProperty({ type: [String] }) characteristics: string[];
}

class AdminFilaMapaDto {
  @ApiProperty() rowNumber: number;
  @ApiProperty({ type: [AdminAsientoMapaDto] }) seats: AdminAsientoMapaDto[];
}

export class AdminAsientosVueloDto {
  @ApiProperty({ format: 'uuid' }) vueloId: string;
  @ApiProperty({ example: 'LA800' }) codigoVuelo: string;
  @ApiProperty({ example: 'BOG' }) origen: string;
  @ApiProperty({ example: 'SCL' }) destino: string;
  @ApiProperty() salida: string;
  @ApiProperty() capacidadTotal: number;
  @ApiProperty({ type: [AdminAsientoReservadoDto], description: 'Asientos reservados, por número.' }) reservados: AdminAsientoReservadoDto[];
  @ApiProperty({ type: [AdminFilaMapaDto], description: 'Mapa completo de la cabina con la disponibilidad de cada asiento.' }) filas: AdminFilaMapaDto[];
}

export class AdminCancelarVueloDto {
  @ApiPropertyOptional({ example: 'Falla técnica de la aeronave' })
  @IsString()
  @MaxLength(300)
  @IsOptional()
  motivo?: string;
}

export class AdminReprogramarVueloDto {
  @ApiProperty({ example: '2026-11-20T14:30:00.000Z', description: 'Nueva hora de salida (UTC), en el futuro. La llegada se recalcula conservando la duración.' })
  @IsDateString()
  nuevaSalida: string;

  @ApiPropertyOptional({ example: 'Cambio de franja operativa' })
  @IsString()
  @MaxLength(300)
  @IsOptional()
  motivo?: string;
}

export class AdminAccionVueloViewDto {
  @ApiProperty({ format: 'uuid' }) vueloId: string;
  @ApiProperty({ example: 'LA800' }) codigoVuelo: string;
  @ApiProperty({ enum: ['SCHEDULED', 'CANCELLED'] }) estado: string;
  @ApiProperty() salida: string;
  @ApiProperty({ description: 'Reservas confirmadas que tenían este vuelo y fueron actualizadas o canceladas.' }) reservasAfectadas: number;
  @ApiProperty({ type: [String], description: 'Eventos de webhook emitidos.' }) eventos: string[];
}

export class AdminVuelosPaginaDto {
  @ApiProperty({ type: [AdminVueloViewDto] }) items: AdminVueloViewDto[];
  @ApiPropertyOptional() nextCursor?: string;
}

export class AdminCrearVueloDto {
  @ApiProperty({ example: 'LA900', description: 'Dos caracteres de aerolínea y 1 a 4 dígitos. Los dos primeros son el código de la aerolínea.' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z0-9]{2}\d{1,4}$/)
  codigoVuelo: string;

  @ApiProperty({ example: 'LATAM Airlines' })
  @IsString()
  @Length(2, 150)
  aerolinea: string;

  @ApiProperty({ example: 'BOG', description: 'Código IATA, debe existir en el catálogo de localidades.' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z]{3}$/)
  origen: string;

  @ApiProperty({ example: 'SCL' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z]{3}$/)
  destino: string;

  @ApiProperty({ example: '2026-11-20T14:30:00.000Z', description: 'Salida (UTC), en el futuro.' })
  @IsDateString()
  salida: string;

  @ApiProperty({ example: 300, minimum: 20, maximum: 1500 })
  @Type(() => Number)
  @IsInt()
  @Min(20)
  @Max(1500)
  duracionMinutos: number;

  @ApiProperty({ example: 320, description: 'Tarifa base por adulto en USD, antes de familia e impuestos.' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(5000)
  precioBaseUsd: number;

  @ApiPropertyOptional({ example: 180, minimum: 1, maximum: 400, default: 180, description: 'Asientos de la cabina; todos quedan disponibles.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(400)
  @IsOptional()
  capacidad?: number;
}

export class AdminActualizarVueloDto {
  @ApiPropertyOptional({ example: 'LATAM Airlines' })
  @IsString()
  @Length(2, 150)
  @IsOptional()
  aerolinea?: string;

  @ApiPropertyOptional({ example: 340, description: 'Tarifa base por adulto en USD. No afecta a las reservas ya hechas.' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(5000)
  @IsOptional()
  precioBaseUsd?: number;

  @ApiPropertyOptional({ minimum: 20, maximum: 1500, description: 'Recalcula la llegada conservando la salida.' })
  @Type(() => Number)
  @IsInt()
  @Min(20)
  @Max(1500)
  @IsOptional()
  duracionMinutos?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 400, description: 'No puede ser menor que los asientos ya vendidos ni dejar asientos numerados fuera de la cabina.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(400)
  @IsOptional()
  capacidadTotal?: number;
}
