import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, LessThan } from 'typeorm';
import { activityGate } from '../../common/activity-gate';
import { runtimeMetrics } from '../../common/runtime-metrics';
import { OutboxEvent } from '../../entities/outbox-event.entity';
import { WebhookDelivery } from '../../entities/webhook-delivery.entity';
import { AuditoriaCambio } from '../mercados/entities/auditoria-cambio.entity';
import { AuditoriaSaga, AuditoriaTransaccion } from './entities/auditoria.entity';
import { runsDomain } from '../../common/service-role';

const PURGE_MS = 6 * 60 * 60_000;
/** How long the durable trail is kept (the HTTP sample has its own, shorter, retention). Aiven free has little disk. */
export const AUDIT_RETENTION_DAYS = Math.max(7, Number(process.env.AUDIT_RETENTION_DAYS) || 180);

/**
 * Deletes what the trail no longer needs: events, saga runs (their steps go with them), administrative changes, the v2
 * event feed and the deliveries already settled, once older than AUDIT_RETENTION_DAYS. Like the other background jobs it
 * only runs while somebody is using the system (the idle gate), so a sleeping serverless database stays asleep.
 */
@Injectable()
export class RetencionAuditoriaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetencionAuditoriaService.name);
  private timer?: NodeJS.Timeout;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleInit(): void {
    if (!runsDomain('auditoria')) return;
    this.timer = setInterval(() => activityGate.isActive() && void this.purgar(), PURGE_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Returns how many rows were deleted per table. */
  async purgar(dias: number = AUDIT_RETENTION_DAYS): Promise<Record<string, number>> {
    const limite = new Date(Date.now() - dias * 86_400_000);
    const manager = this.dataSource.manager;
    const borradas: Record<string, number> = {};
    const inicio = Date.now();
    try {
      borradas.eventos = (await manager.delete(AuditoriaTransaccion, { ocurridoEn: LessThan(limite) })).affected ?? 0;
      borradas.sagas = (await manager.delete(AuditoriaSaga, { iniciadaEn: LessThan(limite) })).affected ?? 0;
      borradas.cambios = (await manager.delete(AuditoriaCambio, { creadoEn: LessThan(limite) })).affected ?? 0;
      borradas.outbox = (await manager.delete(OutboxEvent, { createdAt: LessThan(limite) })).affected ?? 0;
      borradas.entregas = (await manager.delete(WebhookDelivery, { status: In(['DELIVERED', 'DEAD']), createdAt: LessThan(limite) })).affected ?? 0;
      runtimeMetrics.recordJob('retencion-auditoria', { durationMs: Date.now() - inicio, result: borradas });
    } catch (error) {
      this.logger.warn(`Audit retention failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return borradas;
  }
}
