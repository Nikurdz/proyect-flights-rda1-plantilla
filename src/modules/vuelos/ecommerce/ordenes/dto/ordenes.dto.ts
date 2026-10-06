import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { BaseResponseDto } from '../../../../../common/dto/base-response.dto';
import { ToUpperTrimmed } from '../../../dto/validators';
import { MontoDto } from '../../catalogo/dto/catalogo.dto';

export class MedioCompraDto {
  @ApiProperty({ enum: ['TARJETA'] })
  @IsIn(['TARJETA'])
  tipo: 'TARJETA';

  @ApiProperty({
    example: 'tok_visa_ok',
    description:
      'Token de la pasarela (nunca el número de tarjeta, RN-18). Pasarela simulada: tok_<marca>_ok aprueba; tok_declined, tok_insufficient, tok_expired, tok_3ds, tok_fraud, tok_review, tok_<marca>_capture_fail fuerzan otros resultados.',
  })
  @Matches(/^tok_[a-z0-9_]{3,60}$/)
  token: string;

  @ApiProperty({ example: 'VISA' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z_]{2,20}$/)
  marca: string;
}

export class CompraDto {
  @ApiProperty()
  @ValidateNested()
  @Type(() => MedioCompraDto)
  medio: MedioCompraDto;

  @ApiPropertyOptional({ minimum: 1, maximum: 36, default: 1, description: 'RF-PAY-010: cuotas, si el mercado las permite para pasajes.' })
  @IsInt()
  @Min(1)
  @Max(36)
  @IsOptional()
  cuotas?: number = 1;
}

export class OrdenParamDto {
  @ApiProperty({ example: 'ORD-7K3M9PQ2XA', description: 'Número de orden' })
  @ToUpperTrimmed()
  @Matches(/^ORD-[A-Z0-9]{10}$/)
  numero: string;
}

export class RecuperarOrdenQueryDto {
  @ApiPropertyOptional({ example: 'ORD-7K3M9PQ2XA' })
  @ToUpperTrimmed()
  @Matches(/^ORD-[A-Z0-9]{10}$/)
  @IsOptional()
  numero?: string;

  @ApiPropertyOptional({ example: 'ABC123', description: 'Código de reserva (PNR)' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z0-9]{6}$/)
  @IsOptional()
  pnr?: string;

  @ApiProperty({ example: 'Tapia', description: 'Apellido de cualquier pasajero.' })
  @IsString()
  @MaxLength(100)
  apellido: string;
}

/** Same proof as the public recovery, sent in the body because it is a write. */
export class VincularOrdenDto extends RecuperarOrdenQueryDto {}

export class HistorialOrdenesQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Cursor opaco de la página anterior.' })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  cursor?: string;
}

class ItinerarioOrdenDto {
  @ApiProperty() numeroVuelo: string;
  @ApiProperty() operador: { codigo: string; nombre: string };
  @ApiProperty() origen: string;
  @ApiProperty() destino: string;
  @ApiProperty() salida: string;
  @ApiProperty() llegada: string;
  @ApiProperty() familia: string;
}

class AsientoOrdenViewDto {
  @ApiProperty({ example: 'LA800' }) numeroVuelo: string;
  @ApiProperty({ example: '12A' }) asiento: string;
}

class PasajeroOrdenViewDto {
  @ApiProperty() id: string;
  @ApiProperty() tipo: string;
  @ApiProperty() nombres: string;
  @ApiProperty() apellidos: string;
  @ApiPropertyOptional({ nullable: true, description: 'Billete electrónico de 13 dígitos (RF-ORD-003).' }) eTicket: string | null;
  @ApiPropertyOptional({ type: [AsientoOrdenViewDto], description: 'Asientos elegidos, uno por trayecto.' }) asientos?: AsientoOrdenViewDto[];
  @ApiPropertyOptional({ description: 'Texto firmado del código QR del pasajero (v1.<billete>.<PNR>.<firma>); sin datos personales.' }) qr?: string;
}

export class VerificarBilleteQueryDto {
  @ApiProperty({ example: 'v1.1234567890123.ABC234.abcdefghijklmnopqrstuv', description: 'Texto del código QR de un billete.' })
  @IsString()
  @MaxLength(80)
  codigo: string;
}

class ItinerarioVerificadoDto {
  @ApiProperty() numeroVuelo: string;
  @ApiProperty() origen: string;
  @ApiProperty() destino: string;
  @ApiProperty() salida: string;
}

export class VerificacionBilleteViewDto {
  @ApiProperty({ description: 'false si el código no es auténtico o no corresponde a un billete emitido.' }) valido: boolean;
  @ApiPropertyOptional({ example: 'ISSUED' }) estado?: string;
  @ApiPropertyOptional() pnr?: string;
  @ApiPropertyOptional({ type: [ItinerarioVerificadoDto], description: 'Sin nombres ni datos de contacto.' }) itinerarios?: ItinerarioVerificadoDto[];
}

export class OrdenViewDto extends BaseResponseDto {
  @ApiProperty({ format: 'uuid' }) ordenId: string;
  @ApiProperty({ example: 'ORD-7K3M9PQ2XA' }) numeroOrden: string;
  @ApiPropertyOptional({ nullable: true, description: 'Localizador de la reserva (RN-20).' }) pnr: string | null;
  @ApiProperty({ enum: ['PENDIENTE_PAGO', 'PAGO_EN_VERIFICACION', 'PAGADA', 'EMITIDA', 'FALLIDA_COMPENSADA', 'MODIFICADA', 'DEVOLUCION_EN_CURSO', 'REEMBOLSADA', 'EN_VIAJE', 'COMPLETADA', 'EXPIRADA'] }) estado: string;
  @ApiProperty() mercado: string;
  @ApiProperty() total: MontoDto;
  @ApiProperty({ type: [ItinerarioOrdenDto] }) itinerarios: ItinerarioOrdenDto[];
  @ApiProperty({ type: [PasajeroOrdenViewDto] }) pasajeros: PasajeroOrdenViewDto[];
  @ApiPropertyOptional({ description: 'Solo en la vista del propietario; la recuperación pública lo enmascara.' }) contacto?: { correo: string; telefono: string };
  @ApiPropertyOptional({ format: 'uuid', description: 'Reserva del núcleo de vuelos tras la emisión: es el `bookingId` de las rutas de equipaje, cambio, cancelación, check-in y pases. Solo en la vista del propietario.' }) bookingId?: string;
  @ApiProperty() pago: { marca: string; ultimos4: string | null; cuotas: number };
  @ApiProperty() creadaEn: string;
  @ApiProperty() historial: { estado: string; en: string; motivo?: string }[];
}

export class OrdenesPaginaViewDto {
  @ApiProperty({ type: [OrdenViewDto] }) items: OrdenViewDto[];
  @ApiPropertyOptional() nextCursor?: string;
}
