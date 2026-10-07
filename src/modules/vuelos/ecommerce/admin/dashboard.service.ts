import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { VUELOS_CONFIG, VuelosConfig } from '../../common/vuelos-config';
import { BaggagePurchase } from '../../entities/baggage-purchase.entity';
import { Booking } from '../../entities/booking.entity';
import { CancellationQuote } from '../../entities/cancellation-quote.entity';
import { CheckIn } from '../../entities/check-in.entity';
import { DateChangeOffer } from '../../entities/date-change-offer.entity';
import { Passenger } from '../../entities/passenger.entity';
import { Vuelo } from '../../entities/vuelo.entity';
import { WebhookDelivery } from '../../entities/webhook-delivery.entity';
import { Notificacion } from '../notificaciones/entities/notificacion.entity';
import { Oferta } from '../ofertas/entities/oferta.entity';
import { Orden } from '../ordenes/entities/orden.entity';
import { Pago } from '../pagos/entities/pago.entity';

export type VentanaDashboard = 7 | 30 | 90;

const DAY_MS = 86_400_000;
const CACHE_MS = 15_000;
const REVENUE_STATES = ['EMITIDA', 'MODIFICADA', 'EN_VIAJE', 'COMPLETADA'];

const ratio = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 10_000) / 10_000 : null);
const day = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * The management dashboard of the ADMIN: sales, conversion, routes, occupancy and after-sale activity over a window of
 * days, with a daily series for the charts. Every figure is an aggregate computed from the database (so it survives
 * restarts); nothing here carries personal data.
 */
@Injectable()
export class DashboardService {
  private readonly cache = new Map<VentanaDashboard, { at: number; value: Awaited<ReturnType<DashboardService['calcular']>> }>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(VUELOS_CONFIG) private readonly config: VuelosConfig,
  ) {}

  async resumen(dias: VentanaDashboard) {
    const hit = this.cache.get(dias);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    const value = await this.calcular(dias);
    this.cache.set(dias, { at: Date.now(), value });
    return value;
  }

  private async calcular(dias: VentanaDashboard) {
    const now = Date.now();
    // The window is whole UTC days ending today, so the daily series has exactly `dias` points.
    const hoy = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate()));
    const desde = new Date(hoy.getTime() - (dias - 1) * DAY_MS);
    const m = this.dataSource.manager;
    const dia = (column: string) => `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;

    const grouped = async (entity: new () => object, alias: string, column: string, dateColumn: string): Promise<Record<string, number>> => {
      const rows = await m
        .createQueryBuilder(entity as never, alias)
        .select(`${alias}."${column}"`, 'k')
        .addSelect('COUNT(*)::int', 'n')
        .where(`${alias}."${dateColumn}" >= :desde`, { desde })
        .groupBy(`${alias}."${column}"`)
        .getRawMany<{ k: string; n: number }>();
      return Object.fromEntries(rows.map((r) => [r.k, Number(r.n)]));
    };
    const perDay = async (entity: new () => object, alias: string, dateColumn: string, where?: string) => {
      const qb = m
        .createQueryBuilder(entity as never, alias)
        .select(dia(`${alias}."${dateColumn}"`), 'd')
        .addSelect('COUNT(*)::int', 'n')
        .where(`${alias}."${dateColumn}" >= :desde`, { desde });
      if (where) qb.andWhere(where);
      return new Map((await qb.groupBy('d').getRawMany<{ d: string; n: number }>()).map((r) => [r.d, Number(r.n)]));
    };

    const [ordenesDia, ofertasDia, cancelacionesDia, ordenes, pagos, ofertas, notificaciones, pasajerosTipo, rutas, ocupacion, equipaje, cambios, cotizaciones, checkIns, reembolsos, agotados, webhooks] = await Promise.all([
      m
        .createQueryBuilder(Orden, 'o')
        .select(dia('o."creadaEn"'), 'd')
        .addSelect('COUNT(*)::int', 'total')
        .addSelect('COUNT(*) FILTER (WHERE o."estado" IN (:...ok))::int', 'emitidas')
        .addSelect('COALESCE(SUM(o."totalMinor") FILTER (WHERE o."estado" IN (:...ok)), 0)::text', 'ingresos')
        .where('o."creadaEn" >= :desde', { desde })
        .setParameter('ok', REVENUE_STATES)
        .groupBy('d')
        .getRawMany<{ d: string; total: number; emitidas: number; ingresos: string }>(),
      perDay(Oferta, 'f', 'creadaEn'),
      perDay(Booking, 'b', 'updatedAt', 'b."status" = \'CANCELLED\''),
      grouped(Orden, 'o', 'estado', 'creadaEn'),
      grouped(Pago, 'p', 'estado', 'creadoEn'),
      grouped(Oferta, 'f', 'estado', 'creadaEn'),
      grouped(Notificacion, 'n', 'estado', 'creadoEn'),
      m
        .createQueryBuilder(Passenger, 'p')
        .innerJoin(Booking, 'b', 'b."bookingId" = p."bookingId"')
        .select('p."passengerType"', 'k')
        .addSelect('COUNT(*)::int', 'n')
        .where('b."createdAt" >= :desde', { desde })
        .groupBy('p."passengerType"')
        .getRawMany<{ k: string; n: number }>(),
      m
        .createQueryBuilder(Booking, 'b')
        .select('b."origin"', 'origen')
        .addSelect('b."destination"', 'destino')
        .addSelect('COUNT(*)::int', 'reservas')
        .addSelect('COUNT(*) FILTER (WHERE b."status" = \'CANCELLED\')::int', 'canceladas')
        .addSelect('COALESCE(SUM(b."grandTotal"::numeric) FILTER (WHERE b."status" <> \'CANCELLED\'), 0)::float', 'ingresos')
        .where('b."createdAt" >= :desde', { desde })
        .groupBy('b."origin"')
        .addGroupBy('b."destination"')
        .orderBy('reservas', 'DESC')
        .addOrderBy('ingresos', 'DESC')
        .limit(8)
        .getRawMany<{ origen: string; destino: string; reservas: number; canceladas: number; ingresos: number }>(),
      m
        .createQueryBuilder(Vuelo, 'v')
        .select('v."origenIATA"', 'origen')
        .addSelect('v."destinoIATA"', 'destino')
        .addSelect('COUNT(*)::int', 'vuelos')
        .addSelect('SUM(v."capacidadTotal")::int', 'capacidad')
        .addSelect('SUM(v."asientosDisponibles")::int', 'libres')
        .addSelect('COUNT(*) FILTER (WHERE v."asientosDisponibles" = 0)::int', 'agotados')
        .where('v."fechaSalida" >= :now AND v."estado" = \'SCHEDULED\'', { now: new Date(now) })
        .groupBy('v."origenIATA"')
        .addGroupBy('v."destinoIATA"')
        .getRawMany<{ origen: string; destino: string; vuelos: number; capacidad: number; libres: number; agotados: number }>(),
      m
        .createQueryBuilder(BaggagePurchase, 'x')
        .select('COALESCE(SUM(x."quantity"), 0)::int', 'maletas')
        .addSelect('COALESCE(SUM(x."totalMinor"), 0)::text', 'ingresos')
        .where('x."createdAt" >= :desde', { desde })
        .getRawOne<{ maletas: number; ingresos: string }>(),
      m.createQueryBuilder(DateChangeOffer, 'x').where('x."status" = \'USED\' AND x."createdAt" >= :desde', { desde }).getCount(),
      m.createQueryBuilder(CancellationQuote, 'x').where('x."status" = \'USED\' AND x."createdAt" >= :desde', { desde }).getCount(),
      m.createQueryBuilder(CheckIn, 'x').where('x."createdAt" >= :desde', { desde }).getCount(),
      m
        .createQueryBuilder(Pago, 'p')
        .select('COALESCE(SUM(p."reembolsoMinor"), 0)::text', 'total')
        .where('p."estado" = \'REEMBOLSADO\' AND p."actualizadoEn" >= :desde', { desde })
        .getRawOne<{ total: string }>(),
      m.createQueryBuilder(Vuelo, 'v').where('v."fechaSalida" >= :now AND v."estado" = \'SCHEDULED\' AND v."asientosDisponibles" = 0', { now: new Date(now) }).getCount(),
      m
        .createQueryBuilder(WebhookDelivery, 'w')
        .select('w."status"', 'k')
        .addSelect('COUNT(*)::int', 'n')
        .groupBy('w."status"')
        .getRawMany<{ k: string; n: number }>(),
    ]);

    // One point per day, zero where nothing happened, so a chart never skips a day.
    const porDia = new Map(ordenesDia.map((r) => [r.d, r]));
    const serie = Array.from({ length: dias }, (_, i) => {
      const fecha = day(new Date(desde.getTime() + i * DAY_MS));
      const r = porDia.get(fecha);
      return {
        fecha,
        ordenes: Number(r?.total ?? 0),
        emitidas: Number(r?.emitidas ?? 0),
        ingresosMinor: Number(r?.ingresos ?? 0),
        ofertas: ofertasDia.get(fecha) ?? 0,
        cancelaciones: cancelacionesDia.get(fecha) ?? 0,
      };
    });

    const total = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);
    const emitidas = serie.reduce((n, p) => n + p.emitidas, 0);
    const ingresosMinor = serie.reduce((n, p) => n + p.ingresosMinor, 0);
    const reservas = rutas.reduce((n, r) => n + Number(r.reservas), 0);
    const canceladas = Number(cancelacionesDia.size ? [...cancelacionesDia.values()].reduce((a, b) => a + b, 0) : 0);
    const capacidad = ocupacion.reduce((n, r) => n + Number(r.capacidad), 0);
    const libres = ocupacion.reduce((n, r) => n + Number(r.libres), 0);
    const intentosPago = total(pagos);
    const rechazados = (pagos.RECHAZADO ?? 0) + (pagos.RECHAZADO_ANTIFRAUDE ?? 0);
    const webhook = (k: string) => Number(webhooks.find((w) => w.k === k)?.n ?? 0);

    return {
      dias,
      moneda: this.config.currency,
      generadoEn: new Date(now).toISOString(),
      desde: day(desde),
      hasta: day(hoy),
      kpis: {
        ingresosMinor,
        ordenesEmitidas: emitidas,
        ticketPromedioMinor: emitidas > 0 ? Math.round(ingresosMinor / emitidas) : 0,
        pasajeros: pasajerosTipo.reduce((n, r) => n + Number(r.n), 0),
        conversion: ratio(emitidas, total(ofertas)),
        tasaCancelacion: ratio(canceladas, emitidas),
        reembolsosMinor: Number(reembolsos?.total ?? 0),
        ocupacionFutura: ratio(capacidad - libres, capacidad),
        vuelosAgotados: agotados,
        rechazoDePago: ratio(rechazados, intentosPago),
      },
      serie,
      embudo: [
        { etapa: 'Ofertas creadas', valor: total(ofertas) },
        { etapa: 'Ofertas pagadas', valor: ofertas.PAGADA ?? 0 },
        { etapa: 'Órdenes emitidas', valor: emitidas },
        { etapa: 'Reservas canceladas', valor: canceladas },
      ],
      ordenesPorEstado: ordenes,
      pagosPorEstado: pagos,
      ofertasPorEstado: ofertas,
      notificacionesPorEstado: notificaciones,
      pasajerosPorTipo: Object.fromEntries(pasajerosTipo.map((r) => [r.k, Number(r.n)])),
      topRutas: rutas.map((r) => ({ ruta: `${r.origen}-${r.destino}`, reservas: Number(r.reservas), canceladas: Number(r.canceladas), ingresos: Number(r.ingresos) })),
      ocupacionPorRuta: ocupacion
        .map((r) => ({ ruta: `${r.origen}-${r.destino}`, vuelos: Number(r.vuelos), capacidad: Number(r.capacidad), libres: Number(r.libres), agotados: Number(r.agotados), ocupacion: ratio(Number(r.capacidad) - Number(r.libres), Number(r.capacidad)) ?? 0 }))
        .sort((a, b) => b.ocupacion - a.ocupacion)
        .slice(0, 10),
      posventa: {
        maletasExtra: Number(equipaje?.maletas ?? 0),
        ingresosEquipajeMinor: Number(equipaje?.ingresos ?? 0),
        cambiosDeFecha: cambios,
        cancelaciones: cotizaciones,
        checkIns,
      },
      webhooks: { entregasPendientes: webhook('PENDING'), entregasEntregadas: webhook('DELIVERED'), entregasMuertas: webhook('DEAD') },
    };
  }
}
