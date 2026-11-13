import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useAdminDashboard, type DashboardDias } from '../../api/endpoints/admin';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AdminPageHeader } from './AdminPageHeader';
import { centsToUsd, formatInt, isEmptyWindow, isFull, orderSlices, passengerSlices, paymentSlices } from '../../lib/dashboard';
import { formatRate, rateTone, type Tone } from '../../lib/observability';
import { useSession } from '../../lib/session';
import { DailyBarsChart, DonutChart, HBarsChart, RevenueAreaChart } from './dashboard/charts';

const WINDOWS: DashboardDias[] = [7, 30, 90];

const toneClass: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  secondary: 'text-ink',
};

const Kpi: React.FC<{ label: string; value: string; tone?: Tone; note?: string }> = ({ label, value, tone = 'secondary', note }) => (
  <div className="rounded-xl border border-line bg-surface p-4">
    <div className="text-small text-muted">{label}</div>
    <div className={`num mt-1 truncate text-title font-semibold ${toneClass[tone]}`}>{value}</div>
    {note && <div className="mt-0.5 text-small text-muted">{note}</div>}
  </div>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-small last:border-0">
    <dt className="text-muted">{label}</dt>
    <dd className="num font-semibold text-ink">{value}</dd>
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
      <AdminPageHeader
        page="dashboard"
        description={d ? `Ventas y operación del ${d.desde} al ${d.hasta} (hora de Ecuador).` : 'Ventas y operación de los últimos días (hora de Ecuador).'}
        actions={
          <>
            <div className="flex gap-1 rounded-xl border border-line bg-surface p-1" role="group" aria-label="Ventana de tiempo">
              {WINDOWS.map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={dias === w}
                  onClick={() => setDias(w)}
                  className={`min-h-[44px] rounded-lg px-3 py-1.5 text-sm font-medium transition-colors sm:min-h-[32px] ${dias === w ? 'bg-ink text-on-ink' : 'text-muted hover:bg-ink/5'}`}
                >
                  {w} días
                </button>
              ))}
            </div>
            <button type="button" onClick={() => void q.refetch()} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted hover:text-ink sm:min-h-[32px]">
              <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
              {d ? `Actualizado ${new Date(d.generadoEn).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil' })}` : 'Actualizar'}
            </button>
          </>
        }
      />

      {q.error != null && <ProblemAlert error={q.error} onRetry={() => q.refetch()} />}

      {q.isLoading || !d ? (
        q.error == null && (
          <div className="space-y-4" role="status" aria-busy="true" aria-label="Cargando">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {Array.from({ length: 10 }, (_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
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

/** Down providers at a glance (the traffic light of `/admin/salud`). Never breaks the dashboard if the call fails. */
export const Content: React.FC<{ d: NonNullable<ReturnType<typeof useAdminDashboard>['data']> }> = ({ d }) => {
  const k = d.kpis;
  const empty = isEmptyWindow(d);
  const dead = d.webhooks.entregasMuertas;

  return (
    <>
      {empty && (
        <div role="status" className="rounded-xl border border-dashed border-line-strong bg-surface">
          <EmptyState headingLevel={3} title={`Sin ventas en los últimos ${d.dias} días`} description="Las métricas aparecerán cuando se emitan órdenes." />
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

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-line bg-surface p-5" aria-label="Posventa">
          <h3 className="text-body font-semibold text-ink">Posventa</h3>
          <dl className="mt-3">
            <Stat label="Maletas extra" value={formatInt(d.posventa.maletasExtra)} />
            <Stat label="Ingresos por equipaje" value={centsToUsd(d.posventa.ingresosEquipajeMinor)} />
            <Stat label="Cambios de fecha" value={formatInt(d.posventa.cambiosDeFecha)} />
            <Stat label="Cancelaciones" value={formatInt(d.posventa.cancelaciones)} />
            <Stat label="Check-ins" value={formatInt(d.posventa.checkIns)} />
          </dl>
        </section>
        <section className={`rounded-xl border bg-surface p-5 ${dead > 0 ? 'border-danger' : 'border-line'}`} aria-label="Integración">
          <h3 className="text-body font-semibold text-ink">Avisos a socios (webhooks)</h3>
          <dl className="mt-3">
            <Stat label="Entregadas" value={formatInt(d.webhooks.entregasEntregadas)} />
            <Stat label="Pendientes" value={formatInt(d.webhooks.entregasPendientes)} />
            <div className="flex items-baseline justify-between gap-3 py-2 text-small">
              <dt className={dead > 0 ? 'font-semibold text-danger' : 'text-muted'}>Sin entregar (reintentos agotados)</dt>
              <dd className={`num font-semibold ${dead > 0 ? 'text-danger' : 'text-ink'}`}>{formatInt(dead)}</dd>
            </div>
          </dl>
          {dead > 0 && (
            <p role="alert" className="mt-3 flex items-center gap-2 rounded-lg bg-danger-soft p-2 text-small font-medium text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              Hay avisos que no llegaron a su destino.{' '}
              <Link to="/admin/webhooks?estado=DEAD" className="underline">
                Ver los avisos sin entregar
              </Link>
            </p>
          )}
          <Link to="/admin/webhooks" className="mt-3 inline-block text-small font-medium text-ink underline">
            Ver suscripciones y entregas
          </Link>
        </section>
      </div>
    </>
  );
};
