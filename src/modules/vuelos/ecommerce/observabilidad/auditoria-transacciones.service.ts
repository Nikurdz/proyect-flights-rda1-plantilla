import { randomUUID } from 'node:crypto';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainEvent, DomainEventBus } from '../../common/domain-event-bus';
import { currentActor, currentCorrelationId } from '../../common/correlation';
import { enlaceDeEvento } from '../../common/topologia';
import { AccionTraza, setAccionSink } from '../../common/traza-acciones';
import { escribirAuditoria } from '../../common/winston-logger';
import { AuditoriaTransaccion } from './entities/auditoria.entity';

// The identifiers an event may carry that are safe to keep: no names, e-mails or documents.
const CLAVES_SEGURAS = ['numeroOrden', 'ordenId', 'pnr', 'bookingId', 'holdId', 'status', 'estado', 'motivo', 'codigoVuelo', 'proveedorId', 'reservaExternaId'];

/**
 * Writes every domain event to `auditoria_transacciones` (the durable trail of what the system did). It is a consumer
 * like any other: idempotent by event id, and if it fails the bus isolates it from the producer.
 */
@Injectable()
export class AuditoriaTransaccionesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditoriaTransaccionesService.name);

  constructor(
    @InjectRepository(AuditoriaTransaccion) private readonly auditoria: Repository<AuditoriaTransaccion>,
    private readonly events: DomainEventBus,
  ) {}

  onModuleInit(): void {
    this.events.subscribeAll((event) => this.registrar(event));
    setAccionSink((accion) => void this.registrarAccion(accion));
  }

  onModuleDestroy(): void {
    setAccionSink(null);
  }

  async registrar(event: DomainEvent): Promise<void> {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    escribirAuditoria({ eventoId: event.id, tipo: event.type, agregadoId: event.aggregateId, correlationId: event.correlationId, resumen: this.resumen(payload) });
    const propietario = typeof payload.ownerId === 'string' ? payload.ownerId : typeof payload.clienteId === 'string' ? payload.clienteId : null;
    await this.auditoria
      .createQueryBuilder()
      .insert()
      .into(AuditoriaTransaccion)
      .values({
        eventoId: event.id,
        tipo: event.type.slice(0, 60),
        agregadoId: String(event.aggregateId).slice(0, 100),
        mercado: event.market,
        propietarioId: propietario?.slice(0, 100) ?? null,
        correlationId: event.correlationId.slice(0, 100),
        resumen: this.resumen(payload),
        ...this.contexto(event, payload),
        ocurridoEn: new Date(event.occurredAt),
      })
      .orIgnore()
      .execute();
  }

  /** Who caused the event, what it is about and which components talk (see common/topologia.ts). */
  private contexto(event: DomainEvent, payload: Record<string, unknown>) {
    const actor = event.actor ?? currentActor();
    const enlace = enlaceDeEvento(event.type);
    const numero = payload.numeroOrden ?? payload.pnr;
    return {
      actorId: actor?.id ?? null,
      actorTipo: actor?.tipo ?? 'SYSTEM',
      entidad: entidadDe(event.type),
      numero: typeof numero === 'string' ? numero.slice(0, 40) : null,
      origen: enlace?.origen ?? null,
      destino: enlace?.destino ?? null,
    };
  }

  /** An action that is not a domain event (sign-in, token, subscription, call to a partner): one row in the same trail. */
  async registrarAccion(accion: AccionTraza): Promise<void> {
    const enlace = enlaceDeEvento(accion.tipo);
    const actor = accion.actor ?? currentActor();
    const estado = accion.estado ?? 'OK';
    try {
      await this.auditoria
        .createQueryBuilder()
        .insert()
        .into(AuditoriaTransaccion)
        .values({
          eventoId: randomUUID(),
          tipo: accion.tipo.slice(0, 60),
          agregadoId: accion.agregadoId.slice(0, 100),
          mercado: null,
          propietarioId: null,
          correlationId: (accion.correlationId ?? currentCorrelationId()).slice(0, 100),
          resumen: `estado=${estado} ${accion.resumen}`.slice(0, 300),
          actorId: actor?.id ?? null,
          actorTipo: actor?.tipo ?? (accion.tipo.startsWith('llamada.') ? 'SYSTEM' : 'ANONIMO'),
          entidad: accion.tipo.split('.')[0].slice(0, 20),
          numero: null,
          origen: enlace?.origen ?? null,
          destino: enlace?.destino ?? null,
          ocurridoEn: new Date(),
        })
        .execute();
    } catch (error) {
      this.logger.warn(`Could not record action ${accion.tipo}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private resumen(payload: Record<string, unknown>): string {
    const partes: string[] = [];
    for (const clave of CLAVES_SEGURAS) {
      const valor = payload[clave];
      if (typeof valor === 'string' || typeof valor === 'number') partes.push(`${clave}=${valor}`);
    }
    return partes.join(' ').slice(0, 300);
  }
}

/** The kind of thing an event type is about. */
export function entidadDe(tipo: string): string {
  const prefijo = tipo.split('.')[0];
  if (tipo.startsWith('Orden')) return 'orden';
  if (tipo.startsWith('Pago')) return 'pago';
  if (tipo.startsWith('Oferta')) return 'oferta';
  if (tipo.startsWith('Cliente') || tipo.startsWith('Cuenta') || tipo.startsWith('Consentimiento')) return 'cliente';
  if (tipo.startsWith('Configuracion')) return 'mercado';
  if (tipo.startsWith('proveedor')) return 'proveedor';
  if (tipo.startsWith('ReservaExterna')) return 'reserva_externa';
  return prefijo === 'flight' ? 'vuelo' : prefijo === 'pagos' ? 'pago' : prefijo === 'paquetes' ? 'paquete' : prefijo.slice(0, 20);
}
