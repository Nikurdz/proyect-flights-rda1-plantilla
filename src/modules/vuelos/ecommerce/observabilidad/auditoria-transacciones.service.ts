import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainEvent, DomainEventBus } from '../../common/domain-event-bus';
import { AuditoriaTransaccion } from './entities/auditoria.entity';

// The identifiers an event may carry that are safe to keep: no names, e-mails or documents.
const CLAVES_SEGURAS = ['numeroOrden', 'ordenId', 'pnr', 'bookingId', 'holdId', 'status', 'estado', 'motivo', 'codigoVuelo', 'proveedorId', 'reservaExternaId'];

/**
 * Writes every domain event to `auditoria_transacciones` (the durable trail of what the system did). It is a consumer
 * like any other: idempotent by event id, and if it fails the bus isolates it from the producer.
 */
@Injectable()
export class AuditoriaTransaccionesService implements OnModuleInit {
  constructor(
    @InjectRepository(AuditoriaTransaccion) private readonly auditoria: Repository<AuditoriaTransaccion>,
    private readonly events: DomainEventBus,
  ) {}

  onModuleInit(): void {
    this.events.subscribeAll((event) => this.registrar(event));
  }

  async registrar(event: DomainEvent): Promise<void> {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
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
        ocurridoEn: new Date(event.occurredAt),
      })
      .orIgnore()
      .execute();
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
