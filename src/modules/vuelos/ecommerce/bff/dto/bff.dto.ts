import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { MontoDto } from '../../catalogo/dto/catalogo.dto';
import { OrdenViewDto } from '../../ordenes/dto/ordenes.dto';

export class AccionOrdenDto {
  @ApiProperty({ enum: ['CHECKIN', 'CANCELAR'] }) codigo: string;
  @ApiProperty({ enum: ['GET', 'POST'] }) metodo: string;
  @ApiProperty({ example: '/api/v1/bookings/9d3f6a10-7b2e-4f8a-bc11-2a6e5d4c3b21/cancel' }) href: string;
  @ApiProperty({ description: 'true si la llamada exige el header Idempotency-Key.' }) requiereIdempotencia: boolean;
}

// ---- Móvil: lo mínimo para pintar la pantalla ----

export class MovilOrdenResumenDto {
  @ApiProperty({ example: 'ORD-7K3M9PQ2XA' }) numero: string;
  @ApiProperty() estado: string;
  @ApiProperty({ example: '386.40' }) total: string;
  @ApiProperty({ example: 'USD' }) moneda: string;
  @ApiProperty({ example: 'UIO-GYE', description: 'Origen y escalas hasta el destino final.' }) ruta: string;
  @ApiPropertyOptional({ description: 'Salida del primer tramo (UTC).' }) salida?: string;
  @ApiProperty({ description: 'Cantidad de pasajeros.' }) pax: number;
}

export class MovilOrdenesPaginaDto {
  @ApiProperty({ type: [MovilOrdenResumenDto] }) items: MovilOrdenResumenDto[];
  @ApiPropertyOptional({ description: 'Cursor opaco de la página siguiente.' }) next?: string;
}

export class MovilTramoDto {
  @ApiProperty({ example: 'LA800' }) vuelo: string;
  @ApiProperty({ example: 'UIO' }) de: string;
  @ApiProperty({ example: 'GYE' }) a: string;
  @ApiProperty() sale: string;
  @ApiProperty() llega: string;
}

export class MovilPasajeroDto {
  @ApiProperty({ example: 'David Tapia' }) nombre: string;
  @ApiPropertyOptional({ nullable: true }) eTicket: string | null;
  @ApiProperty({ type: [String], example: ['12A'], description: 'Un asiento por tramo, en el orden de `tramos`; vacío si no eligió.' }) asientos: string[];
  @ApiPropertyOptional({ description: 'Texto firmado del QR del pasajero (sin datos personales).' }) qr?: string;
}

export class MovilOrdenDto {
  @ApiProperty() numero: string;
  @ApiPropertyOptional({ nullable: true }) pnr: string | null;
  @ApiProperty() estado: string;
  @ApiProperty({ example: '386.40' }) total: string;
  @ApiProperty({ example: 'USD' }) moneda: string;
  @ApiProperty({ type: [MovilTramoDto] }) tramos: MovilTramoDto[];
  @ApiProperty({ type: [MovilPasajeroDto] }) pasajeros: MovilPasajeroDto[];
  @ApiProperty({ type: [String], enum: ['CHECKIN', 'CANCELAR'], description: 'Acciones disponibles ahora (pista; el servidor valida al ejecutarlas).' }) acciones: string[];
}

// ---- Web: la orden completa del dueño ----

export class WebImportesDto {
  @ApiPropertyOptional({ type: MontoDto, description: 'Subtotal de la factura; ausente si aún no hay factura.' }) subtotal?: MontoDto;
  @ApiPropertyOptional({ type: MontoDto, description: 'IVA de la factura; ausente si aún no hay factura.' }) impuestos?: MontoDto;
  @ApiProperty({ type: MontoDto }) total: MontoDto;
}

export class FacturaResumenDto {
  @ApiProperty({ example: '001-001-000000123' }) numero: string;
  @ApiProperty() emitidaEn: string;
  @ApiProperty({ enum: ['EMITIDA', 'ANULADA'] }) estado: string;
}

export class WebOrdenDto extends OrdenViewDto {
  @ApiProperty({ type: WebImportesDto }) importes: WebImportesDto;
  @ApiPropertyOptional({ type: FacturaResumenDto }) factura?: FacturaResumenDto;
  @ApiProperty({ type: [AccionOrdenDto] }) acciones: AccionOrdenDto[];
}

// ---- Administrador: expediente con auditoría ----

export class ExpedientePagoDto {
  @ApiProperty() marca: string;
  @ApiPropertyOptional({ nullable: true }) ultimos4: string | null;
  @ApiProperty() cuotas: number;
  @ApiPropertyOptional({ description: 'Estado del pago (CAPTURADO, REEMBOLSADO…).' }) estado?: string;
  @ApiPropertyOptional({ nullable: true, description: 'Referencia de autorización de la pasarela.' }) referencia?: string | null;
}

export class ExpedienteSagaPasoDto {
  @ApiProperty() secuencia: number;
  @ApiProperty() nombre: string;
  @ApiProperty({ enum: ['OK', 'ERROR', 'COMPENSADO', 'OMITIDO'] }) estado: string;
  @ApiPropertyOptional({ nullable: true }) detalle: string | null;
  @ApiProperty() duracionMs: number;
}

export class ExpedienteSagaDto {
  @ApiProperty() sagaId: string;
  @ApiProperty() tipo: string;
  @ApiProperty({ enum: ['EN_CURSO', 'COMPLETADA', 'COMPENSADA', 'FALLIDA'] }) estado: string;
  @ApiProperty() correlationId: string;
  @ApiPropertyOptional({ nullable: true }) error: string | null;
  @ApiProperty() iniciadaEn: string;
  @ApiPropertyOptional({ nullable: true }) finalizadaEn: string | null;
  @ApiProperty({ type: [ExpedienteSagaPasoDto] }) pasos: ExpedienteSagaPasoDto[];
}

export class ExpedienteEventoDto {
  @ApiProperty({ example: 'OrdenEmitida' }) tipo: string;
  @ApiProperty() agregadoId: string;
  @ApiProperty() correlationId: string;
  @ApiProperty({ description: 'Identificadores del evento, sin datos personales.' }) resumen: string;
  @ApiProperty() ocurridoEn: string;
}

export class ExpedienteAuditoriaDto {
  @ApiProperty({ type: [ExpedienteSagaDto] }) sagas: ExpedienteSagaDto[];
  @ApiProperty({ type: [ExpedienteEventoDto], description: 'Hasta 50 eventos, del más antiguo al más reciente.' }) eventos: ExpedienteEventoDto[];
}

export class ExpedienteOrdenDto extends OmitType(OrdenViewDto, ['pago'] as const) {
  @ApiProperty({ format: 'uuid' }) ofertaId: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) clienteId: string | null;
  @ApiProperty({ enum: ['cliente', 'invitado'] }) comprador: string;
  @ApiProperty() canal: string;
  @ApiProperty({ type: ExpedientePagoDto }) pago: ExpedientePagoDto;
  @ApiProperty({ type: WebImportesDto }) importes: WebImportesDto;
  @ApiPropertyOptional({ type: FacturaResumenDto }) factura?: FacturaResumenDto;
  @ApiProperty({ type: [String], description: 'Estados a los que la máquina de estados permite pasar desde el actual.' }) transicionesPosibles: string[];
  @ApiProperty({ type: ExpedienteAuditoriaDto }) auditoria: ExpedienteAuditoriaDto;
}
