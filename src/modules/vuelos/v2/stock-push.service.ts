import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { MoreThan, Repository } from 'typeorm';
import { activityGate } from '../common/activity-gate';
import { DomainEventBus } from '../common/domain-event-bus';
import { requestJson, resolveSafeTarget, SafeTarget } from '../common/safe-http';
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

const DEBOUNCE_MS = 500;
const SAFETY_NET_MS = 30_000;
const GRPC_FULL_RESYNC_MS = 10 * 60_000;
const CALL_TIMEOUT_MS = 5_000;
// HTTP: Booking's endpoint takes one flight per call, so the calls go a few at a time.
const HTTP_CONCURRENCY = 8;
const HTTP_TIMEOUT_MS = 8_000;
const HTTP_MAX_RESPONSE_BYTES = 16_384;
/** A flight Booking refused (4xx or `success:false`, e.g. an item it does not know) is not sent again for this long. */
const REFUSED_BACKOFF_MS = 60 * 60_000;
/** After this many network/5xx errors in a row the round stops: Booking is down, the next sync tries again. */
const MAX_CONSECUTIVE_ERRORS = 5;

interface StockService extends grpc.Client {
  PushStockUpdate(request: object, metadata: grpc.Metadata, options: grpc.CallOptions, callback: (error: grpc.ServiceError | null, ack?: { success: boolean; message: string }) => void): void;
  StreamInventoryChanges(metadata: grpc.Metadata, options: grpc.CallOptions, callback: (error: grpc.ServiceError | null, summary?: { total_events_processed: number; is_synchronized: boolean }) => void): grpc.ClientWritableStream<object>;
}

interface InventoryProto {
  inventory: { InventoryStockService: new (address: string, credentials: grpc.ChannelCredentials) => StockService };
}

interface FlightStock {
  vuelo: Vuelo;
  units: number;
}

/**
 * Pushes the free seats of every flight to Booking. It never touches the inventory: it reads `Vuelo.asientosDisponibles`
 * (the only writer is InventoryService). Two transports, chosen by the configuration:
 *  - **HTTP** (`BOOKING_STOCK_URL`, Booking's `POST /api/v2/inventory/stock`): one JSON call per flight with its absolute
 *    count `{service_id, item_id, date, time_slot, available_units}`; a flight counts as sent only when Booking answers
 *    `success: true`. Wins when both are set.
 *  - **gRPC** (`GRPC_STOCK_URL`, contract v2 section 9, `src/proto/inventory.proto`): `PushStockUpdate` with the absolute
 *    count and `StreamInventoryChanges` with the deltas.
 * Every flight departing within `STOCK_PUSH_HORIZON_DAYS` is sent the first time and at each full resynchronisation; in
 * between only the flights whose count changed. A sync is triggered shortly after any event that moves seats (so it follows
 * the committed state, never a rolled-back transaction) and by a 30 s safety net. A failed push is retried at the next sync,
 * because the last pushed value is only updated on success.
 */
@Injectable()
export class StockPushService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StockPushService.name);
  private transport: 'http' | 'grpc' | null = null;
  private client: StockService | null = null;
  private readonly lastPushed = new Map<string, number>();
  private readonly refusedUntil = new Map<string, number>();
  private lastFull = 0;
  private timer?: NodeJS.Timeout;
  private debounce?: NodeJS.Timeout;
  private running = false;
  private again = false;
  private pendingCorrelation: string | null = null;
  readonly counters = { updates: 0, changes: 0, failures: 0, refused: 0 };

  constructor(
    @InjectRepository(Vuelo) private readonly vuelos: Repository<Vuelo>,
    private readonly events: DomainEventBus,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  get enabled(): boolean {
    return this.config.booking.stockHttpUrl !== '' || this.config.stockGrpcUrl !== '';
  }

  /** `http`, `grpc` or `null` when no stock push is configured. */
  get mode(): 'http' | 'grpc' | null {
    return this.transport;
  }

  onModuleInit(): void {
    if (this.config.booking.stockHttpUrl) {
      this.transport = 'http';
      if (this.config.stockGrpcUrl) this.logger.warn('BOOKING_STOCK_URL and GRPC_STOCK_URL are both set: the stock goes by HTTP');
    } else if (this.config.stockGrpcUrl) {
      this.transport = 'grpc';
      this.client = this.connect();
    } else {
      return;
    }
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
    const where = this.transport === 'http' ? new URL(this.config.booking.stockHttpUrl).origin : this.config.stockGrpcUrl;
    this.logger.log(`Stock push (${this.transport === 'http' ? 'HTTP' : 'gRPC'}) to ${where} (service_id ${this.config.nodeId}, ${this.config.stockPush.horizonDays} days ahead)`);
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
    if (!this.transport) return;
    if (correlationId) this.pendingCorrelation = correlationId;
    if (this.debounce) return;
    this.debounce = setTimeout(() => {
      this.debounce = undefined;
      void this.sync();
    }, DEBOUNCE_MS);
    this.debounce.unref();
  }

  /** Waits for the round in progress (and any it asked for), then runs one more and waits for it: for tests and one-off checks. */
  async flush(): Promise<void> {
    const idle = async () => {
      while (this.running || this.debounce) await new Promise((resolve) => setTimeout(resolve, 20));
    };
    await idle();
    await this.sync();
    await idle();
  }

  /** One synchronisation round. Resolves when the pushes finished (or failed: they are retried next time). */
  async sync(correlationId?: string): Promise<{ updates: number; changes: number }> {
    const result = { updates: 0, changes: 0 };
    if (!this.transport) return result;
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
      const resyncMs = this.transport === 'http' ? this.config.stockPush.fullResyncMinutes * 60_000 : GRPC_FULL_RESYNC_MS;
      const full = this.lastPushed.size === 0 || now - this.lastFull >= resyncMs;
      const flights = await this.vuelos.find({
        where: { fechaSalida: MoreThan(new Date(now)) },
        order: { fechaSalida: 'ASC' },
        loadEagerRelations: false,
      });
      const horizon = now + this.config.stockPush.horizonDays * 86_400_000;
      const stock: FlightStock[] = flights.filter((v) => new Date(v.fechaSalida).getTime() <= horizon).map((v) => ({ vuelo: v, units: v.estado === 'CANCELLED' ? 0 : v.asientosDisponibles }));

      const absolute = full ? stock : stock.filter((s) => this.lastPushed.get(s.vuelo.id) === undefined);
      const changed = full ? [] : stock.filter((s) => this.lastPushed.get(s.vuelo.id) !== undefined && this.lastPushed.get(s.vuelo.id) !== s.units);

      if (this.transport === 'http') {
        const sent = await this.httpPush([...absolute, ...changed], correlation, now);
        result.updates = absolute.filter((s) => sent.has(s.vuelo.id)).length;
        result.changes = changed.filter((s) => sent.has(s.vuelo.id)).length;
      } else {
        for (const s of absolute) {
          await this.pushUpdate(s.vuelo, s.units, correlation);
          this.lastPushed.set(s.vuelo.id, s.units);
          result.updates += 1;
        }
        if (changed.length > 0) {
          await this.streamChanges(
            changed.map((s) => ({ vuelo: s.vuelo, delta: s.units - (this.lastPushed.get(s.vuelo.id) ?? s.units) })),
            correlation,
          );
          for (const s of changed) this.lastPushed.set(s.vuelo.id, s.units);
          result.changes += changed.length;
        }
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

  // ------------------------------------------------------------------------------------------------ HTTP

  /**
   * Sends each flight's absolute count, a few calls at a time. Returns the flights Booking accepted (their value is
   * recorded as pushed). A refused flight waits REFUSED_BACKOFF_MS; MAX_CONSECUTIVE_ERRORS network/5xx errors in a row stop
   * the round with an error (what was accepted before stays recorded).
   */
  private async httpPush(items: FlightStock[], correlationId: string, now: number): Promise<Set<string>> {
    const sent = new Set<string>();
    const pending = items.filter((s) => (this.refusedUntil.get(s.vuelo.id) ?? 0) <= now);
    if (pending.length === 0) return sent;

    // Resolved and checked once per round (https and a public address, unless private hosts are allowed for tests).
    const target = await resolveSafeTarget(this.config.booking.stockHttpUrl, this.config.webhooks.allowPrivateHosts);
    const headers: Record<string, string> = { 'X-Correlation-Id': correlationId, ...(this.config.booking.stockApiKey ? { 'X-API-Key': this.config.booking.stockApiKey } : {}) };
    let next = 0;
    let consecutiveErrors = 0;
    let errors = 0;
    let lastError = '';
    let refused = 0;
    let firstRefusal = '';

    const worker = async (): Promise<void> => {
      while (next < pending.length && consecutiveErrors < MAX_CONSECUTIVE_ERRORS) {
        const item = pending[next++];
        const outcome = await this.httpPushOne(target, item, headers);
        if (outcome.kind === 'ok') {
          consecutiveErrors = 0;
          this.lastPushed.set(item.vuelo.id, item.units);
          this.refusedUntil.delete(item.vuelo.id);
          sent.add(item.vuelo.id);
        } else if (outcome.kind === 'refused') {
          consecutiveErrors = 0;
          refused += 1;
          this.refusedUntil.set(item.vuelo.id, Date.now() + REFUSED_BACKOFF_MS);
          if (!firstRefusal) firstRefusal = `${this.itemOf(item.vuelo).item_id} ${this.itemOf(item.vuelo).date}: ${outcome.message}`;
        } else {
          consecutiveErrors += 1;
          errors += 1;
          lastError = outcome.message;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(HTTP_CONCURRENCY, pending.length) }, () => worker()));

    if (refused > 0) {
      this.counters.refused += refused;
      this.logger.warn(`Booking refused ${refused} stock update(s); they wait 1 h before being sent again (first: ${firstRefusal}) [${correlationId}]`);
    }
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      throw new Error(`Booking's stock endpoint is not answering (${lastError}); ${sent.size} of ${pending.length} sent this round`);
    }
    if (errors > 0) {
      // Not sent, so not recorded: they go again at the next sync.
      this.counters.failures += 1;
      this.logger.warn(`${errors} stock update(s) failed (${lastError}); they are sent again at the next sync [${correlationId}]`);
    }
    return sent;
  }

  private async httpPushOne(target: SafeTarget, item: FlightStock, headers: Record<string, string>): Promise<{ kind: 'ok' | 'refused' | 'error'; message: string }> {
    const body = JSON.stringify({ ...this.itemOf(item.vuelo), available_units: item.units });
    let answer;
    try {
      answer = await requestJson(target, 'POST', body, headers, { timeoutMs: HTTP_TIMEOUT_MS, maxResponseBytes: HTTP_MAX_RESPONSE_BYTES });
    } catch (error) {
      return { kind: 'error', message: error instanceof Error ? error.message : String(error) };
    }
    if (answer.status >= 500 || answer.status === 429 || answer.status === 0) return { kind: 'error', message: `HTTP ${answer.status}` };
    let parsed: { success?: unknown; message?: unknown; error?: unknown } = {};
    try {
      parsed = JSON.parse(answer.body) as typeof parsed;
    } catch {
      // Not JSON: judged by the status alone below.
    }
    if (answer.status >= 200 && answer.status < 300 && parsed.success === true) return { kind: 'ok', message: '' };
    const reason = typeof parsed.message === 'string' ? parsed.message : typeof parsed.error === 'string' ? parsed.error : answer.body.slice(0, 200);
    return { kind: 'refused', message: `HTTP ${answer.status} ${reason}`.trim() };
  }

  // ------------------------------------------------------------------------------------------------ gRPC

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
