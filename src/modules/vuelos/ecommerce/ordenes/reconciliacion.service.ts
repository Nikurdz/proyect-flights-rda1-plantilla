import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { runtimeMetrics } from '../../common/runtime-metrics';
import { MercadosService } from '../mercados/mercados.service';
import { Notificacion } from '../notificaciones/entities/notificacion.entity';
import { PagosService } from '../pagos/pagos.service';
import { ComprasService } from './compras.service';
import { Orden } from './entities/orden.entity';

const INTERVAL_MS = 60_000;
// An order younger than this may simply still be announcing itself; older than the window is not chased.
const ANNOUNCE_GRACE_MS = 2 * 60_000;
const ANNOUNCE_WINDOW_MS = 24 * 60 * 60_000;

/**
 * Closes the gaps the purchase saga leaves when the process dies or the gateway is down mid-way
 * (there is no broker or outbox in this phase): payments authorised/captured/voided late, and
 * issued orders whose confirmation was never announced. Every step is idempotent, so running on
 * several instances, or twice, is safe.
 */
@Injectable()
export class ReconciliacionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliacionService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @InjectRepository(Orden) private readonly ordenes: Repository<Orden>,
    private readonly pagos: PagosService,
    private readonly compras: ComprasService,
    private readonly mercados: MercadosService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.reconciliar(), INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async reconciliar(): Promise<{ pagos: number; anuncios: number }> {
    if (this.running) return { pagos: 0, anuncios: 0 };
    this.running = true;
    const result = { pagos: 0, anuncios: 0 };
    const startedAt = Date.now();
    try {
      result.pagos = await this.pagos.reconciliarPendientes();
      result.anuncios = await this.reanunciarEmisiones();
      runtimeMetrics.recordJob('reconciliacion', { durationMs: Date.now() - startedAt, result });
      if (result.pagos + result.anuncios > 0) this.logger.log(`Reconciled ${result.pagos} payment(s) and ${result.anuncios} order announcement(s)`);
    } catch (error) {
      runtimeMetrics.recordJob('reconciliacion', { durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) });
      this.logger.error(`Reconciliation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
    return result;
  }

  /** Issued orders that never produced a confirmation notification: announce them again. */
  async reanunciarEmisiones(): Promise<number> {
    const now = Date.now();
    const huerfanas = await this.ordenes
      .createQueryBuilder('o')
      .where('o."estado" = :estado', { estado: 'EMITIDA' })
      .andWhere('o."creadaEn" < :hasta AND o."creadaEn" > :desde', { hasta: new Date(now - ANNOUNCE_GRACE_MS), desde: new Date(now - ANNOUNCE_WINDOW_MS) })
      .andWhere((qb) => {
        const sent = qb
          .subQuery()
          .select('1')
          .from(Notificacion, 'n')
          .where('n."referencia" = o."numeroOrden"')
          .andWhere('n."tipo" = :tipo', { tipo: 'CONFIRMACION_COMPRA' })
          .getQuery();
        return `NOT EXISTS ${sent}`;
      })
      .orderBy('o."creadaEn"', 'ASC')
      .take(50)
      .getMany();

    for (const orden of huerfanas) {
      const mercado = await this.mercados.obtener(orden.mercado);
      await this.compras.publicarEmision(orden, mercado);
    }
    return huerfanas.length;
  }
}
