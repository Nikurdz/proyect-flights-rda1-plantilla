import { Field, Float, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Allow } from 'class-validator';

// ---- output types (the BFF shapes: what a screen needs, joined) ----

@ObjectType('Dinero')
export class DineroGql {
  @Field() moneda: string;
  @Field({ description: 'Importe con los decimales de la moneda.' }) monto: string;
}

@ObjectType('Vuelo')
export class VueloGql {
  @Field(() => String) id: string;
  @Field() codigoVuelo: string;
  @Field() aerolinea: string;
  @Field() origen: string;
  @Field() destino: string;
  @Field() salida: string;
  @Field() llegada: string;
  @Field(() => Int) asientosDisponibles: number;
  @Field(() => Float, { description: 'Tarifa base en USD, antes de la familia tarifaria y los impuestos.' }) precioBaseUsd: number;
}

@ObjectType('Experiencia')
export class ExperienciaGql {
  @Field(() => String) id: string;
  @Field() proveedor: string;
  @Field() tipo: string;
  @Field() nombre: string;
  @Field() descripcion: string;
  @Field(() => String, { nullable: true }) duracion: string | null;
  @Field(() => DineroGql, { description: 'Precio por persona.' }) precio: DineroGql;
  @Field(() => String, { nullable: true }) imagenUrl: string | null;
  @Field() cancelacionGratis: boolean;
  @Field(() => [String]) categorias: string[];
}

@ObjectType('CatalogoUnificado')
export class CatalogoUnificadoGql {
  @Field(() => [VueloGql]) vuelos: VueloGql[];
  @Field(() => [ExperienciaGql]) experiencias: ExperienciaGql[];
}

@ObjectType('FacturaDetalle')
export class FacturaDetalleGql {
  @Field(() => Int) linea: number;
  @Field() tipo: string;
  @Field() concepto: string;
  @Field(() => Int) cantidad: number;
  @Field(() => DineroGql) precioUnitario: DineroGql;
  @Field(() => DineroGql) iva: DineroGql;
  @Field(() => DineroGql) total: DineroGql;
}

@ObjectType('Factura')
export class FacturaGql {
  @Field() numeroFactura: string;
  @Field() estado: string;
  @Field() emitidaEn: string;
  @Field(() => DineroGql) subtotal: DineroGql;
  @Field(() => DineroGql) iva: DineroGql;
  @Field(() => DineroGql) total: DineroGql;
  @Field(() => String, { nullable: true, description: 'La orden de vuelo que se factura.' }) ordenId: string | null;
  @Field(() => String, { nullable: true, description: 'La reserva de experiencia que se factura.' }) reservaExternaId: string | null;
  @Field(() => [FacturaDetalleGql]) detalles: FacturaDetalleGql[];
}

@ObjectType('Itinerario')
export class ItinerarioGql {
  @Field() numeroVuelo: string;
  @Field() origen: string;
  @Field() destino: string;
  @Field() salida: string;
  @Field() llegada: string;
}

@ObjectType('Orden')
export class OrdenGql {
  @Field(() => String) ordenId: string;
  @Field() numeroOrden: string;
  @Field(() => String, { nullable: true }) pnr: string | null;
  @Field() estado: string;
  @Field(() => DineroGql) total: DineroGql;
  @Field() creadaEn: string;
  @Field(() => [ItinerarioGql]) itinerarios: ItinerarioGql[];
  @Field(() => FacturaGql, { nullable: true, description: 'Se resuelve en lote (DataLoader).' }) factura?: FacturaGql | null;
}

@ObjectType('ReservaExterna')
export class ReservaExternaGql {
  @Field(() => String) id: string;
  @Field() estado: string;
  @Field(() => String) experienciaId: string;
  @Field() experiencia: string;
  @Field() proveedor: string;
  @Field() fecha: string;
  @Field(() => String, { nullable: true }) hora: string | null;
  @Field(() => Int) cantidad: number;
  @Field(() => DineroGql) total: DineroGql;
  @Field(() => String, { nullable: true }) referenciaProveedor: string | null;
  @Field(() => String, { nullable: true }) motivo: string | null;
  @Field() creadaEn: string;
  @Field(() => FacturaGql, { nullable: true, description: 'Se resuelve en lote (DataLoader).' }) factura?: FacturaGql | null;
}

@ObjectType('MisReservas')
export class MisReservasGql {
  @Field(() => [OrdenGql]) ordenes: OrdenGql[];
  @Field(() => [ReservaExternaGql]) experiencias: ReservaExternaGql[];
}

@ObjectType('SaludNodo')
export class SaludNodoGql {
  @Field(() => String) id: string;
  @Field() nombre: string;
  @Field() equipo: string;
  @Field() tipoServicio: string;
  @Field() activo: boolean;
  @Field({ description: 'UP, DEGRADADO, DOWN, SIN_DATOS o APAGADO.' }) estado: string;
  @Field(() => Int, { nullable: true }) latenciaMs: number | null;
  @Field(() => String, { nullable: true }) detalle: string | null;
  @Field(() => String, { nullable: true }) comprobadoEn: string | null;
  @Field({ description: 'Circuit breaker: CERRADO, ABIERTO o SEMIABIERTO.' }) circuito: string;
  @Field(() => Int) productos: number;
}

@ObjectType('AuditoriaTransaccion')
export class AuditoriaTransaccionGql {
  @Field(() => String) id: string;
  @Field(() => String) eventoId: string;
  @Field() tipo: string;
  @Field() agregadoId: string;
  @Field(() => String, { nullable: true }) propietarioId: string | null;
  @Field() correlationId: string;
  @Field() resumen: string;
  @Field() ocurridoEn: string;
}

@ObjectType('SagaPaso')
export class SagaPasoGql {
  @Field(() => Int) secuencia: number;
  @Field() nombre: string;
  @Field() estado: string;
  @Field(() => String, { nullable: true }) detalle: string | null;
  @Field(() => Int) duracionMs: number;
}

@ObjectType('AuditoriaSaga')
export class AuditoriaSagaGql {
  @Field(() => String) sagaId: string;
  @Field() tipo: string;
  @Field() referencia: string;
  @Field() correlationId: string;
  @Field() estado: string;
  @Field(() => String, { nullable: true }) error: string | null;
  @Field() iniciadaEn: string;
  @Field(() => String, { nullable: true }) finalizadaEn: string | null;
  @Field(() => [SagaPasoGql]) pasos: SagaPasoGql[];
}

@ObjectType('PasajeroCheckIn')
export class PasajeroCheckInGql {
  @Field() passengerId: string;
  @Field() estado: string;
}

@ObjectType('CheckIn')
export class CheckInGql {
  @Field(() => String) bookingId: string;
  @Field() estado: string;
  @Field(() => [PasajeroCheckInGql]) pasajeros: PasajeroCheckInGql[];
}

@ObjectType('EstadoReservaCambiado')
export class EstadoReservaCambiadoGql {
  @Field() evento: string;
  @Field() agregadoId: string;
  @Field() correlationId: string;
  @Field() ocurridoEn: string;
}

// ---- input types. The real validation is the REST DTO's (same rules, one place); `@Allow()` only lets the global pipe pass them. ----

@InputType('FacturacionInput')
export class FacturacionInputGql {
  @Field() @Allow() tipoIdentificacion: string;
  @Field() @Allow() numeroIdentificacion: string;
  @Field() @Allow() razonSocial: string;
  @Field() @Allow() direccion: string;
  @Field() @Allow() pais: string;
}

@InputType('MedioPagoInput')
export class MedioPagoInputGql {
  @Field({ defaultValue: 'TARJETA' }) @Allow() tipo: string;
  @Field({ description: 'Token de la pasarela, nunca el número de tarjeta.' }) @Allow() token: string;
  @Field() @Allow() marca: string;
}

@InputType('ReservarExperienciaInput')
export class ReservarExperienciaInputGql {
  @Field(() => String, { description: 'YYYY-MM-DD' }) @Allow() fecha: string;
  @Field(() => String, { nullable: true, description: 'HH:MM' }) @Allow() hora?: string;
  @Field(() => Int) @Allow() cantidad: number;
  @Field() @Allow() nombre: string;
  @Field() @Allow() correo: string;
  @Field(() => FacturacionInputGql) @Allow() facturacion: FacturacionInputGql;
  @Field(() => MedioPagoInputGql) @Allow() medio: MedioPagoInputGql;
}
