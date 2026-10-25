import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { HttpRequestRecord, setHttpRequestSink } from '../../common/correlation';
import { runtimeMetrics } from '../../common/runtime-metrics';
import { PeticionHttp } from './entities/auditoria.entity';

const FLUSH_MS = Math.max(1_000, Number(process.env.HTTP_LOG_FLUSH_MS) || 10_000);
const PURGE_MS = 6 * 60 * 60_000;
const MAX_BUFFER = 1_000;
const RETENTION_DAYS = Math.max(1, Number(process.env.HTTP_LOG_RETENTION_DAYS) || 7);
// A health probe every few seconds would drown everything else.
const IGNORED = /\/health(\/|$)/;

/**
 * Keeps a bounded sample of the HTTP traffic in `peticiones_http`. Requests are queued in memory and written in
 * batches; the queue is capped (the oldest are dropped, never the request), and rows older than the retention are
 * deleted every few hours. The file logs (Winston) are the full record; this table is for quick queries.
 */
@Injectable()
export class PeticionesHttpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PeticionesHttpService.name);
  private buffer: PeticionHttp[] = [];
  private flushTimer?: NodeJS.Timeout;
  private purgeTimer?: NodeJS.Timeout;
  private flushing = false;

  constructor(@InjectRepository(PeticionHttp) private readonly peticiones: Repository<PeticionHttp>) {}

  onModuleInit(): void {
    setHttpRequestSink((record) => this.encolar(record));
    this.flushTimer = setInterval(() => void this.vaciar(), FLUSH_MS);
    this.purgeTimer = setInterval(() => void this.purgar(), PURGE_MS);
    this.flushTimer.unref();
    this.purgeTimer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    setHttpRequestSink(null);
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.purgeTimer) clearInterval(this.purgeTimer);
    await this.vaciar();
  }

  encolar(record: HttpRequestRecord): void {
    if (IGNORED.test(record.ruta)) return;
    this.buffer.push(Object.assign(new PeticionHttp(), { ...record, ruta: record.ruta.slice(0, 200), creadaEn: new Date() }));
    if (this.buffer.length > MAX_BUFFER) this.buffer.splice(0, this.buffer.length - MAX_BUFFER);
  }

  /** Writes what is queued. Returns how many rows were written. */
  async vaciar(): Promise<number> {
    if (this.flushing || this.buffer.length === 0) return 0;
    this.flushing = true;
    const lote = this.buffer;
    this.buffer = [];
    try {
      await this.peticiones.insert(lote);
      return lote.length;
    } catch (error) {
      this.logger.warn(`Could not write ${lote.length} request log row(s): ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    } finally {
      this.flushing = false;
    }
  }

  /** Deletes the rows older than the retention. Returns how many. */
  async purgar(): Promise<number> {
    const startedAt = Date.now();
    try {
      const result = await this.peticiones.delete({ creadaEn: LessThan(new Date(Date.now() - RETENTION_DAYS * 86_400_000)) });
      const borradas = result.affected ?? 0;
      runtimeMetrics.recordJob('purga-peticiones', { durationMs: Date.now() - startedAt, result: { borradas } });
      return borradas;
    } catch (error) {
      runtimeMetrics.recordJob('purga-peticiones', { durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) });
      this.logger.warn(`Request log purge failed: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }
}
