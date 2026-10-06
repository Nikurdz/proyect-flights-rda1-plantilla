import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull, LessThan, Not } from 'typeorm';
import { toIso } from '../../common/date.util';
import { runtimeMetrics } from '../../common/runtime-metrics';
import { FlightHold } from '../../entities/flight-hold.entity';
import { IdempotencyRecord } from '../../entities/idempotency-record.entity';
import { Vuelo } from '../../entities/vuelo.entity';
import { money } from '../common/moneda.util';
import { AuditoriaCambio } from '../mercados/entities/auditoria-cambio.entity';
import { Notificacion } from '../notificaciones/entities/notificacion.entity';
import { Oferta } from '../ofertas/entities/oferta.entity';
import { Orden } from '../ordenes/entities/orden.entity';
import { Pago } from '../pagos/entities/pago.entity';

export type VentanaObservabilidad = '24h' | '7d';

const WINDOW_MS: Record<VentanaObservabilidad, number> = { '24h': 86_400_000, '7d': 7 * 86_400_000 };
const CACHE_MS = 15_000;
// Same thresholds as the reconciler, so "pending" here means exactly what it will act on.
const PAYMENT_GRACE_MS = 60_000;
const ANNOUNCE_GRACE_MS = 2 * 60_000;
const ANNOUNCE_WINDOW_MS = 24 * 3_600_000;
const REVENUE_STATES = ['EMITIDA', 'MODIFICADA', 'EN_VIAJE', 'COMPLETADA'];

type Counts = Record<string, number>;

const ratio = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 10_000) / 10_000 : null);

/**
 * What an operator needs to see at a glance, computed from the database (so it survives restarts)
 * for a time window, plus the process-local counters in `runtime-metrics.ts`. Nothing here carries
 * personal data: only counts, sums and states.
 */
@Injectable()
export class ObservabilidadService {
  private readonly cache = new Map<VentanaObservabilidad, { at: number; value: Awaited<ReturnType<ObservabilidadService['calcular']>> }>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async resumen(ventana: VentanaObservabilidad) {
    const hit = this.cache.get(ventana);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    const value = await this.calcular(ventana);
    this.cache.set(ventana, { at: Date.now(), value });
    return value;
  }

  runtime() {
    return runtimeMetrics.snapshot();
  }

  /** Health for the load balancer / uptime pings: can the API reach its database? */
  async salud(): Promise<{ status: 'UP' | 'DOWN'; db: 'UP' | 'DOWN'; uptimeSeconds: number; startedAt: string }> {
    let db: 'UP' | 'DOWN' = 'UP';
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      db = 'DOWN';
    }
    const { uptimeSeconds, startedAt } = runtimeMetrics.snapshot();
    return { status: db === 'UP' ? 'UP' : 'DOWN', db, uptimeSeconds, startedAt };
  }

  private async calcular(ventana: VentanaObservabilidad) {
    const now = Date.now();
    const desde = new Date(now - WINDOW_MS[ventana]);
    const m = this.dataSource.manager;

    const grouped = async (entity: new () => object, column: string, dateColumn: string): Promise<Counts> => {
      const rows = await m
        .createQueryBuilder(entity as never, 'e')
        .select(`e."${column}"`, 'k')
        .addSelect('COUNT(*)::int', 'n')
        .where(`e."${dateColumn}" >= :desde`, { desde })
        .groupBy(`e."${column}"`)
        .getRawMany<{ k: string; n: number }>();
      return Object.fromEntries(rows.map((r) => [r.k, Number(r.n)]));
    };

    const [ordenes, pagos, ofertas, notificaciones, holds, ingresosRows, inventarioRow] = await Promise.all([
      grouped(Orden, 'estado', 'creadaEn'),
      grouped(Pago, 'estado', 'creadoEn'),
      grouped(Oferta, 'estado', 'creadaEn'),
      grouped(Notificacion, 'estado', 'creadoEn'),
      grouped(FlightHold, 'status', 'createdAt'),
      m
        .createQueryBuilder(Orden, 'o')
        .select('o."moneda"', 'moneda')
        .addSelect('COALESCE(SUM(o."totalMinor"), 0)::text', 'total')
        .addSelect('COUNT(*)::int', 'n')
        .where('o."creadaEn" >= :desde', { desde })
        .andWhere('o."estado" IN (:...estados)', { estados: REVENUE_STATES })
        .groupBy('o."moneda"')
        .getRawMany<{ moneda: string; total: string; n: number }>(),
      m
        .createQueryBuilder(Vuelo, 'v')
        .select('COUNT(*)::int', 'vuelos')
        .addSelect('COALESCE(SUM(v."asientosDisponibles"), 0)::int', 'libres')
        .addSelect('COALESCE(SUM(v."capacidadTotal"), 0)::int', 'capacidad')
        .where('v."fechaSalida" >= :now', { now: new Date(now) })
        .getRawOne<{ vuelos: number; libres: number; capacidad: number }>(),
    ]);

    const [capturaPendiente, anulacionPendiente, autorizadoSinCaptura, emitidasSinConfirmacion, holdsVencidos, idempotenciaEnCurso, idempotenciaConError, auditoria] = await Promise.all([
      m.count(Pago, { where: { estado: 'CAPTURA_PENDIENTE' } }),
      m.count(Pago, { where: { estado: 'ANULACION_PENDIENTE' } }),
      m.count(Pago, { where: { estado: 'AUTORIZADO', ordenId: Not(IsNull()), actualizadoEn: LessThan(new Date(now - PAYMENT_GRACE_MS)) } }),
      m
        .createQueryBuilder(Orden, 'o')
        .where('o."estado" = :estado', { estado: 'EMITIDA' })
        .andWhere('o."creadaEn" < :hasta AND o."creadaEn" > :desde', { hasta: new Date(now - ANNOUNCE_GRACE_MS), desde: new Date(now - ANNOUNCE_WINDOW_MS) })
        .andWhere((qb) => {
          const sent = qb.subQuery().select('1').from(Notificacion, 'n').where('n."referencia" = o."numeroOrden"').andWhere('n."tipo" = :tipo', { tipo: 'CONFIRMACION_COMPRA' }).getQuery();
          return `NOT EXISTS ${sent}`;
        })
        .getCount(),
      m.count(FlightHold, { where: { status: 'HELD', expiresAt: LessThan(new Date(now)) } }),
      m.count(IdempotencyRecord, { where: { state: 'IN_PROGRESS' } }),
      m
        .createQueryBuilder(IdempotencyRecord, 'r')
        .where('r."createdAt" >= :desde AND r."responseStatus" >= 500', { desde })
        .getCount(),
      m.find(AuditoriaCambio, { order: { creadoEn: 'DESC' }, take: 10, select: { id: true, entidad: true, entidadId: true, accion: true, creadoEn: true } }),
    ]);

    const total = (c: Counts) => Object.values(c).reduce((a, b) => a + b, 0);
    const rechazados = (pagos.RECHAZADO ?? 0) + (pagos.RECHAZADO_ANTIFRAUDE ?? 0);
    const intentosDePago = total(pagos);
    const ordenesConPago = (ordenes.EMITIDA ?? 0) + (ordenes.FALLIDA_COMPENSADA ?? 0) + (ordenes.MODIFICADA ?? 0) + (ordenes.EN_VIAJE ?? 0) + (ordenes.COMPLETADA ?? 0) + (ordenes.REEMBOLSADA ?? 0) + (ordenes.DEVOLUCION_EN_CURSO ?? 0);
    const libres = inventarioRow?.libres ?? 0;
    const capacidad = inventarioRow?.capacidad ?? 0;

    return {
      ventana,
      generadoEn: new Date(now).toISOString(),
      desde: desde.toISOString(),
      ordenes: { total: total(ordenes), porEstado: ordenes },
      ingresos: ingresosRows.map((r) => ({ ...money(Number(r.total), r.moneda), ordenes: Number(r.n) })),
      pagos: { total: intentosDePago, porEstado: pagos },
      tasas: {
        rechazoDePago: ratio(rechazados, intentosDePago),
        antifraude: ratio(pagos.RECHAZADO_ANTIFRAUDE ?? 0, intentosDePago),
        compensacion: ratio(ordenes.FALLIDA_COMPENSADA ?? 0, ordenesConPago),
        notificacionesFallidas: ratio(notificaciones.FALLIDO ?? 0, total(notificaciones)),
      },
      pendientes: { capturaPendiente, anulacionPendiente, autorizadoSinCaptura, emitidasSinConfirmacion },
      ofertas: { total: total(ofertas), porEstado: ofertas },
      notificaciones: { total: total(notificaciones), porEstado: notificaciones },
      holds: { total: total(holds), porEstado: holds, vencidosSinLiberar: holdsVencidos },
      inventario: { vuelosFuturos: Number(inventarioRow?.vuelos ?? 0), asientosLibres: libres, capacidad, ocupacion: ratio(capacidad - libres, capacidad) },
      idempotencia: { enCurso: idempotenciaEnCurso, respuestasConError5xx: idempotenciaConError },
      auditoriaReciente: auditoria.map((a) => ({ id: a.id, entidad: a.entidad, entidadId: a.entidadId, accion: a.accion, creadoEn: toIso(a.creadoEn) })),
    };
  }
}

