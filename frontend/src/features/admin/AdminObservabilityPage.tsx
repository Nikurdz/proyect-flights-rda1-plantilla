import React, { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAdminObservabilidad, useAdminRuntime, type VentanaObservabilidad } from '../../api/endpoints/admin';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { orderStatusLabel } from '../../lib/labels';
import {
  barPercent,
  formatRate,
  formatUptime,
  holdStateLabel,
  jobLabel,
  notificationStateLabel,
  offerStateLabel,
  paymentStateLabel,
  pendingTone,
  rateTone,
  type Tone,
} from '../../lib/observability';
import { useSession } from '../../lib/session';

const toneClass: Record<Tone, string> = {
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-red-700',
  secondary: 'text-slate-500',
};

const Panel: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
    <h2 className="text-sm font-bold text-slate-900">{title}</h2>
    {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

const Kpi: React.FC<{ label: string; value: React.ReactNode; tone?: Tone; note?: string }> = ({ label, value, tone = 'secondary', note }) => (
  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`mt-1 text-2xl font-black ${tone === 'secondary' ? 'text-brand-black' : toneClass[tone]}`}>{value}</div>
    {note && <div className="mt-0.5 text-[11px] text-slate-500">{note}</div>}
  </div>
);

/** Horizontal bars for a state -> count map, largest first. */
const Bars: React.FC<{ counts: Record<string, number>; label: (state: string) => string; empty?: string }> = ({ counts, label, empty = 'Sin datos en esta ventana.' }) => {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = entries.reduce((m, [, n]) => Math.max(m, n), 0);
  if (entries.length === 0) return <p className="text-xs text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-2">
      {entries.map(([state, count]) => (
        <li key={state} className="text-xs">
          <div className="mb-1 flex justify-between">
            <span className="font-medium text-slate-700">{label(state)}</span>
            <span className="font-mono font-bold text-slate-900">{count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="presentation">
            <div className="h-full rounded-full bg-brand-gold" style={{ width: `${barPercent(count, max)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
};

const Pending: React.FC<{ label: string; count: number; hint: string }> = ({ label, count, hint }) => (
  <li className="flex items-center justify-between gap-3 py-2 text-xs">
    <span>
      <span className="font-semibold text-slate-800">{label}</span>
      <span className="block text-[11px] text-slate-500">{hint}</span>
    </span>
    <Badge variant={pendingTone(count)}>{count}</Badge>
  </li>
);

const WINDOWS: { value: VentanaObservabilidad; label: string }[] = [
  { value: '24h', label: 'Últimas 24 h' },
  { value: '7d', label: 'Últimos 7 días' },
];

/** ADMIN only: how the platform is behaving, from the database (durable) plus live process counters. */
export const AdminObservabilityPage: React.FC = () => {
  const session = useSession();
  const [ventana, setVentana] = useState<VentanaObservabilidad>('24h');
  const resumen = useAdminObservabilidad(ventana, session?.ownerId);
  const runtime = useAdminRuntime(session?.ownerId);

  const s = resumen.data;
  const r = runtime.data;
  const attention = s ? s.pendientes.capturaPendiente + s.pendientes.anulacionPendiente + s.pendientes.autorizadoSinCaptura + s.pendientes.emitidasSinConfirmacion + s.holds.vencidosSinLiberar : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-brand-gold-dark" aria-hidden="true" />
          <h2 className="text-lg font-black text-brand-black">Observabilidad</h2>
          {s &&
            (attention === 0 ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Todo en orden
              </Badge>
            ) : (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {attention} por revisar
              </Badge>
            ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1" role="group" aria-label="Ventana de tiempo">
            {WINDOWS.map((w) => (
              <button
                key={w.value}
                type="button"
                aria-pressed={ventana === w.value}
                onClick={() => setVentana(w.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${ventana === w.value ? 'bg-brand-black text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {w.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              void resumen.refetch();
              void runtime.refetch();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-brand-black"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resumen.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
            {s ? `Actualizado ${new Date(s.generadoEn).toLocaleTimeString('es-EC')}` : 'Actualizar'}
          </button>
        </div>
      </div>

      {resumen.error != null && <ProblemAlert error={resumen.error} onRetry={() => resumen.refetch()} />}

      {resumen.isLoading || !s ? (
        resumen.error == null && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6" role="status" aria-busy="true" aria-label="Cargando">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            <Kpi label="Órdenes" value={s.ordenes.total} note={`${s.ordenes.porEstado.EMITIDA ?? 0} emitidas`} />
            <Kpi
              label="Ingresos"
              value={s.ingresos.length === 0 ? '—' : s.ingresos.map((i) => <MoneyText key={i.moneda} amount={i.monto} currency={i.moneda} size="lg" />)}
              note={s.ingresos.length ? `${s.ingresos.reduce((n, i) => n + i.ordenes, 0)} órdenes cobradas` : 'Sin cobros'}
            />
            <Kpi label="Rechazo de pago" value={formatRate(s.tasas.rechazoDePago)} tone={rateTone(s.tasas.rechazoDePago, 0.15, 0.35)} note="del total de intentos" />
            <Kpi label="Antifraude" value={formatRate(s.tasas.antifraude)} tone={rateTone(s.tasas.antifraude, 0.05, 0.15)} note="rechazados por riesgo" />
            <Kpi label="Compensadas" value={formatRate(s.tasas.compensacion)} tone={rateTone(s.tasas.compensacion, 0.02, 0.1)} note="cobro anulado por fallo de emisión" />
            <Kpi label="Ocupación" value={formatRate(s.inventario.ocupacion)} note={`${s.inventario.asientosLibres} de ${s.inventario.capacidad} asientos libres`} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel title="Órdenes por estado" hint="Creadas en la ventana elegida.">
              <Bars counts={s.ordenes.porEstado} label={orderStatusLabel} />
            </Panel>
            <Panel title="Pagos por estado" hint="Un intento de pago por fila de estado.">
              <Bars counts={s.pagos.porEstado} label={paymentStateLabel} />
            </Panel>
            <Panel title="Ofertas por estado">
              <Bars counts={s.ofertas.porEstado} label={offerStateLabel} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel title="Pendientes de reconciliación" hint="Lo que el proceso automático cierra cada minuto; en cero es lo normal.">
              <ul className="divide-y divide-slate-100">
                <Pending label="Capturas pendientes" count={s.pendientes.capturaPendiente} hint="Emitida, falta cobrar" />
                <Pending label="Anulaciones pendientes" count={s.pendientes.anulacionPendiente} hint="Fallo de emisión, falta liberar el cobro" />
                <Pending label="Autorizados sin capturar" count={s.pendientes.autorizadoSinCaptura} hint="Con orden, más de 1 min sin cobrar" />
                <Pending label="Emitidas sin confirmación" count={s.pendientes.emitidasSinConfirmacion} hint="Sin correo de confirmación" />
                <Pending label="Reservas vencidas sin liberar" count={s.holds.vencidosSinLiberar} hint="El barredor va atrasado" />
              </ul>
            </Panel>
            <Panel title="Notificaciones" hint="Correos de la ventana (el envío es simulado en este prototipo).">
              <Bars counts={s.notificaciones.porEstado} label={notificationStateLabel} />
              <p className="mt-3 text-[11px] text-slate-500">Tasa de fallos: {formatRate(s.tasas.notificacionesFallidas)}</p>
            </Panel>
            <Panel title="Reservas temporales (holds)" hint="Asientos retenidos mientras se completa la compra.">
              <Bars counts={s.holds.porEstado} label={holdStateLabel} />
              <p className="mt-3 text-[11px] text-slate-500">
                Idempotencia: {s.idempotencia.enCurso} en curso · {s.idempotencia.respuestasConError5xx} con error 5xx
              </p>
            </Panel>
          </div>

          <Panel title="Cambios auditados recientes" hint="Configuración de mercados y otros cambios administrativos.">
            {s.auditoriaReciente.length === 0 ? (
              <p className="text-xs text-slate-500">Aún no hay cambios registrados.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-xs">
                {s.auditoriaReciente.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-semibold text-slate-800">{a.accion}</span> · {a.entidad} <span className="font-mono text-slate-500">{a.entidadId}</span>
                    </span>
                    <span className="text-slate-500">{new Date(a.creadoEn).toLocaleString('es-EC')}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}

      <section aria-labelledby="en-vivo" className="space-y-4 rounded-2xl border border-brand-gold/30 bg-brand-black p-5 text-white">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="en-vivo" className="text-sm font-bold">
            En vivo
          </h2>
          <span className="text-[11px] text-slate-400">Contadores de este proceso: parten de cero en cada reinicio del servidor.</span>
        </div>
        {runtime.error != null ? (
          <ProblemAlert error={runtime.error} onRetry={() => runtime.refetch()} />
        ) : !r ? (
          <div role="status" aria-busy="true" aria-label="Cargando"><Skeleton className="h-28 rounded-xl" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-5">
              {[
                ['Activo hace', formatUptime(r.uptimeSeconds)],
                ['Peticiones', r.requests.total],
                ['Errores 4xx', r.requests.clientErrors],
                ['Errores 5xx', r.requests.serverErrors],
                ['Límites de tasa', r.rateLimited],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-white/5 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
                  <div className={`mt-1 text-xl font-black ${label === 'Errores 5xx' && Number(value) > 0 ? 'text-red-400' : 'text-brand-gold'}`}>{value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-bold text-slate-300">Rutas más usadas</h3>
                <div role="region" tabIndex={0} aria-label="Rutas con más actividad, desplazable horizontalmente" className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <caption className="sr-only">Rendimiento por ruta</caption>
                    <thead className="text-slate-400">
                      <tr>
                        <th scope="col" className="py-1 pr-2 font-semibold">Ruta</th>
                        <th scope="col" className="px-2 py-1 text-right font-semibold">Veces</th>
                        <th scope="col" className="px-2 py-1 text-right font-semibold">Prom.</th>
                        <th scope="col" className="px-2 py-1 text-right font-semibold">Máx.</th>
                        <th scope="col" className="pl-2 py-1 text-right font-semibold">Err.</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {r.routes.slice(0, 10).map((route) => (
                        <tr key={route.route} className="border-t border-white/10">
                          <td className="max-w-[16rem] truncate py-1 pr-2" title={route.route}>
                            {route.route.replace('/api/v1', '')}
                          </td>
                          <td className="px-2 py-1 text-right">{route.count}</td>
                          <td className="px-2 py-1 text-right">{route.avgMs} ms</td>
                          <td className="px-2 py-1 text-right">{route.maxMs} ms</td>
                          <td className={`pl-2 py-1 text-right ${route.serverErrors > 0 ? 'text-red-400' : ''}`}>{route.clientErrors + route.serverErrors}</td>
                        </tr>
                      ))}
                      {r.routes.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-2 text-slate-400">
                            Aún sin tráfico.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-xs font-bold text-slate-300">Procesos automáticos</h3>
                  <ul className="space-y-1.5 text-[11px]">
                    {Object.entries(r.jobs).length === 0 && <li className="text-slate-400">Todavía no se ejecutó ninguno desde el arranque.</li>}
                    {Object.entries(r.jobs).map(([name, job]) => (
                      <li key={name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2">
                        <span className="font-semibold">{jobLabel(name)}</span>
                        <span className={job.lastError ? 'text-red-400' : 'text-slate-300'}>
                          {job.lastError ? `Falló: ${job.lastError}` : `Último ciclo ${job.lastRunAt ? new Date(job.lastRunAt).toLocaleTimeString('es-EC') : '—'} · ${job.lastDurationMs} ms`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="grid grid-cols-2 gap-4 text-[11px]">
                  <div>
                    <h3 className="mb-1 text-xs font-bold text-slate-300">Códigos de error</h3>
                    {Object.keys(r.problemCodes).length === 0 ? (
                      <p className="text-slate-400">Ninguno.</p>
                    ) : (
                      <ul className="font-mono">
                        {Object.entries(r.problemCodes)
                          .slice(0, 8)
                          .map(([code, n]) => (
                            <li key={code} className="flex justify-between gap-2">
                              <span className="truncate">{code}</span>
                              <span>{n}</span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-1 text-xs font-bold text-slate-300">Eventos de dominio</h3>
                    {Object.keys(r.events).length === 0 ? (
                      <p className="text-slate-400">Ninguno.</p>
                    ) : (
                      <ul className="font-mono">
                        {Object.entries(r.events)
                          .slice(0, 8)
                          .map(([type, n]) => (
                            <li key={type} className="flex justify-between gap-2">
                              <span className="truncate">{type}</span>
                              <span className={r.consumerFailures[type] ? 'text-red-400' : ''}>{n}</span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
