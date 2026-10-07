import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { CABIN_CLASSES } from '../../../dto/enums';
import { IsDateOnly, ToLowerTrimmed, ToUpperTrimmed } from '../../../dto/validators';

export const ORDENAMIENTOS = [
  'RECOMENDADO',
  'MAS_BARATOS',
  'MAS_RAPIDOS',
  'SALIDA_TEMPRANO',
  'SALIDA_TARDE',
  'LLEGADA_TEMPRANO',
  'LLEGADA_TARDE',
] as const;
export type Ordenamiento = (typeof ORDENAMIENTOS)[number];

export class LocalidadesQueryDto {
  @ApiPropertyOptional({ example: 'bog', description: 'Prefijo del código IATA, la ciudad o el aeropuerto (sin distinguir acentos ni mayúsculas). Si se omite, lista todas.' })
  @IsString()
  @MaxLength(60)
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ example: 'ec' })
  @ToLowerTrimmed()
  @Matches(/^[a-z]{2,5}$/)
  @IsOptional()
  mercado?: string;
}

export class LocalidadViewDto {
  @ApiProperty({ example: 'BOG' }) iata: string;
  @ApiProperty({ example: 'Bogotá' }) ciudad: string;
  @ApiProperty({ example: 'El Dorado' }) nombre: string;
  @ApiProperty({ example: 'CO' }) pais: string;
  @ApiProperty({ example: 'Colombia' }) paisNombre: string;
  @ApiProperty({ example: 'America/Bogota' }) zonaHoraria: string;
}

/** Deep-link criteria (RF-SHP-011): the same names the portal puts in the URL. */
export class DisponibilidadQueryDto {
  @ApiPropertyOptional({ example: 'BOG', description: 'Origen. Si se omite, cualquier origen.' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z]{3}$/)
  @IsOptional()
  origin?: string;

  @ApiPropertyOptional({ example: 'SCL', description: 'Destino. Si se omite, cualquier destino.' })
  @ToUpperTrimmed()
  @Matches(/^[A-Z]{3}$/)
  @IsOptional()
  destination?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Fecha de ida. Si se omite, mañana.' })
  @IsDateOnly()
  @IsOptional()
  outbound?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Fecha de vuelta (ida y vuelta)' })
  @IsDateOnly()
  @IsOptional()
  inbound?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  adt?: number = 1;

  @ApiPropertyOptional({ minimum: 0, maximum: 50, default: 0, description: 'Niños' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  @IsOptional()
  chd?: number = 0;

  @ApiPropertyOptional({ minimum: 0, maximum: 50, default: 0, description: 'Infantes sin asiento' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  @IsOptional()
  inf?: number = 0;

  @ApiPropertyOptional({ enum: ['RT', 'OW'], description: 'RT ida y vuelta; OW solo ida. Se infiere de `inbound` si se omite.' })
  @IsIn(['RT', 'OW'])
  @IsOptional()
  trip?: 'RT' | 'OW';

  @ApiPropertyOptional({ enum: CABIN_CLASSES, default: 'ECONOMY' })
  @IsIn(CABIN_CLASSES)
  @IsOptional()
  cabin?: string;

  @ApiPropertyOptional({ enum: ORDENAMIENTOS, default: 'RECOMENDADO' })
  @IsIn(ORDENAMIENTOS)
  @IsOptional()
  sort?: Ordenamiento;

  @ApiPropertyOptional({ example: 'ec', default: 'ec' })
  @ToLowerTrimmed()
  @Matches(/^[a-z]{2,5}$/)
  @IsOptional()
  mercado?: string;
}

export class TarifasParamDto {
  @ApiProperty({ format: 'uuid', description: 'itinerarioId devuelto por /disponibilidad' })
  @IsUUID()
  id: string;
}

export class TarifasQueryDto {
  @ApiPropertyOptional({ example: 'ec', default: 'ec' })
  @ToLowerTrimmed()
  @Matches(/^[a-z]{2,5}$/)
  @IsOptional()
  mercado?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  adt?: number = 1;

  @ApiPropertyOptional({ minimum: 0, maximum: 50, default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  @IsOptional()
  chd?: number = 0;

  @ApiPropertyOptional({ minimum: 0, maximum: 50, default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  @IsOptional()
  inf?: number = 0;
}

export class MontoDto {
  @ApiProperty({ example: 'USD' }) moneda: string;
  @ApiProperty({ example: '345.00', description: 'Importe con los decimales de la moneda del mercado.' }) monto: string;
}

export class ItinerarioDto {
  @ApiProperty({ format: 'uuid' }) itinerarioId: string;
  @ApiProperty({ example: 'LA800' }) numeroVuelo: string;
  @ApiProperty({ description: 'RF-SHP-016: aerolínea que opera el tramo.' }) operador: { codigo: string; nombre: string };
  @ApiProperty() origen: { iata: string; ciudad: string; nombre: string };
  @ApiProperty() destino: { iata: string; ciudad: string; nombre: string };
  @ApiProperty() salida: string;
  @ApiProperty() llegada: string;
  @ApiProperty() duracionMinutos: number;
  @ApiProperty({ description: 'Siempre 0 en esta fase (solo vuelos directos).' }) escalas: number;
  @ApiProperty({ description: 'La llegada es en un día distinto de la salida (UTC).' }) cruceDeDia: boolean;
  @ApiProperty({ description: 'RF-PRC-010: menor precio por adulto entre las familias, con impuestos.' }) precioDesde: MontoDto;
  @ApiProperty({ example: 'BASIC' }) familiaDesde: string;
  @ApiProperty({ type: [String], enum: ['RECOMENDADO', 'MAS_ECONOMICO', 'MAS_RAPIDO'], description: 'RF-SHP-018: pueden coexistir.' }) distintivos: string[];
  @ApiProperty({ description: 'RF-SHP-019: "Últimos asientos a este precio".' }) ultimosAsientos: boolean;
  @ApiProperty({ description: 'El vuelo no tiene asientos suficientes para el grupo buscado: se muestra pero no se puede reservar (crear la oferta responde 409 SEAT_TAKEN). Va al final de la lista y sin distintivos.' }) agotado: boolean;
}

export class FechaAlternativaDto {
  @ApiProperty({ format: 'date' }) fecha: string;
  @ApiProperty() precioDesde: MontoDto;
}

export class TrayectoDisponibleDto {
  @ApiProperty({ enum: ['IDA', 'VUELTA'] }) sentido: string;
  @ApiPropertyOptional({ nullable: true, description: 'null si la búsqueda no fijó origen.' }) origen: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'null si la búsqueda no fijó destino.' }) destino: string | null;
  @ApiProperty({ format: 'date' }) fecha: string;
  @ApiProperty({ type: [ItinerarioDto] }) itinerarios: ItinerarioDto[];
  @ApiPropertyOptional({ type: [FechaAlternativaDto], description: 'RF-SHP-024: fechas cercanas con vuelos cuando este trayecto no tiene disponibilidad.' }) fechasAlternativas?: FechaAlternativaDto[];
}

export class DisponibilidadViewDto {
  @ApiProperty() mercado: string;
  @ApiProperty() moneda: string;
  @ApiProperty({ type: [TrayectoDisponibleDto] }) trayectos: TrayectoDisponibleDto[];
  @ApiProperty({ description: 'RF-SHP-024: resultado vacío, distinto de un error.' }) sinDisponibilidad: boolean;
}

export class FamiliaTarifariaDto {
  @ApiProperty({ example: 'LIGHT' }) codigo: string;
  @ApiProperty() nombre: string;
  @ApiProperty({ example: 'ECONOMY' }) cabina: string;
  @ApiProperty({ description: 'Unitario por tipo de pasajero presente en la búsqueda.' }) precioPorPasajero: { tipo: string; base: MontoDto; tasas: MontoDto; total: MontoDto }[];
  @ApiProperty({ description: 'Total del grupo en este tramo.' }) totalGrupo: MontoDto;
  @ApiProperty({ description: 'RF-PRC-003: condiciones estructuradas, no texto libre.' }) condiciones: {
    equipajeMano: { incluido: boolean; kg: number };
    equipajeBodega: { piezas: number };
    cambio: { permitido: boolean };
    devolucion: { permitida: boolean };
    seleccionAsiento: { incluida: boolean };
    upgrade: { elegible: boolean };
    factorAcumulacion: number;
  };
  @ApiProperty() asientosDisponibles: number;
}

export class TarifasViewDto {
  @ApiProperty({ format: 'uuid' }) itinerarioId: string;
  @ApiProperty() mercado: string;
  @ApiProperty() moneda: string;
  @ApiProperty({ description: 'RF-PRC-009: la cotización vale hasta este instante.' }) vigenteHasta: string;
  @ApiProperty({ type: [FamiliaTarifariaDto] }) familias: FamiliaTarifariaDto[];
}
