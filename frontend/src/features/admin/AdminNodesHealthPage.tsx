import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, RefreshCw } from 'lucide-react';
import { PROVEEDORES_REFRESH_MS, useProveedores, useSaludProveedor } from '../../api/endpoints/proveedores';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatLatency, haceTiempo, resumenFlota, seriesLatencia, tipoServicioLabel } from '../../lib/proveedores';
import { useSession } from '../../lib/session';
import { LatencyChart } from './LatencyChart';
import { CircuitBadge, LedStatus } from './LedStatus';

const Tile: React.FC<{ label: string; value: number; alert?: boolean }> = ({ label, value, alert }) => (
  <div className={`rounded-2xl border bg-white p-4 shadow-sm ${alert && value > 0 ? 'border-red-300' : 'border-slate-200/80'}`}>
    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{label}</div>
    <div className={`mt-1 text-2xl font-black ${alert && value > 0 ? 'text-red-700' : 'text-brand-black'}`}>{value}</div>
  </div>
);

/** ADMIN only: state of every partner node and its circuit, with the latency history of the one you pick. */
export const AdminNodesHealthPage: React.FC = () => {
  const session = useSession();
  const ownerId = session?.ownerId;
  const nodes = useProveedores(ownerId);
  const [picked, setPicked] = useState<string | null>(null);

  const lista = nodes.data ?? [];
  // The chosen node, or the first one while nothing has been chosen (or the chosen one was deleted).
  const selected = lista.find((p) => p.id === picked) ?? lista[0];
  const history = useSaludProveedor(selected?.id, ownerId, { refetchMs: PROVEEDORES_REFRESH_MS });
  const flota = resumenFlota(lista);
  const puntos = seriesLatencia(history.data ?? []);

  return (
    <section aria-label="Salud de nodos">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-brand-gold-dark" aria-hidden="true" />
          <h2 className="text-lg font-black text-brand-black">Salud de nodos</h2>
        </div>
        <button type="button" onClick={() => void nodes.refetch()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-brand-black">
          <RefreshCw className={`h-3.5 w-3.5 ${nodes.isFetching ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
          {nodes.dataUpdatedAt ? `Actualizado ${new Date(nodes.dataUpdatedAt).toLocaleTimeString('es-EC')}` : 'Actualizar'} · cada {PROVEEDORES_REFRESH_MS / 1000} s
        </button>
      </div>

      {nodes.error != null && <ProblemAlert error={nodes.error} onRetry={() => nodes.refetch()} className="mb-4" />}

      {nodes.isLoading ? (
        <div role="status" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5" role="group" aria-label="Resumen de nodos">
            <Tile label="Nodos" value={flota.total} />
            <Tile label="En línea" value={flota.enLinea} />
            <Tile label="Caídos" value={flota.caidos} alert />
            <Tile label="Degradados" value={flota.degradados} />
            <Tile label="Circuitos abiertos" value={flota.circuitosAbiertos} alert />
          </div>

          <div role="region" tabIndex={0} aria-label="Tabla de nodos, desplazable horizontalmente" className="mb-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[820px] text-left text-sm">
              <caption className="sr-only">Estado de cada nodo proveedor</caption>
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Nodo</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3 text-right">Latencia</th>
                  <th scope="col" className="px-4 py-3">Circuito</th>
                  <th scope="col" className="px-4 py-3">Última comprobación</th>
                  <th scope="col" className="px-4 py-3 text-right">Histórico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((p) => {
                  const isSelected = p.id === selected?.id;
                  return (
                    <tr key={p.id} className={isSelected ? 'bg-brand-gold-light/50' : ''}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-brand-black">{p.nombre}</p>
                        <p className="text-xs text-slate-500">
                          {tipoServicioLabel(p.tipoServicio)} · {p.equipo}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <LedStatus estado={p.salud.estado} showHint />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-bold">{formatLatency(p.salud.latenciaMs)}</td>
                      <td className="px-4 py-3">
                        <CircuitBadge circuito={p.circuito} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{haceTiempo(p.salud.comprobadoEn)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setPicked(p.id)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${isSelected ? 'border-brand-black bg-brand-black text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                          aria-label={`Ver el histórico de latencia de ${p.nombre}`}
                        >
                          {isSelected ? 'Mostrando' : 'Ver histórico'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {lista.length === 0 && !nodes.error && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                      No hay proveedores registrados.{' '}
                      <Link to="/admin/proveedores" className="font-semibold underline">
                        Registrar uno
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {selected && (
            <div aria-live="polite">
              {history.error != null ? (
                <ProblemAlert error={history.error} onRetry={() => history.refetch()} />
              ) : history.isLoading ? (
                <div role="status" aria-busy="true" aria-label="Cargando histórico">
                  <Skeleton className="h-64 w-full rounded-2xl" />
                </div>
              ) : (
                <LatencyChart title={`Latencia de ${selected.nombre}`} puntos={puntos} />
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};
