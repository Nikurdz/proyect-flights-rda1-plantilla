import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { DomainEvent, DomainEventBus, EventTransport } from '../common/domain-event-bus';
import { runtimeMetrics } from '../common/runtime-metrics';

export const AMQP_CONNECT = Symbol('AMQP_CONNECT');

export const EXCHANGE = 'booking.events';
export const DEAD_LETTER_EXCHANGE = 'booking.dlx';
export const Q_CONFIRMADAS = 'q.ordenes.confirmadas';
export const Q_COMPENSACION = 'q.sagas.compensacion';
export const Q_GENERAL = 'q.general';
export const Q_DEAD_LETTER = 'q.dead_letter';
/** Events Booking Prototipo publishes for the airline (contract v2 §8): payments and cancelled packages. */
export const Q_ENTRANTES = 'q.vuelos.entrantes';
export const ENTRANTES_ROUTING_KEYS = ['pagos.payment.confirmed', 'pagos.payment.failed', 'paquetes.package.cancelled'];
const CLOUD_EVENT_PREFIX = 'ec.edu.epn.booking.';
export const MAX_REINTENTOS = 3;

const CONFIRMADAS = new Set(['OrdenEmitida', 'ReservaExternaConfirmada', 'booking.confirmed', 'booking.ticket_issued']);
const COMPENSACION = new Set(['OrdenFallidaCompensada', 'ReservaExternaFallida', 'ReservaExternaCancelada', 'PagoAnulado', 'PagoRechazado', 'PagoReembolsado', 'booking.cancelled']);

/** The queue (and routing key) an event goes to: confirmations, compensations, or everything else. */
export function colaDe(type: string): string {
  return CONFIRMADAS.has(type) ? Q_CONFIRMADAS : COMPENSACION.has(type) ? Q_COMPENSACION : Q_GENERAL;
}

type Conexion = Awaited<ReturnType<typeof amqp.connect>>;
type Canal = Awaited<ReturnType<Conexion['createConfirmChannel']>>;
type ConectarFn = (url: string) => Promise<Conexion>;

/**
 * RabbitMQ behind the in-process bus. Without `RABBITMQ_URL` it does nothing and events stay in process. With it,
 * `DomainEventBus.publish` hands each event to the topology below and the consumers run when the broker delivers it:
 *
 *   exchange `booking.events` (direct) → `q.ordenes.confirmadas` | `q.sagas.compensacion` | `q.general`
 *   a message whose consumers fail is re-published up to 3 times, then dead-lettered to `q.dead_letter`.
 *
 * Delivery is at least once and consumers are idempotent. If the broker is down, `publish` falls back to in-process
 * delivery, so an outage never loses an event nor fails a request.
 */
@Injectable()
export class RabbitMqTransport implements EventTransport, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqTransport.name);
  private readonly url: string | undefined;
  private conexion: Conexion | null = null;
  private canal: Canal | null = null;
  private cerrando = false;
  private reconectar?: NodeJS.Timeout;
  readonly contadores = { publicados: 0, consumidos: 0, reintentados: 0, muertos: 0 };

  constructor(
    private readonly bus: DomainEventBus,
    config: ConfigService,
    @Optional() @Inject(AMQP_CONNECT) private readonly conectar: ConectarFn = amqp.connect as unknown as ConectarFn,
  ) {
    this.url = config.get<string>('RABBITMQ_URL') || undefined;
  }

  get activo(): boolean {
    return this.canal !== null;
  }

  async onModuleInit(): Promise<void> {
    if (!this.url) return;
    // The broker is optional infrastructure: the application starts even if it is not there yet, and keeps trying.
    await this.conectarYConsumir();
  }

  async onModuleDestroy(): Promise<void> {
    this.cerrando = true;
    if (this.reconectar) clearTimeout(this.reconectar);
    this.bus.setTransport(null);
    await this.canal?.close().catch(() => undefined);
    await this.conexion?.close().catch(() => undefined);
    this.canal = null;
    this.conexion = null;
  }

  async publicar(event: DomainEvent, reintentos = 0): Promise<void> {
    if (!this.canal) throw new Error('RabbitMQ is not connected');
    const canal = this.canal;
    await new Promise<void>((resolve, reject) => {
      canal.publish(EXCHANGE, colaDe(event.type), Buffer.from(JSON.stringify(event)), { persistent: true, contentType: 'application/json', messageId: event.id, type: event.type, headers: { 'x-retries': reintentos } }, (error) => (error ? reject(error) : resolve()));
    });
    if (reintentos === 0) this.contadores.publicados++;
  }

  private async conectarYConsumir(): Promise<void> {
    try {
      const conexion = await this.conectar(this.url!);
      conexion.on('error', (error: Error) => this.logger.warn(`RabbitMQ connection error: ${error.message}`));
      conexion.on('close', () => this.alCerrar());
      const canal = await conexion.createConfirmChannel();
      await canal.assertExchange(DEAD_LETTER_EXCHANGE, 'fanout', { durable: true });
      await canal.assertQueue(Q_DEAD_LETTER, { durable: true });
      await canal.bindQueue(Q_DEAD_LETTER, DEAD_LETTER_EXCHANGE, '');
      await canal.assertExchange(EXCHANGE, 'direct', { durable: true });
      await canal.prefetch(10);
      for (const cola of [Q_CONFIRMADAS, Q_COMPENSACION, Q_GENERAL]) {
        await canal.assertQueue(cola, { durable: true, arguments: { 'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE } });
        await canal.bindQueue(cola, EXCHANGE, cola);
        await canal.consume(cola, (mensaje) => void this.alRecibir(canal, mensaje));
      }
      // Events from Booking arrive as structured CloudEvents under their own routing keys.
      await canal.assertQueue(Q_ENTRANTES, { durable: true, arguments: { 'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE } });
      for (const clave of ENTRANTES_ROUTING_KEYS) await canal.bindQueue(Q_ENTRANTES, EXCHANGE, clave);
      await canal.consume(Q_ENTRANTES, (mensaje) => void this.alRecibir(canal, mensaje, (crudo) => this.deCloudEvent(crudo)));
      this.conexion = conexion;
      this.canal = canal;
      this.bus.setTransport(this);
      this.logger.log(`RabbitMQ connected: events travel through ${EXCHANGE}`);
    } catch (error) {
      this.logger.warn(`RabbitMQ is not available (${error instanceof Error ? error.message : String(error)}); events stay in process. Retrying in 15 s.`);
      this.programarReintento();
    }
  }

  private alCerrar(): void {
    this.canal = null;
    this.conexion = null;
    this.bus.setTransport(null);
    if (this.cerrando) return;
    this.logger.warn('RabbitMQ connection closed; events are delivered in process until it comes back.');
    this.programarReintento();
  }

  private programarReintento(): void {
    if (this.cerrando) return;
    this.reconectar = setTimeout(() => void this.conectarYConsumir(), 15_000);
    this.reconectar.unref();
  }

  /** A CloudEvent from Booking as a domain event whose type is the short name (`pagos.payment.confirmed`). */
  private deCloudEvent(crudo: unknown): DomainEvent {
    const ce = crudo as { id?: string; type?: string; time?: string; correlationid?: string; subject?: string; data?: Record<string, unknown> };
    if (!ce || typeof ce.id !== 'string' || typeof ce.type !== 'string' || !ce.type.startsWith(CLOUD_EVENT_PREFIX) || typeof ce.data !== 'object') throw new Error('not a Booking CloudEvent');
    return {
      id: ce.id,
      type: ce.type.slice(CLOUD_EVENT_PREFIX.length),
      schemaVersion: 1,
      occurredAt: ce.time ?? new Date().toISOString(),
      market: null,
      correlationId: ce.correlationid ?? 'no-correlation',
      aggregateId: ce.subject ?? String(ce.data?.bookingId ?? ce.id),
      payload: ce.data,
    };
  }

  private async alRecibir(canal: Canal, mensaje: amqp.ConsumeMessage | null, convertir?: (crudo: unknown) => DomainEvent): Promise<void> {
    if (!mensaje) return;
    let evento: DomainEvent;
    try {
      const crudo = JSON.parse(mensaje.content.toString('utf8')) as unknown;
      evento = convertir ? convertir(crudo) : (crudo as DomainEvent);
    } catch {
      // Not an event: it can never succeed, so it goes straight to the dead letters.
      this.contadores.muertos++;
      canal.nack(mensaje, false, false);
      return;
    }
    const { fallos } = await this.bus.despachar(evento);
    if (fallos === 0) {
      this.contadores.consumidos++;
      canal.ack(mensaje);
      return;
    }
    const intentos = Number(mensaje.properties.headers?.['x-retries'] ?? 0);
    if (intentos < MAX_REINTENTOS) {
      try {
        await this.publicar(evento, intentos + 1);
        this.contadores.reintentados++;
        canal.ack(mensaje);
        return;
      } catch {
        // Could not re-publish: let the broker redeliver the original.
        canal.nack(mensaje, false, true);
        return;
      }
    }
    this.contadores.muertos++;
    runtimeMetrics.recordConsumerFailure(`${evento.type}:dead_letter`);
    this.logger.error(`Event ${evento.type} (${evento.id}) failed ${MAX_REINTENTOS} times; moved to ${Q_DEAD_LETTER}`);
    canal.nack(mensaje, false, false);
  }
}
