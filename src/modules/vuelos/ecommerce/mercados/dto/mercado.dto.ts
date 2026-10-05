import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ToLowerTrimmed } from '../../../dto/validators';

export class MercadoParamDto {
  @ApiProperty({ example: 'ec', description: 'Código de mercado (ruta del portal)' })
  @ToLowerTrimmed()
  @Matches(/^[a-z]{2,5}$/, { message: 'codigo must be a market code such as ec or co' })
  codigo: string;
}

export class MedioPagoDto {
  @ApiProperty({ enum: ['TARJETA'] })
  @IsIn(['TARJETA'])
  tipo: 'TARJETA';

  @ApiProperty({ example: ['VISA', 'MASTERCARD', 'AMEX', 'DINERS'] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @Matches(/^[A-Z_]{2,20}$/, { each: true })
  marcas: string[];

  @ApiProperty({ example: [1, 3, 6] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(36, { each: true })
  cuotasPermitidas: number[];

  @ApiProperty({ example: ['PASAJE'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(['PASAJE', 'ADICIONAL'], { each: true })
  productos: ('PASAJE' | 'ADICIONAL')[];
}

export class DocumentoLegalDto {
  @ApiProperty({ example: '2026-10' })
  @Matches(/^[\w.-]{1,20}$/)
  version: string;

  @ApiProperty({ format: 'uri' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url: string;
}

export class TextosLegalesDto {
  @ApiProperty()
  @IsString()
  @Length(2, 200)
  razonSocial: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => DocumentoLegalDto)
  terminos: DocumentoLegalDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => DocumentoLegalDto)
  privacidad: DocumentoLegalDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => DocumentoLegalDto)
  condicionesTransporte: DocumentoLegalDto;
}

class RetractoDto {
  @IsInt()
  @Min(0)
  @Max(60)
  diasHabiles: number;
}

class DesistimientoDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  retencionPorcentaje: number;

  @IsInt()
  @Min(0)
  @Max(720)
  horasAntesDelVuelo: number;

  @IsArray()
  @Matches(/^[A-Z_]{2,20}$/, { each: true })
  familias: string[];
}

class TraspasoDto {
  @IsInt()
  @Min(0)
  @Max(720)
  horasAntesDelVuelo: number;

  @IsInt()
  @Min(0)
  @Max(10)
  maximoPorPasaje: number;

  @IsInt()
  @Min(0)
  @Max(20)
  maximoPorAnio: number;
}

export class ReglasRegulatoriasDto {
  @ApiPropertyOptional({ example: { diasHabiles: 5 } })
  @ValidateNested()
  @Type(() => RetractoDto)
  @IsOptional()
  retracto?: RetractoDto;

  @ApiPropertyOptional()
  @ValidateNested()
  @Type(() => DesistimientoDto)
  @IsOptional()
  desistimiento?: DesistimientoDto;

  @ApiPropertyOptional()
  @ValidateNested()
  @Type(() => TraspasoDto)
  @IsOptional()
  traspaso?: TraspasoDto;
}

export class IdentificacionFiscalDto {
  @ApiProperty({ example: 'RUC' })
  @Matches(/^[A-Z_]{2,20}$/)
  tipo: string;

  @ApiProperty({ example: 'RUC (13 dígitos)' })
  @IsString()
  @Length(2, 60)
  etiqueta: string;

  @ApiProperty({ example: '^\d{13}$', description: 'Expresión regular que debe cumplir el número completo.' })
  @IsString()
  @Length(1, 100)
  patron: string;
}

export class ActualizarMercadoDto {
  @ApiProperty({ description: 'Versión del mercado sobre la que se basa la edición (control optimista).' })
  @IsInt()
  @Min(1)
  versionEsperada: number;

  @ApiPropertyOptional()
  @IsString()
  @Length(2, 100)
  @IsOptional()
  nombre?: string;

  @ApiPropertyOptional({ description: 'Unidades de la moneda del mercado por 1 USD.' })
  @IsNumber({ maxDecimalPlaces: 6 })
  @IsPositive()
  @Max(1_000_000)
  @IsOptional()
  tipoCambioDesdeUsd?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @ApiPropertyOptional({ example: ['VUELOS', 'ALOJAMIENTOS'] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @Matches(/^[A-Z_]{2,30}$/, { each: true })
  @IsOptional()
  productosBuscador?: string[];

  @ApiPropertyOptional({ type: [MedioPagoDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MedioPagoDto)
  @IsOptional()
  mediosPago?: MedioPagoDto[];

  @ApiPropertyOptional()
  @ValidateNested()
  @Type(() => ReglasRegulatoriasDto)
  @IsOptional()
  reglasRegulatorias?: ReglasRegulatoriasDto;

  @ApiPropertyOptional()
  @ValidateNested()
  @Type(() => TextosLegalesDto)
  @IsOptional()
  textosLegales?: TextosLegalesDto;

  @ApiPropertyOptional({ type: [IdentificacionFiscalDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => IdentificacionFiscalDto)
  @IsOptional()
  identificacionesFiscales?: IdentificacionFiscalDto[];
}

export class AuditoriaQueryDto {
  @ApiPropertyOptional({ example: 'mercado', default: 'mercado' })
  @Matches(/^[a-z_]{2,50}$/)
  @IsOptional()
  entidad?: string;

  @ApiPropertyOptional({ example: 'ec', description: 'Si se omite, todos.' })
  @Matches(/^[\w-]{1,100}$/)
  @IsOptional()
  id?: string;
}

export class MercadoViewDto {
  @ApiProperty() codigo: string;
  @ApiProperty() pais: string;
  @ApiProperty() nombre: string;
  @ApiProperty({ type: [String] }) idiomas: string[];
  @ApiProperty() idiomaPorDefecto: string;
  @ApiProperty({ example: 'USD' }) moneda: string;
  @ApiProperty({ description: 'Decimales de la moneda (COP y CLP no usan decimales).' }) decimalesMoneda: number;
  @ApiProperty({ type: [String] }) productosBuscador: string[];
  @ApiProperty({ type: [MedioPagoDto] }) mediosPago: MedioPagoDto[];
  @ApiProperty() reglasRegulatorias: ReglasRegulatoriasDto;
  @ApiProperty() textosLegales: TextosLegalesDto;
  @ApiProperty({ type: [IdentificacionFiscalDto] }) identificacionesFiscales: IdentificacionFiscalDto[];
  @ApiProperty() activo: boolean;
  @ApiProperty() version: number;
}
