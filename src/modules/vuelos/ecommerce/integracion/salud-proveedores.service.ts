import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { activityGate } from '../../common/activity-gate';
import { runtimeMetrics } from '../../common/runtime-metrics';
import { ProveedorSalud } from './entities/proveedor-salud.entity';
import { Proveedor } from './entities/proveedor.entity';
import { ProveedoresService } from './proveedores.service';

// Each tick calls every active partner, so it is not frequent by default; override with PROVEEDORES_HEALTH_INTERVAL_MS.
const INTERVAL_MS = Math.max(5_000, Number(process.env.PROVEEDORES_HEALTH_INTERVAL_MS) || 60_000);
const HISTORIAL_DIAS = 7;

/** Pings every active provider on a schedule and records the result, so the console shows live lights and a history. */
@Injectable()
export class SaludProveedoresService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SaludProveedoresService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @InjectRepository(Proveedor) private readonly proveedores: Repository<Proveedor>,
    @InjectRepository(ProveedorSalud) private readonly salud: Repository<ProveedorSalud>,
    private readonly servicio: ProveedoresService,
  ) {}

  onModuleInit(): void {
    // Skipped while nobody uses the system, so a serverless database can sleep (common/activity-gate.ts).
    this.timer = setInterval(() => activityGate.isActive() && void this.comprobarTodos(), INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async comprobarTodos(): Promise<{ comprobados: number; caidos: number }> {
    if (this.running) return { comprobados: 0, caidos: 0 };
    this.running = true;
    const startedAt = Date.now();
    const resultado = { comprobados: 0, caidos: 0 };
    try {
      for (const proveedor of await this.proveedores.find({ where: { activo: true } })) {
        const salud = await this.servicio.comprobar(proveedor);
        resultado.comprobados++;
        if (salud.estado === 'DOWN') resultado.caidos++;
      }
      await this.salud.delete({ comprobadoEn: LessThan(new Date(Date.now() - HISTORIAL_DIAS * 86_400_000)) });
      runtimeMetrics.recordJob('salud-proveedores', { durationMs: Date.now() - startedAt, result: resultado });
    } catch (error) {
      runtimeMetrics.recordJob('salud-proveedores', { durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) });
      this.logger.error(`Provider health check failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
    return resultado;
  }
}
