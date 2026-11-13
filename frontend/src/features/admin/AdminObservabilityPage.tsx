import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Pause, Play, RefreshCw } from 'lucide-react';
import { useAdminObservabilidad, useAdminRuntime, type ObservabilidadRuntime, type VentanaObservabilidad } from '../../api/endpoints/admin';
import { AdminPageHeader } from './AdminPageHeader';
import { MoneyText } from '../../components/common/MoneyText';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../../components/ui/Table';
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
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  secondary: 'text-muted',
};

const Panel: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className="rounded-xl border border-line bg-surface p-5">
    <h2 className="text-body font-semibold text-ink">{title}</h2>
    {hint && <p className="mt-0.5 text-small text-muted">{hint}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

const Kpi: React.FC<{ label: string; value: React.ReactNode; tone?: Tone; note?: string }> = ({ label, value, tone = 'secondary', note }) => (
  <div className="rounded-xl border border-line bg-surface p-4">
    <div className="text-small text-muted">{label}</div>
    <div className={`num mt-1 text-title font-semibold ${tone === 'secondary' ? 'text-ink' : toneClass[tone]}`}>{value}</div>
    {note && <div className="mt-0.5 text-small text-muted">{note}</div>}
  </div>
);

/** Horizontal bars for a state -> count map, largest first. */
const Bars: React.FC<{ counts: Record<string, number>; label: (state: string) => string; empty?: string }> = ({ counts, label, empty = 'Sin datos en esta ventana.' }) => {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = entries.reduce((m, [, n]) => Math.max(m, n), 0);
  if (entries.length === 0) return <p className="text-xs text-muted">{empty}</p>;
  return (
    <ul className="space-y-2">
      {entries.map(([state, count]) => (
        <li key={state} className="text-xs">
          <div className="mb-1 flex justify-between">
            <span className="font-medium text-ink">{label(state)}</span>
            <span className="num font-bold text-ink">{count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line" role="presentation">
            <div className="h-full rounded-full bg-gold" style={{ width: `${barPercent(count, max)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
};

const Pending: React.FC<{ label: string; count: number; hint: string }> = ({ label, count, hint }) => (
  <li className="flex items-center justify-between gap-3 py-2 text-xs">
    <span>
      <span className="font-semibold text-ink">{label}</span>
      <span className="block text-small text-muted">{hint}</span>
    </span>
    <Badge variant={pendingTone(count)}>{count}</Badge>
  </li>
);

/** Briefly tints its box when the value changes (not on first render). The text itself always carries the information. */
const Flash: React.FC<{ value: React.ReactNode; className?: string; as?: 'div' | 'td' }> = ({ value, className = '', as: Tag = 'div' }) => {
  const previous = useRef(value);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (previous.current !== value) {
      previous.current = value;
      setTick((n) => n + 1);
    }
  }, [value]);
  return (
    <Tag key={tick} className={`${className} ${tick > 0 ? 'animate-flash-gold' : ''}`}>
      {value}
    </Tag>
  );
};

const hora = (iso: string | undefined): string => (iso ? new Date(iso).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil' }) : '—');

const WEBHOOK_STATE: Record<string, { label: string; tone: Tone }> = {
  SUSCRITO: { label: 'Suscrito', tone: 'success' },
  SIN_CONFIGURAR: { label: 'Sin configurar', tone: 'warning' },
  ERROR: { label: 'Con error', tone: 'danger' },
};
const STOCK_MODE: Record<string, { label: string; tone: Tone }> = {
  HTTP: { label: 'Activo (por HTTP)', tone: 'success' },
  GRPC: { label: 'Activo (por gRPC)', tone: 'success' },
  OFF: { label: 'Desactivado', tone: 'warning' },
};

const Linea: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
    <dt className="text-muted">{label}</dt>
    <dd className="break-all text-right num text-ink">{children}</dd>
  </div>
);

/** Booking integration as this process sees it: webhook subscription made at boot and the stock push. */
const BookingIntegrationCard: React.FC<{ runtime: ObservabilidadRuntime }> = ({ runtime }) => {
  const webhook = runtime.integrations?.['booking-webhook'];
  const stock = runtime.integrations?.['booking-stock'];
  const job = runtime.jobs['stock-push'];
  const ws = webhook ? (WEBHOOK_STATE[webhook.estado] ?? { label: webhook.estado, tone: 'secondary' as Tone }) : null;
  const sm = stock ? (STOCK_MODE[stock.modo] ?? { label: stock.modo, tone: 'secondary' as Tone }) : null;
  const ronda = stock?.ultimaRonda;
  return (
    <section aria-labelledby="integracion-booking" className="rounded-xl border border-line bg-paper p-4 text-small">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="integracion-booking" className="text-small font-semibold text-ink">
          Integración con Booking
        </h3>
        <span className="text-muted">Datos de este proceso: se reinician al reiniciar el servidor.</span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <h4 className="mb-1 flex items-center gap-2 font-semibold text-ink">
            Webhooks a Booking {ws && <Badge variant={ws.tone === 'secondary' ? 'outline' : ws.tone}>{ws.label}</Badge>}
          </h4>
          {!webhook ? (
            <p className="text-muted">Sin datos todavía: el registro se hace al arrancar.</p>
          ) : (
            <dl className="divide-y divide-line">
              <Linea label="Dueño">{webhook.owner ?? '—'}</Linea>
              <Linea label="Destino">{webhook.destino ?? '—'}</Linea>
              <Linea label="Suscripción">{webhook.suscripcionId ?? '—'}</Linea>
              {webhook.detalle && <Linea label="Detalle">{webhook.detalle}</Linea>}
              <Linea label="Actualizado">{hora(webhook.updatedAt)}</Linea>
            </dl>
          )}
          <Link to="/admin/webhooks" className="mt-2 inline-block font-semibold text-gold-text underline">
            Ver entregas de webhooks
          </Link>
        </div>
        <div>
          <h4 className="mb-1 flex items-center gap-2 font-semibold text-ink">
            Push de stock {sm && <Badge variant={sm.tone === 'secondary' ? 'outline' : sm.tone}>{sm.label}</Badge>}
          </h4>
          {!stock ? (
            <p className="text-muted">Sin datos todavía.</p>
          ) : (
            <dl className="divide-y divide-line">
              <Linea label="Destino">{stock.destino ?? '—'}</Linea>
              {stock.serviceId && <Linea label="service_id">{stock.serviceId}</Linea>}
              {stock.horizonteDias != null && <Linea label="Horizonte">{stock.horizonteDias} días</Linea>}
              <Linea label="Última ronda">
                {ronda ? (
                  <>
                    {hora(ronda.en)} · <span className="text-success">{ronda.enviados} enviados</span> · <span className={ronda.rechazados > 0 ? 'text-warning' : ''}>{ronda.rechazados} rechazados</span> ·{' '}
                    <span className={ronda.fallidos > 0 ? 'text-danger' : ''}>{ronda.fallidos} fallidos</span> · {ronda.sinIntentar} sin intentar de {ronda.total}
                  </>
                ) : (
                  'Ninguna todavía'
                )}
              </Linea>
              <Linea label="Vuelos en espera">{stock.vuelosEnEspera ?? 0}</Linea>
              {stock.vuelosEnviadosAlgunaVez != null && <Linea label="Vuelos enviados alguna vez">{stock.vuelosEnviadosAlgunaVez}</Linea>}
              {stock.ultimoRechazo && (
                <Linea label="Último rechazo">
                  <span className="text-warning">
                    {hora(stock.ultimoRechazo.en)} · {stock.ultimoRechazo.detalle}
                  </span>
                </Linea>
              )}
              {stock.ultimoError && (
                <Linea label="Último error">
                  <span className="text-danger">
                    {hora(stock.ultimoError.en)} · {stock.ultimoError.mensaje}
                  </span>
                </Linea>
              )}
              {job && (
                <Linea label="Proceso">
                  {job.runs} ciclo(s), {job.failures} con fallo{job.lastRunAt ? ` · último ${hora(job.lastRunAt)}` : ''}
                </Linea>
              )}
            </dl>
          )}
        </div>
      </div>
    </section>
  );
};

const WINDOWS: { value: VentanaObservabilidad; label: string }[] = [
  { value: '24h', label: 'Últimas 24 h' },
  { value: '7d', label: 'Últimos 7 días' },
];

/** ADMIN only: how the platform is behaving, from the database (durable) plus live process counters. */
export const AdminObservabilityPage: React.FC = () => {
  const session = useSession();
  const [ventana, setVentana] = useState<VentanaObservabilidad>('24h');
  const resumen = useAdminObservabilidad(ventana, session?.ownerId);
  const [paused, setPaused] = useState(false);
  const runtime = useAdminRuntime(session?.ownerId, { paused });

  const s = resumen.data;
  const r = runtime.data;
  const attention = s ? s.pendientes.capturaPendiente + s.pendientes.anulacionPendiente + s.pendientes.autorizadoSinCaptura + s.pendientes.emitidasSinConfirmacion + s.holds.vencidosSinLiberar : 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        page="observabilidad"
        description="Cómo se está comportando la plataforma: compras, pagos y procesos automáticos. Las cifras de «En vivo» parten de cero cuando se reinicia el servidor."
        actions={
          <>
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
            <div className="flex gap-1 rounded-xl border border-line bg-surface p-1" role="group" aria-label="Ventana de tiempo">
              {WINDOWS.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  aria-pressed={ventana === w.value}
                  onClick={() => setVentana(w.value)}
                  className={`min-h-[44px] rounded-lg px-3 py-1.5 text-sm font-medium transition-colors sm:min-h-[32px] ${ventana === w.value ? 'bg-ink text-on-ink' : 'text-muted hover:bg-ink/5'}`}
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
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted hover:text-ink sm:min-h-[32px]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${resumen.isFetching ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
              {s ? `Actualizado ${new Date(s.generadoEn).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil' })}` : 'Actualizar'}
            </button>
          </>
        }
      />

      {resumen.error != null && <ProblemAlert error={resumen.error} onRetry={() => resumen.refetch()} />}

      {resumen.isLoading || !s ? (
        resumen.error == null && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6" role="status" aria-busy="true" aria-label="Cargando">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
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
              <ul className="divide-y divide-line">
                <Pending label="Capturas pendientes" count={s.pendientes.capturaPendiente} hint="Emitida, falta cobrar" />
                <Pending label="Anulaciones pendientes" count={s.pendientes.anulacionPendiente} hint="Fallo de emisión, falta liberar el cobro" />
                <Pending label="Autorizados sin capturar" count={s.pendientes.autorizadoSinCaptura} hint="Con orden, más de 1 min sin cobrar" />
                <Pending label="Emitidas sin confirmación" count={s.pendientes.emitidasSinConfirmacion} hint="Sin correo de confirmación" />
                <Pending label="Reservas vencidas sin liberar" count={s.holds.vencidosSinLiberar} hint="El barredor va atrasado" />
              </ul>
            </Panel>
            <Panel title="Notificaciones" hint="Correos de la ventana (el envío es simulado).">
              <Bars counts={s.notificaciones.porEstado} label={notificationStateLabel} />
              <p className="mt-3 text-small text-muted">Tasa de fallos: {formatRate(s.tasas.notificacionesFallidas)}</p>
            </Panel>
            <Panel title="Reservas temporales (holds)" hint="Asientos retenidos mientras se completa la compra.">
              <Bars counts={s.holds.porEstado} label={holdStateLabel} />
              <p className="mt-3 text-small text-muted">
                Idempotencia: {s.idempotencia.enCurso} en curso · {s.idempotencia.respuestasConError5xx} con error 5xx
              </p>
            </Panel>
          </div>

          <Panel title="Cambios auditados recientes" hint="Configuración de mercados y otros cambios administrativos.">
            {s.auditoriaReciente.length === 0 ? (
              <p className="text-xs text-muted">Aún no hay cambios registrados.</p>
            ) : (
              <ul className="divide-y divide-line text-xs">
                {s.auditoriaReciente.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-semibold text-ink">{a.accion}</span> · {a.entidad} <span className="num text-muted">{a.entidadId}</span>
                    </span>
                    <span className="text-muted">{new Date(a.creadoEn).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}

      <section aria-labelledby="en-vivo" className="space-y-4 rounded-xl border border-line bg-surface p-5 text-ink">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="en-vivo" className="text-body font-semibold">
              En vivo
            </h2>
            <span role="status" className="inline-flex items-center gap-1.5 text-small font-semibold">
              {runtime.isError && !paused ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-warning" aria-hidden="true" />
                  <span className="text-warning">Sin conexión · reintentando</span>
                </>
              ) : paused ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-muted" aria-hidden="true" />
                  <span className="text-muted">En pausa{runtime.dataUpdatedAt ? ` · actualizado ${new Date(runtime.dataUpdatedAt).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil' })}` : ''}</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-success motion-safe:animate-pulse-fast" aria-hidden="true" />
                  <span className="text-success">En vivo{runtime.dataUpdatedAt ? ` · actualizado ${new Date(runtime.dataUpdatedAt).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil' })}` : ''}</span>
                </>
              )}
            </span>
            <button
              type="button"
              aria-pressed={paused}
              onClick={() => setPaused((p) => !p)}
              className="inline-flex items-center gap-1 rounded-lg border border-line-strong px-2 py-1 text-small font-semibold text-ink hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-text"
            >
              {paused ? <Play className="h-3 w-3" aria-hidden="true" /> : <Pause className="h-3 w-3" aria-hidden="true" />}
              {paused ? 'Reanudar' : 'Pausar'}
            </button>
          </div>
          <span className="text-small text-muted">Contadores de este proceso: parten de cero en cada reinicio del servidor.</span>
        </div>
        {runtime.error != null && !r ? (
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
                <div key={String(label)} className="rounded-xl bg-paper p-3">
                  <div className="text-small text-muted">{label}</div>
                  <Flash value={value} className={`mt-1 rounded-md text-lead font-semibold ${label === 'Errores 5xx' && Number(value) > 0 ? 'text-danger' : 'text-gold-text'}`} />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-small font-semibold text-ink">Rutas más usadas</h3>
                <Table label="Rutas con más actividad" maxHeightClass="max-h-72" className="min-w-0 text-small">
                  <TableHead>
                    <tr>
                      <TableHeaderCell className="px-2 py-1.5">Ruta</TableHeaderCell>
                      <TableHeaderCell className="px-2 py-1.5 text-right">Veces</TableHeaderCell>
                      <TableHeaderCell className="px-2 py-1.5 text-right">Prom.</TableHeaderCell>
                      <TableHeaderCell className="px-2 py-1.5 text-right">Máx.</TableHeaderCell>
                      <TableHeaderCell className="px-2 py-1.5 text-right">Err.</TableHeaderCell>
                    </tr>
                  </TableHead>
                  <TableBody className="num">
                    {r.routes.slice(0, 10).map((route) => (
                      <TableRow key={route.route}>
                        <TableCell className="max-w-[16rem] truncate px-2 py-1.5" title={route.route}>
                          {route.route.replace('/api/v1', '')}
                        </TableCell>
                        <Flash as="td" value={route.count} className="px-2 py-1.5 text-right" />
                        <Flash as="td" value={`${route.avgMs} ms`} className="px-2 py-1.5 text-right" />
                        <Flash as="td" value={`${route.maxMs} ms`} className="px-2 py-1.5 text-right" />
                        <TableCell className={`px-2 py-1.5 text-right ${route.serverErrors > 0 ? 'text-danger' : ''}`}>{route.clientErrors + route.serverErrors}</TableCell>
                      </TableRow>
                    ))}
                    {r.routes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-2 py-3 text-muted">
                          Aún sin tráfico.
                        </td>
                      </tr>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-small font-semibold text-ink">Procesos automáticos</h3>
                  <ul className="space-y-1.5 text-small">
                    {Object.entries(r.jobs).length === 0 && <li className="text-muted">Todavía no se ejecutó ninguno desde el arranque.</li>}
                    {Object.entries(r.jobs).map(([name, job]) => (
                      <li key={name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper px-3 py-2">
                        <span className="font-semibold">{jobLabel(name)}</span>
                        <span className={job.lastError ? 'text-danger' : 'text-muted'}>
                          {job.lastError ? `Falló: ${job.lastError}` : `Último ciclo ${job.lastRunAt ? new Date(job.lastRunAt).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil' }) : '—'} · ${job.lastDurationMs} ms`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="grid grid-cols-2 gap-4 text-small">
                  <div>
                    <h3 className="mb-1 text-small font-semibold text-ink">Códigos de error</h3>
                    {Object.keys(r.problemCodes).length === 0 ? (
                      <p className="text-muted">Ninguno.</p>
                    ) : (
                      <ul className="num">
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
                    <h3 className="mb-1 text-small font-semibold text-ink">Eventos de dominio</h3>
                    {Object.keys(r.events).length === 0 ? (
                      <p className="text-muted">Ninguno.</p>
                    ) : (
                      <ul className="num">
                        {Object.entries(r.events)
                          .slice(0, 8)
                          .map(([type, n]) => (
                            <li key={type} className="flex justify-between gap-2">
                              <span className="truncate">{type}</span>
                              <span className={r.consumerFailures[type] ? 'text-danger' : ''}>{n}</span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <BookingIntegrationCard runtime={r} />
          </>
        )}
      </section>
    </div>
  );
};
