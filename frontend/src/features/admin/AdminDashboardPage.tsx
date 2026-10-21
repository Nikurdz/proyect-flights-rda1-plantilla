import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BarChart3, RefreshCw } from 'lucide-react';
import { useAdminDashboard, type DashboardDias } from '../../api/endpoints/admin';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Skeleton } from '../../components/ui/Skeleton';
import { centsToUsd, formatInt, isEmptyWindow, isFull, orderSlices, passengerSlices, paymentSlices } from '../../lib/dashboard';
import { formatRate, rateTone, type Tone } from '../../lib/observability';
import { useSession } from '../../lib/session';
import { DailyBarsChart, DonutChart, HBarsChart, RevenueAreaChart } from './dashboard/charts';

const WINDOWS: DashboardDias[] = [7, 30, 90];

const toneClass: Record<Tone, string> = {
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-red-700',
  secondary: 'text-brand-black',
};

const Kpi: React.FC<{ label: string; value: string; tone?: Tone; note?: string }> = ({ label, value, tone = 'secondary', note }) => (
  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{label}</div>
    <div className={`mt-1 truncate text-2xl font-black ${toneClass[tone]}`}>{value}</div>
    {note && <div className="mt-0.5 text-[11px] text-slate-600">{note}</div>}
  </div>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-2 text-xs last:border-0">
    <dt className="text-slate-700">{label}</dt>
    <dd className="font-mono text-sm font-bold text-slate-900">{value}</dd>
  </div>
);

/** ADMIN only: business dashboard of the last 7/30/90 days. */
export const AdminDashboardPage: React.FC = () => {
  const session = useSession();
  const [dias, setDias] = useState<DashboardDias>(30);
  const q = useAdminDashboard(dias, session?.ownerId);
  const d = q.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-brand-gold-dark" aria-hidden="true" />
          <h2 className="text-lg font-black text-brand-black">Dashboard</h2>
          {d && (
            <span className="text-xs text-slate-600">
              {d.desde} al {d.hasta}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1" role="group" aria-label="Ventana de tiempo">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={dias === w}
                onClick={() => setDias(w)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${dias === w ? 'bg-brand-black text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {w} días
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void q.refetch()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-brand-black">
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
            {d ? `Actualizado ${new Date(d.generadoEn).toLocaleTimeString('es-EC')}` : 'Actualizar'}
          </button>
        </div>
      </div>

      {q.error != null && <ProblemAlert error={q.error} onRetry={() => q.refetch()} />}

      {q.isLoading || !d ? (
        q.error == null && (
          <div className="space-y-4" role="status" aria-busy="true" aria-label="Cargando">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {Array.from({ length: 10 }, (_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
          </div>
        )
      ) : (
        <Content d={d} />
      )}
    </div>
  );
};

export const Content: React.FC<{ d: NonNullable<ReturnType<typeof useAdminDashboard>['data']> }> = ({ d }) => {
  const k = d.kpis;
  const empty = isEmptyWindow(d);
  const dead = d.webhooks.entregasMuertas;

  return (
    <>
      {empty && (
        <div role="status" className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-700">
          Sin ventas en los últimos {d.dias} días. Las métricas aparecerán cuando se emitan órdenes.
        </div>
      )}

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Ingresos" value={centsToUsd(k.ingresosMinor)} note={`últimos ${d.dias} días`} />
        <Kpi label="Órdenes emitidas" value={formatInt(k.ordenesEmitidas)} />
        <Kpi label="Ticket promedio" value={centsToUsd(k.ticketPromedioMinor)} />
        <Kpi label="Pasajeros" value={formatInt(k.pasajeros)} />
        <Kpi label="Conversión" value={formatRate(k.conversion)} note="ofertas que terminan en orden" />
        <Kpi label="Tasa de cancelación" value={formatRate(k.tasaCancelacion)} tone={rateTone(k.tasaCancelacion, 0.1, 0.25)} />
        <Kpi label="Reembolsos" value={centsToUsd(k.reembolsosMinor)} />
        <Kpi label="Ocupación futura" value={formatRate(k.ocupacionFutura)} note="vuelos programados" />
        <Kpi label="Vuelos agotados" value={formatInt(k.vuelosAgotados)} tone={k.vuelosAgotados > 0 ? 'warning' : 'secondary'} />
        <Kpi label="Rechazo de pago" value={formatRate(k.rechazoDePago)} tone={rateTone(k.rechazoDePago, 0.15, 0.35)} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <RevenueAreaChart title="Ingresos por día" days={d.serie} formatValue={centsToUsd} />
        <DailyBarsChart title="Órdenes y cancelaciones por día" days={d.serie} />
        <HBarsChart
          title="Embudo de conversión"
          valueHeader="Cantidad"
          items={d.embudo.map((e) => ({ label: e.etapa, value: e.valor, display: formatInt(e.valor) }))}
          summary={d.embudo.map((e) => `${e.etapa}: ${e.valor}`).join('; ') + '.'}
        />
        <DonutChart title="Órdenes por estado" slices={orderSlices(d.ordenesPorEstado)} />
        <DonutChart title="Pagos por estado" slices={paymentSlices(d.pagosPorEstado)} />
        <DonutChart title="Pasajeros por tipo" slices={passengerSlices(d.pasajerosPorTipo)} />
        <HBarsChart
          title="Rutas más reservadas"
          valueHeader="Reservas"
          items={d.topRutas.map((r) => ({ label: r.ruta, value: r.reservas, display: formatInt(r.reservas), note: `${r.canceladas} canceladas, ${centsToUsd(Math.round(r.ingresos * 100))}` }))}
          summary={d.topRutas.length ? `Primera: ${d.topRutas[0].ruta} con ${d.topRutas[0].reservas} reservas.` : 'Sin reservas.'}
        />
        <HBarsChart
          title="Ocupación por ruta"
          valueHeader="Ocupación"
          max={1}
          flagText="≥ 90 %"
          items={d.ocupacionPorRuta.map((r) => ({
            label: r.ruta,
            value: r.ocupacion,
            display: formatRate(r.ocupacion),
            highlight: isFull(r.ocupacion),
            note: `${r.vuelos} vuelos, ${r.libres} asientos libres`,
          }))}
          summary={`${d.ocupacionPorRuta.filter((r) => isFull(r.ocupacion)).length} de ${d.ocupacionPorRuta.length} rutas con ocupación de 90 % o más.`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm" aria-label="Posventa">
          <h3 className="text-sm font-bold text-slate-900">Posventa</h3>
          <dl className="mt-3">
            <Stat label="Maletas extra" value={formatInt(d.posventa.maletasExtra)} />
            <Stat label="Ingresos por equipaje" value={centsToUsd(d.posventa.ingresosEquipajeMinor)} />
            <Stat label="Cambios de fecha" value={formatInt(d.posventa.cambiosDeFecha)} />
            <Stat label="Cancelaciones" value={formatInt(d.posventa.cancelaciones)} />
            <Stat label="Check-ins" value={formatInt(d.posventa.checkIns)} />
          </dl>
        </section>
        <section className={`rounded-2xl border bg-white p-5 shadow-sm ${dead > 0 ? 'border-red-300' : 'border-slate-200/80'}`} aria-label="Integración">
          <h3 className="text-sm font-bold text-slate-900">Integración (webhooks)</h3>
          <dl className="mt-3">
            <Stat label="Entregadas" value={formatInt(d.webhooks.entregasEntregadas)} />
            <Stat label="Pendientes" value={formatInt(d.webhooks.entregasPendientes)} />
            <div className="flex items-baseline justify-between gap-3 py-2 text-xs">
              <dt className={dead > 0 ? 'font-bold text-red-700' : 'text-slate-700'}>Muertas (sin entregar)</dt>
              <dd className={`font-mono text-sm font-bold ${dead > 0 ? 'text-red-700' : 'text-slate-900'}`}>{formatInt(dead)}</dd>
            </div>
          </dl>
          {dead > 0 && (
            <p role="alert" className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-800">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              Hay entregas muertas.{' '}
              <Link to="/admin/observabilidad" className="underline">
                Ver observabilidad
              </Link>
            </p>
          )}
        </section>
      </div>
    </>
  );
};
