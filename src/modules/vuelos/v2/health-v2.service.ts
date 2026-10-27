import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, MoreThan } from 'typeorm';
import { todayUtc, utcDayRange } from '../common/date.util';
import { VUELOS_CONFIG, VuelosConfig } from '../common/vuelos-config';
import { FlightHold } from '../entities/flight-hold.entity';
import { Vuelo } from '../entities/vuelo.entity';

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

/** The semaphore Booking's node monitor reads (GET /health): the database decides UP/DOWN; the rest is detail. */
@Injectable()
export class HealthV2Service {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  async check(): Promise<VuelosHealth> {
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
    const latency = Date.now() - startedAt;
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
}
