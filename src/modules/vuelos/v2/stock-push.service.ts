import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { MoreThan, Repository } from 'typeorm';
import { activityGate } from '../common/activity-gate';
import { DomainEventBus } from '../common/domain-event-bus';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { Vuelo } from '../entities/vuelo.entity';

/** Events after which the free seats of a flight may have changed: every hold, release, sale, cancellation and change. */
const STOCK_EVENTS = [
  'hold.created',
  'hold.expired',
  'hold.released',
  'booking.confirmed',
  'booking.cancelled',
  'booking.changed',
  'flight.cancelled',
  'flight.schedule_changed',
  'flight.status_changed',
];

const HORIZON_DAYS = 45;
const DEBOUNCE_MS = 500;
const SAFETY_NET_MS = 30_000;
const FULL_RESYNC_MS = 10 * 60_000;
const CALL_TIMEOUT_MS = 5_000;

interface StockService extends grpc.Client {
  PushStockUpdate(request: object, metadata: grpc.Metadata, options: grpc.CallOptions, callback: (error: grpc.ServiceError | null, ack?: { success: boolean; message: string }) => void): void;
  StreamInventoryChanges(metadata: grpc.Metadata, options: grpc.CallOptions, callback: (error: grpc.ServiceError | null, summary?: { total_events_processed: number; is_synchronized: boolean }) => void): grpc.ClientWritableStream<object>;
}

interface InventoryProto {
  inventory: { InventoryStockService: new (address: string, credentials: grpc.ChannelCredentials) => StockService };
}

/**
 * Pushes the free seats of every flight to Booking over gRPC (contract v2, section 9; `src/proto/inventory.proto`).
 * It never touches the inventory: it reads `Vuelo.asientosDisponibles` (the only writer is InventoryService) and sends
 *  - `PushStockUpdate` with the absolute count of a flight the first time and every 10 minutes (resynchronisation), and
 *  - `StreamInventoryChanges` with a delta per flight whose count changed since the last push.
 * A sync is triggered shortly after any event that moves seats (so it follows the committed state, never a rolled-back
 * transaction) and by a 30 s safety net. Without `GRPC_STOCK_URL` it does nothing. A failed push is retried at the next
 * sync because the last pushed value is only updated on success.
 */
@Injectable()
export class StockPushService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StockPushService.name);
  private client: StockService | null = null;
  private readonly lastPushed = new Map<string, number>();
  private lastFull = 0;
  private timer?: NodeJS.Timeout;
  private debounce?: NodeJS.Timeout;
  private running = false;
  private again = false;
  private pendingCorrelation: string | null = null;
  readonly counters = { updates: 0, changes: 0, failures: 0 };

  constructor(
    @InjectRepository(Vuelo) private readonly vuelos: Repository<Vuelo>,
    private readonly events: DomainEventBus,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  get enabled(): boolean {
    return this.config.stockGrpcUrl !== '';
  }

  onModuleInit(): void {
    if (!this.enabled) return;
    this.client = this.connect();
    for (const type of STOCK_EVENTS) {
      this.events.subscribe(type, (event) => {
        this.schedule(event.correlationId);
      });
    }
    this.timer = setInterval(() => {
      if (activityGate.isActive()) void this.sync();
    }, SAFETY_NET_MS);
    this.timer.unref();
    this.schedule();
    this.logger.log(`Stock push to ${this.config.stockGrpcUrl} (service_id ${this.config.nodeId})`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.debounce) clearTimeout(this.debounce);
    this.client?.close();
  }

  private connect(): StockService {
    const definition = protoLoader.loadSync(join(__dirname, '..', '..', '..', 'proto', 'inventory.proto'), { keepCase: true, longs: Number, defaults: true });
    const proto = grpc.loadPackageDefinition(definition) as unknown as InventoryProto;
    const credentials = process.env.GRPC_STOCK_TLS === 'true' ? grpc.credentials.createSsl() : grpc.credentials.createInsecure();
    return new proto.inventory.InventoryStockService(this.config.stockGrpcUrl, credentials);
  }

  /** Asks for a sync soon; several events in a burst make one. */
  schedule(correlationId?: string): void {
    if (!this.client) return;
    if (correlationId) this.pendingCorrelation = correlationId;
    if (this.debounce) return;
    this.debounce = setTimeout(() => {
      this.debounce = undefined;
      void this.sync();
    }, DEBOUNCE_MS);
    this.debounce.unref();
  }

  /** One synchronisation round. Resolves when the pushes finished (or failed: they are retried next time). */
  async sync(correlationId?: string): Promise<{ updates: number; changes: number }> {
    const result = { updates: 0, changes: 0 };
    if (!this.client) return result;
    if (this.running) {
      // Something moved while a round was in progress: run another one right after it.
      this.again = true;
      return result;
    }
    this.running = true;
    const correlation = correlationId ?? this.pendingCorrelation ?? randomUUID();
    this.pendingCorrelation = null;
    try {
      const now = Date.now();
      const full = this.lastPushed.size === 0 || now - this.lastFull >= FULL_RESYNC_MS;
      const flights = await this.vuelos.find({
        where: { fechaSalida: MoreThan(new Date(now)) },
        order: { fechaSalida: 'ASC' },
        loadEagerRelations: false,
      });
      const horizon = now + HORIZON_DAYS * 86_400_000;
      const stock = flights.filter((v) => new Date(v.fechaSalida).getTime() <= horizon).map((v) => ({ vuelo: v, units: v.estado === 'CANCELLED' ? 0 : v.asientosDisponibles }));

      const toUpdate = full ? stock : [];
      const changed = full ? [] : stock.filter((s) => this.lastPushed.get(s.vuelo.id) !== undefined && this.lastPushed.get(s.vuelo.id) !== s.units);
      const fresh = full ? [] : stock.filter((s) => this.lastPushed.get(s.vuelo.id) === undefined);

      for (const s of [...toUpdate, ...fresh]) {
        await this.pushUpdate(s.vuelo, s.units, correlation);
        this.lastPushed.set(s.vuelo.id, s.units);
        result.updates += 1;
      }
      if (changed.length > 0) {
        await this.streamChanges(
          changed.map((s) => ({ vuelo: s.vuelo, delta: s.units - (this.lastPushed.get(s.vuelo.id) ?? s.units), units: s.units })),
          correlation,
        );
        for (const s of changed) this.lastPushed.set(s.vuelo.id, s.units);
        result.changes += changed.length;
      }
      if (full) this.lastFull = now;
      this.counters.updates += result.updates;
      this.counters.changes += result.changes;
    } catch (error) {
      this.counters.failures += 1;
      this.logger.warn(`Stock push failed, retrying at the next sync: ${error instanceof Error ? error.message : String(error)} [${correlation}]`);
    } finally {
      this.running = false;
      if (this.again) {
        this.again = false;
        this.schedule();
      }
    }
    return result;
  }

  private itemOf(vuelo: Vuelo) {
    const departure = new Date(vuelo.fechaSalida).toISOString();
    return { service_id: this.config.nodeId, item_id: `${vuelo.codigoVuelo}-ECONOMY`, date: departure.slice(0, 10), time_slot: departure.slice(11, 16) };
  }

  private metadata(correlationId: string): grpc.Metadata {
    const metadata = new grpc.Metadata();
    metadata.set('x-correlation-id', correlationId);
    if (this.config.booking.stockApiKey) metadata.set('x-api-key', this.config.booking.stockApiKey);
    return metadata;
  }

  private options(): grpc.CallOptions {
    return { deadline: Date.now() + CALL_TIMEOUT_MS };
  }

  private pushUpdate(vuelo: Vuelo, units: number, correlationId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client!.PushStockUpdate({ ...this.itemOf(vuelo), available_units: units, timestamp: Date.now() }, this.metadata(correlationId), this.options(), (error, ack) => {
        if (error) reject(error);
        else if (ack && !ack.success) reject(new Error(`Booking refused the stock update: ${ack.message}`));
        else resolve();
      });
    });
  }

  private streamChanges(changes: { vuelo: Vuelo; delta: number }[], correlationId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const stream = this.client!.StreamInventoryChanges(this.metadata(correlationId), this.options(), (error) => (error ? reject(error) : resolve()));
      for (const change of changes) stream.write({ event_id: randomUUID(), ...this.itemOf(change.vuelo), delta: change.delta, timestamp: Date.now() });
      stream.end();
    });
  }
}

