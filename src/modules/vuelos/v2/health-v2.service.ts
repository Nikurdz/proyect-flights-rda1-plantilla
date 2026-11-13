import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, MoreThan } from 'typeorm';
import { activityGate } from '../common/activity-gate';
import { todayUtc, utcDayRange } from '../common/date.util';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { FlightHold } from '../entities/flight-hold.entity';
import { Vuelo } from '../entities/vuelo.entity';
import { runsCore } from '../common/service-role';

export interface VuelosHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  nodo_id: string;
  nombre_proveedor: string;
  vertical: 'VUELOS';
  version: string;
  uptime_seconds: number;
  latencia_ms: number;
  circuit_breaker_estado: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  holds_activos_count: number;
  vuelos_programados_hoy: number;
  dependencias: { nombre: string; status: 'UP' | 'DOWN' | 'DEGRADED'; latencia_ms: number }[];
  timestamp: string;
}

/** How often the snapshot is refreshed, and how old it may be before a request refreshes it itself. */
const REFRESH_EVERY_MS = 30_000;
const MAX_AGE_MS = 120_000;

interface HealthSnapshot {
  takenAt: number;
  dbStatus: 'UP' | 'DOWN';
  latency: number;
  holds: number;
  flightsToday: number;
}

/**
 * The semaphore Booking's node monitor reads (GET /health): the database decides UP/DOWN; the rest is detail.
 * A request never queries the database: a timer (30 s) keeps an in-memory snapshot, and only a missing or stale
 * (> 2 min) snapshot is refreshed by the request, once for all the requests that arrive meanwhile. `uptime_seconds` and
 * `timestamp` are read at request time.
 */
@Injectable()
export class HealthV2Service implements OnModuleInit, OnModuleDestroy {
  private snapshot?: HealthSnapshot;
  private refreshing?: Promise<HealthSnapshot>;
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  onModuleInit(): void {
    if (!runsCore()) return;
    this.timer = setInterval(() => {
      // Like the other periodic jobs: with nobody around the database is left alone (the idle gate).
      if (activityGate.isActive()) void this.refresh();
    }, REFRESH_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async check(): Promise<VuelosHealth> {
    const snapshot = this.snapshot && Date.now() - this.snapshot.takenAt <= MAX_AGE_MS ? this.snapshot : await this.refresh();
    const { dbStatus, latency, holds, flightsToday } = snapshot;
    const dependencias: VuelosHealth['dependencias'] = [{ nombre: 'postgresql', status: dbStatus, latencia_ms: latency }];
    return {
      status: dbStatus === 'DOWN' ? 'DOWN' : latency > 1000 ? 'DEGRADED' : 'HEALTHY',
      nodo_id: this.config.nodeId,
      nombre_proveedor: 'RAM Alliance Vuelos',
      vertical: 'VUELOS',
      version: process.env.npm_package_version ?? '2.0.0',
      uptime_seconds: Math.floor(process.uptime()),
      latencia_ms: latency,
      circuit_breaker_estado: 'CLOSED',
      holds_activos_count: holds,
      vuelos_programados_hoy: flightsToday,
      dependencias,
      timestamp: new Date().toISOString(),
    };
  }

  /** Measures the database and stores the snapshot; concurrent callers share one measurement. */
  refresh(): Promise<HealthSnapshot> {
    this.refreshing ??= this.measure()
      .then((snapshot) => (this.snapshot = snapshot))
      .finally(() => {
        this.refreshing = undefined;
      });
    return this.refreshing;
  }

  private async measure(): Promise<HealthSnapshot> {
    const startedAt = Date.now();
    let dbStatus: 'UP' | 'DOWN' = 'UP';
    let holds = 0;
    let flightsToday = 0;
    try {
      await this.dataSource.query('SELECT 1');
      holds = await this.dataSource.getRepository(FlightHold).count({ where: { status: 'HELD', expiresAt: MoreThan(new Date()) } });
      const { start, end } = utcDayRange(todayUtc());
      flightsToday = await this.dataSource
        .getRepository(Vuelo)
        .createQueryBuilder('v')
        .where('v."fechaSalida" >= :start AND v."fechaSalida" < :end AND v.estado <> :cancelled', { start, end, cancelled: 'CANCELLED' })
        .getCount();
    } catch {
      dbStatus = 'DOWN';
    }
    return { takenAt: Date.now(), dbStatus, latency: Date.now() - startedAt, holds, flightsToday };
  }
}
