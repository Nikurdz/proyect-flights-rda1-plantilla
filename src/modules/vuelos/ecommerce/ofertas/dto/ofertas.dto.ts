import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DOCUMENT_TYPES, GENDERS, PASSENGER_TYPE_VALUES } from '../../../dto/enums';
import { E164_PHONE, IsDateOnly, ToLowerTrimmed, ToUpperTrimmed } from '../../../dto/validators';
import { BaseResponseDto } from '../../../../../common/dto/base-response.dto';
import { MontoDto } from '../../catalogo/dto/catalogo.dto';

export const NECESIDADES_ESPECIALES = ['MOVILIDAD_REDUCIDA', 'MENOR_NO_ACOMPANADO', 'ALIMENTACION_ESPECIAL', 'MASCOTA'] as const;

export class SeleccionTrayectoDto {
  @ApiProperty({ format: 'uuid', description: 'itinerarioId devuelto por /disponibilidad' })
  @IsUUID()
  itinerarioId: string;

  @ApiProperty({ example: 'LIGHT' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z_]{2,20}$/)
  familia: string;
}

export class ComposicionDto {
  @ApiProperty({ minimum: 1, maximum: 50, example: 1 })
  @IsInt()
  @Min(1)
  @Max(50)
  adultos: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 50, default: 0 })
  @IsInt()
  @Min(0)
  @Max(50)
  @IsOptional()
  jovenes?: number = 0;

  @ApiPropertyOptional({ minimum: 0, maximum: 50, default: 0 })
  @IsInt()
  @Min(0)
  @Max(50)
  @IsOptional()
  ninos?: number = 0;

  @ApiPropertyOptional({ minimum: 0, maximum: 50, default: 0, description: 'Infantes sin asiento (no más que adultos).' })
  @IsInt()
  @Min(0)
  @Max(50)
  @IsOptional()
  infantes?: number = 0;
}

export class ArmarOfertaDto {
  @ApiProperty({ example: 'ec', description: 'Mercado fijado al iniciar la transacción (RN-01).' })
  @ToLowerTrimmed()
  @Matches(/^[a-z]{2,5}$/)
  mercado: string;

  @ApiProperty({ type: [SeleccionTrayectoDto], minItems: 1, maxItems: 2, description: 'Ida, y vuelta si es ida y vuelta, en ese orden.' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => SeleccionTrayectoDto)
  selecciones: SeleccionTrayectoDto[];

  @ApiProperty()
  @ValidateNested()
  @Type(() => ComposicionDto)
  pasajeros: ComposicionDto;
}

class DocumentoDto {
  @ApiProperty({ enum: DOCUMENT_TYPES })
  @IsIn(DOCUMENT_TYPES)
  tipo: 'PASSPORT' | 'NATIONAL_ID';

  @ApiProperty()
  @Matches(/^[A-Za-z0-9-]{4,50}$/)
  numero: string;

  @ApiPropertyOptional({ format: 'date', description: 'Obligatorio cuando algún trayecto cruza fronteras.' })
  @IsDateOnly()
  @IsOptional()
  vencimiento?: string;
}

export class PasajeroDto {
  @ApiProperty({ description: 'Identificador elegido por el cliente, único en la oferta.' })
  @Matches(/^[A-Za-z0-9_-]{1,100}$/)
  id: string;

  @ApiProperty({ enum: PASSENGER_TYPE_VALUES })
  @IsIn(PASSENGER_TYPE_VALUES)
  tipo: 'ADULT' | 'YOUTH' | 'CHILD' | 'INFANT';

  @ApiPropertyOptional({ description: 'id del adulto con el que viaja un infante.' })
  @Matches(/^[A-Za-z0-9_-]{1,100}$/)
  @IsOptional()
  asociadoA?: string;

  @ApiProperty({ description: 'Debe coincidir con el documento de viaje (RN-15).' })
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

  @ApiProperty({ enum: GENDERS })
  @IsIn(GENDERS)
  genero: 'M' | 'F' | 'X';

  @ApiProperty({ example: 'EC', description: 'ISO 3166-1 alpha-2' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z]{2}$/)
  nacionalidad: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => DocumentoDto)
  documento: DocumentoDto;

  @ApiPropertyOptional({ description: 'RF-CHK-006: número LATAM Pass del pasajero.' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z0-9]{6,20}$/)
  @IsOptional()
  numeroSocio?: string;

  @ApiPropertyOptional({ enum: ['MOVILIDAD_REDUCIDA', 'MENOR_NO_ACOMPANADO', 'ALIMENTACION_ESPECIAL', 'MASCOTA'], isArray: true })
  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(NECESIDADES_ESPECIALES, { each: true })
  @IsOptional()
  necesidades?: string[];
}

export class ContactoDto {
  @ApiProperty({ format: 'email' })
  @ToLowerTrimmed()
  @IsEmail()
  @MaxLength(150)
  correo: string;

  @ApiProperty({ example: '+593999999999', description: 'E.164, con código de país (RF-CHK-005).' })
  @Matches(E164_PHONE, { message: 'telefono must be an E.164 number such as +593999999999' })
  telefono: string;
}

export class RegistrarPasajerosDto {
  @ApiProperty({ type: [PasajeroDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PasajeroDto)
  pasajeros: PasajeroDto[];

  @ApiProperty()
  @ValidateNested()
  @Type(() => ContactoDto)
  contacto: ContactoDto;
}

export class FacturacionDto {
  @ApiProperty({ example: 'CEDULA', description: 'Uno de los tipos del mercado (ver GET /mercados/{pais}).' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z_]{2,20}$/)
  tipoIdentificacion: string;

  @ApiProperty({ example: '1712345678' })
  @Matches(/^[A-Za-z0-9.-]{3,30}$/)
  numeroIdentificacion: string;

  @ApiProperty()
  @IsString()
  @Length(2, 200)
  razonSocial: string;

  @ApiProperty()
  @IsString()
  @Length(3, 250)
  direccion: string;

  @ApiProperty({ example: 'EC' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z]{2}$/)
  pais: string;
}

export class AceptarCondicionesDto {
  @ApiProperty({ example: '2026-10', description: 'Versión de los términos que el comprador vio (debe ser la vigente del mercado).' })
  @Matches(/^[\w.-]{1,20}$/)
  versionTerminos: string;

  @ApiProperty({ example: '2026-10' })
  @Matches(/^[\w.-]{1,20}$/)
  versionCondicionesTransporte: string;
}

export class AceptarPrecioDto {
  @ApiProperty({ example: '1371000', description: 'El nuevo total, tal como lo devolvió la revalidación.' })
  @Matches(/^\d{1,12}(\.\d{1,6})?$/)
  totalAceptado: string;
}

export class OfertaParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id: string;
}

class TrayectoViewDto {
  @ApiProperty() itinerarioId: string;
  @ApiProperty() numeroVuelo: string;
  @ApiProperty() origen: string;
  @ApiProperty() destino: string;
  @ApiProperty() salida: string;
  @ApiProperty() llegada: string;
  @ApiProperty() familia: string;
  @ApiProperty() total: MontoDto;
}

class PasajeroRegistradoDto {
  @ApiProperty() id: string;
  @ApiProperty() tipo: string;
  @ApiProperty() nombres: string;
  @ApiProperty() apellidos: string;
}

export class OfertaViewDto extends BaseResponseDto {
  @ApiProperty({ format: 'uuid' }) ofertaId: string;
  @ApiProperty({ enum: ['ABIERTA', 'EN_REVISION_PRECIO', 'EN_PAGO', 'PAGADA', 'VENCIDA', 'CANCELADA'] }) estado: string;
  @ApiProperty() mercado: string;
  @ApiProperty() moneda: string;
  @ApiProperty({ type: [TrayectoViewDto] }) trayectos: TrayectoViewDto[];
  @ApiProperty() pasajeros: { adultos: number; jovenes: number; ninos: number; infantes: number };
  @ApiProperty({ description: 'RF-CRT-004: total persistente, con impuestos.' }) total: MontoDto;
  @ApiPropertyOptional({ description: 'RN-12: nuevo precio en espera de aceptación.' }) precioPendienteDeAceptar?: MontoDto;
  @ApiProperty({ description: 'RF-CRT-005: vigencia; al vencer se libera el inventario.' }) venceEn: string;
  @ApiProperty() segundosRestantes: number;
  @ApiProperty({ type: [String], enum: ['PASAJEROS', 'FACTURACION', 'CONDICIONES', 'ACEPTAR_PRECIO'], description: 'Lo que falta antes de poder pagar.' }) faltantes: string[];
  @ApiPropertyOptional({ type: [PasajeroRegistradoDto] }) pasajerosRegistrados?: PasajeroRegistradoDto[];
  @ApiPropertyOptional() condicionesAceptadas?: { terminos: string; condicionesTransporte: string; aceptadoEn: string };
  @ApiPropertyOptional({ type: [String], description: 'Ajustes aplicados a los datos, p. ej. nombres normalizados (RF-CHK-003).' }) advertencias?: string[];
}

export class RevalidacionViewDto {
  @ApiProperty() vigente: boolean;
  @ApiProperty({ description: 'RF-CRT-003: si el precio cambió, el flujo se detiene hasta que el cliente acepte.' }) cambioDePrecio: boolean;
  @ApiProperty() precioAnterior: MontoDto;
  @ApiProperty() precioNuevo: MontoDto;
  @ApiProperty() venceEn: string;
}

export class MedioPagoViewDto {
  @ApiProperty({ example: 'TARJETA' }) tipo: string;
  @ApiProperty({ type: [String] }) marcas: string[];
  @ApiProperty({ type: [Number] }) cuotasPermitidas: number[];
}
