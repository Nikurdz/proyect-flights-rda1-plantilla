import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, ClipboardList, Download, Network, Search, X } from 'lucide-react';
import {
  useExportarTrazaCsv,
  useFlujoTraza,
  useMapaTraza,
  useTrazabilidad,
  type TrazaFlujoParams,
  type TrazaItem,
} from '../../api/endpoints/trazabilidad';
import { ProblemAlert } from '../../components/common/ProblemAlert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { cleanCorrelation, formatDuration, pasoEstado, AUDIT_BADGE_CLASS } from '../../lib/auditoria';
import { formatAdminDateTime } from '../../lib/labels';
import { useSession } from '../../lib/session';
import { EMPTY_TRAZA_FORM, FUENTE_LABEL, abbreviateId, fuenteLabel, toTrazaFiltros, type TrazaForm } from '../../lib/trazabilidad';
import { TraceEstadoBadge } from './TraceEstadoBadge';
import { TraceFlowGraph } from './TraceFlowGraph';

const FUENTE_CLASS: Record<string, string> = {
  evento: 'bg-sky-100 text-sky-800',
  saga: 'bg-violet-100 text-violet-800',
  admin: 'bg-slate-200 text-slate-800',
};

type PanelTarget = { kind: 'flujo'; params: TrazaFlujoParams } | { kind: 'mapa' };

/** A correlation id that opens the timeline filtered by it: everything that request touched. */
const CorrelationLink: React.FC<{ id: string }> = ({ id }) => (
  <Link
    to={`/admin/auditoria?correlationId=${encodeURIComponent(id)}`}
    className="break-all font-mono text-[11px] font-semibold text-brand-blue underline underline-offset-2 hover:text-brand-black"
    aria-label={`Ver todo lo que tocó la correlación ${id}`}
    title="Ver todo lo que tocó esta correlación"
  >
    {id}
  </Link>
);

/** Modal with the node graph; while it is open the data refreshes by itself (the hooks poll). */
const TracePanel: React.FC<{ target: PanelTarget; desde?: string; hasta?: string; ownerId?: string; onClose: () => void }> = ({ target, desde, hasta, ownerId, onClose }) => {
  const isMap = target.kind === 'mapa';
  const flujo = useFlujoTraza(target.kind === 'flujo' ? target.params : {}, ownerId, !isMap);
  const mapa = useMapaTraza({ desde, hasta }, ownerId, isMap);
  const query = isMap ? mapa : flujo;
  const closeRef = useRef<HTMLButtonElement>(null);
  const title = isMap ? 'Mapa general de comunicación' : 'Flujo de comunicación';

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const subject = target.kind === 'flujo' ? (target.params.numero ? `Orden o PNR ${target.params.numero}` : `Correlación ${target.params.correlationId}`) : desde || hasta ? `Periodo ${desde ?? '…'} a ${hasta ?? '…'} (días de Ecuador)` : 'Todo el periodo';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="trace-panel-title" className="my-6 w-full max-w-6xl rounded-2xl bg-white p-5 shadow-xl">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="trace-panel-title" className="flex items-center gap-2 text-base font-black text-brand-black">
              <Network className="h-5 w-5 text-brand-gold-dark" aria-hidden="true" />
              {title}
            </h3>
            <p className="mt-0.5 break-all text-xs text-slate-600">
              {subject}. Se actualiza cada 10 s mientras este panel está abierto; las horas son de Ecuador.
            </p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-airline-blue" aria-label="Cerrar el diagrama">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        {query.error != null && <ProblemAlert error={query.error} onRetry={() => query.refetch()} className="mb-3" />}
        {query.isLoading && (
          <div role="status" aria-busy="true" aria-label="Cargando el diagrama">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        )}
        {!isMap && flujo.data && (
          <>
            {flujo.data.correlaciones.length > 1 && (
              <p className="mb-3 text-[11px] text-slate-600">
                Reúne {flujo.data.correlaciones.length} correlaciones: <span className="break-all font-mono">{flujo.data.correlaciones.join(', ')}</span>
              </p>
            )}
            <TraceFlowGraph nodos={flujo.data.nodos} aristas={flujo.data.aristas} truncado={flujo.data.truncado} />
          </>
        )}
        {isMap && mapa.data && <TraceFlowGraph nodos={mapa.data.nodos} enlaces={mapa.data.enlaces} />}
      </div>
    </div>
  );
};

const PasosTable: React.FC<{ item: TrazaItem }> = ({ item }) => {
  const pasos = [...(item.pasos ?? [])].sort((a, b) => a.secuencia - b.secuencia);
  return (
    <div role="region" tabIndex={0} aria-label={`Pasos de la saga ${item.tipo}, desplazable horizontalmente`} className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-xs">
        <caption className="sr-only">Pasos de la saga {item.tipo} en orden de ejecución</caption>
        <thead className="text-slate-500">
          <tr>
            <th scope="col" className="py-1 pr-3 font-semibold">#</th>
            <th scope="col" className="py-1 pr-3 font-semibold">Paso</th>
            <th scope="col" className="py-1 pr-3 font-semibold">Estado</th>
            <th scope="col" className="py-1 pr-3 text-right font-semibold">Duración</th>
            <th scope="col" className="py-1 font-semibold">Detalle</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {pasos.map((p) => {
            const e = pasoEstado(p.estado);
            return (
              <tr key={p.secuencia} className={e.tone === 'danger' ? 'bg-red-50/60' : ''}>
                <td className="py-1.5 pr-3 font-mono text-slate-500">{p.secuencia}</td>
                <td className="py-1.5 pr-3 font-semibold text-slate-900">{p.nombre}</td>
                <td className="py-1.5 pr-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${AUDIT_BADGE_CLASS[e.tone]}`}>{e.label}</span>
                </td>
                <td className="py-1.5 pr-3 text-right font-mono">{p.duracionMs !== null && p.duracionMs !== undefined ? formatDuration(p.duracionMs) : '—'}</td>
                <td className="py-1.5 text-slate-600">{p.detalle ?? '—'}</td>
              </tr>
            );
          })}
          {pasos.length === 0 && (
            <tr>
              <td colSpan={5} className="py-3 text-center text-slate-500">
                Sin pasos registrados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

/** ADMIN only: one timeline of events, sagas and administrative changes, with the node flow of each operation. */
export const AdminAuditPage: React.FC = () => {
  const session = useSession();
  const ownerId = session?.ownerId;
  const [params, setParams] = useSearchParams();
  const urlCorrelation = cleanCorrelation(params.get('correlationId') ?? '');
  const [draft, setDraft] = useState<TrazaForm>({ ...EMPTY_TRAZA_FORM, correlationId: urlCorrelation ?? '' });
  const [filters, setFilters] = useState(() => toTrazaFiltros({ ...EMPTY_TRAZA_FORM, correlationId: urlCorrelation ?? '' }));
  const [panel, setPanel] = useState<PanelTarget | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [exported, setExported] = useState<string | null>(null);

  // When the link changes the correlation (a click on a correlation id), the form and the query follow it.
  const [seen, setSeen] = useState(urlCorrelation);
  if (seen !== urlCorrelation) {
    setSeen(urlCorrelation);
    setDraft((d) => ({ ...d, correlationId: urlCorrelation ?? '' }));
    setFilters((f) => ({ ...f, correlationId: urlCorrelation }));
  }

  const query = useTrazabilidad(filters, ownerId);
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const exportCsv = useExportarTrazaCsv();

  const set = <K extends keyof TrazaForm>(key: K, value: TrazaForm[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    const next = toTrazaFiltros(draft);
    setFilters(next);
    setParams(next.correlationId ? { correlationId: next.correlationId } : {});
    setExpanded(new Set());
  };

  const clear = () => {
    setDraft(EMPTY_TRAZA_FORM);
    setFilters(toTrazaFiltros(EMPTY_TRAZA_FORM));
    setParams({});
    setExpanded(new Set());
  };

  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const doExport = () => {
    setExported(null);
    exportCsv.mutate(filters, { onSuccess: (filename) => setExported(filename) });
  };

  return (
    <section aria-label="Trazabilidad">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-brand-gold-dark" aria-hidden="true" />
          <h2 className="text-lg font-black text-brand-black">Trazabilidad</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filters.numero && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setPanel({ kind: 'flujo', params: { numero: filters.numero } })}>
              <Network className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Ver flujo de {filters.numero}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setPanel({ kind: 'mapa' })}>
            <Network className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Mapa general
          </Button>
        </div>
      </div>
      <p className="mb-4 text-xs text-slate-600">Trazabilidad de Vuelos: eventos, sagas y cambios administrativos de todo el sistema. Los proveedores no se incluyen.</p>

      <form onSubmit={apply} className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4" aria-label="Filtros de trazabilidad">
        <Input label="Orden o PNR" placeholder="ORD-… o ABC123" value={draft.numero} onChange={(e) => set('numero', e.target.value)} leftIcon={<Search className="h-4 w-4" />} />
        <Input label="Correlation id" placeholder="Pega el id de una solicitud" value={draft.correlationId} onChange={(e) => set('correlationId', e.target.value)} />
        <Input label="Actor" placeholder="Id del actor" value={draft.actor} onChange={(e) => set('actor', e.target.value)} />
        <Input label="Tipo" placeholder="booking.cancelled" value={draft.tipo} onChange={(e) => set('tipo', e.target.value)} />
        <Select label="Fuente" value={draft.fuente} onChange={(e) => set('fuente', e.target.value as TrazaForm['fuente'])}>
          <option value="">Todas</option>
          {Object.entries(FUENTE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Input label="Desde (día de Ecuador)" type="date" value={draft.desde} max={draft.hasta || undefined} onChange={(e) => set('desde', e.target.value)} />
        <Input label="Hasta (día de Ecuador)" type="date" value={draft.hasta} min={draft.desde || undefined} onChange={(e) => set('hasta', e.target.value)} />
        <div className="flex items-end gap-2">
          <Button type="submit" variant="primary" className="flex-1">
            Buscar
          </Button>
          <Button type="button" variant="outline" onClick={clear}>
            Limpiar
          </Button>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3" aria-live="polite">
        <p className="text-[11px] text-slate-500">Más reciente primero, hora de Ecuador (UTC-5). El CSV usa los filtros aplicados y no contiene datos personales.</p>
        <Button type="button" variant="outline" size="sm" isLoading={exportCsv.isPending} onClick={doExport}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Exportar CSV
        </Button>
      </div>
      {exported && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          Descargado {exported}.
        </p>
      )}
      {exportCsv.error != null && <ProblemAlert error={exportCsv.error} className="mb-4" />}

      {filters.correlationId && (
        <p role="status" className="mb-4 inline-flex flex-wrap items-center gap-2 rounded-full border border-brand-gold/40 bg-brand-gold-light px-3 py-1.5 text-xs font-semibold text-brand-black">
          Filtrando por la correlación <span className="font-mono">{filters.correlationId}</span>
          <button type="button" onClick={() => setPanel({ kind: 'flujo', params: { correlationId: filters.correlationId } })} className="rounded-full bg-white px-2 py-0.5 hover:bg-slate-100">
            Ver flujo
          </button>
          <button type="button" onClick={clear} className="rounded-full p-0.5 hover:bg-white" aria-label="Quitar el filtro de correlación">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </p>
      )}

      {query.error != null && <ProblemAlert error={query.error} onRetry={() => query.refetch()} className="mb-4" />}

      <div role="region" tabIndex={0} aria-label="Línea de tiempo, desplazable horizontalmente" className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-left text-sm" aria-busy={query.isFetching}>
          <caption className="sr-only">Eventos, sagas y cambios administrativos, los más recientes primero</caption>
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">Cuándo (Ecuador)</th>
              <th scope="col" className="px-4 py-3">Fuente</th>
              <th scope="col" className="px-4 py-3">Tipo</th>
              <th scope="col" className="px-4 py-3">Estado</th>
              <th scope="col" className="px-4 py-3">Actor</th>
              <th scope="col" className="px-4 py-3">Referencia</th>
              <th scope="col" className="px-4 py-3">Resumen</th>
              <th scope="col" className="px-4 py-3">Correlación</th>
              <th scope="col" className="px-4 py-3 text-right">Flujo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {query.isLoading && (
              <tr>
                <td colSpan={9} className="p-4">
                  <div role="status" aria-busy="true" aria-label="Cargando">
                    <Skeleton className="h-24 w-full" />
                  </div>
                </td>
              </tr>
            )}
            {items.map((it) => {
              const key = `${it.fuente}-${it.id}`;
              const isSaga = it.fuente === 'saga';
              const open = expanded.has(key);
              return (
                <React.Fragment key={key}>
                  <tr className="align-top hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{formatAdminDateTime(it.en)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${FUENTE_CLASS[it.fuente] ?? 'bg-slate-100 text-slate-700'}`}>{fuenteLabel(it.fuente)}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-brand-black">
                      {isSaga ? (
                        <button
                          type="button"
                          onClick={() => toggle(key)}
                          aria-expanded={open}
                          aria-label={`${open ? 'Ocultar' : 'Ver'} los pasos de la saga ${it.tipo}`}
                          className="inline-flex items-center gap-1 rounded hover:text-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-airline-blue"
                        >
                          {open ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
                          {it.tipo}
                          <span className="font-sans text-[10px] font-semibold text-slate-500">({it.pasos?.length ?? 0} pasos)</span>
                        </button>
                      ) : (
                        it.tipo
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <TraceEstadoBadge estado={it.estado} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {it.actorTipo ?? '—'}
                      {it.actorId && (
                        <span className="ml-1 font-mono text-[11px] text-slate-500" title={it.actorId}>
                          {abbreviateId(it.actorId)}
                        </span>
                      )}
                    </td>
                    <td className="break-all px-4 py-3 font-mono text-[11px] text-slate-600">{it.numero ?? it.referencia ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{it.resumen ?? '—'}</td>
                    <td className="px-4 py-3">{it.correlationId ? <CorrelationLink id={it.correlationId} /> : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!it.correlationId}
                        aria-label={`Ver flujo de la correlación ${it.correlationId ?? ''}`}
                        onClick={() => it.correlationId && setPanel({ kind: 'flujo', params: { correlationId: it.correlationId } })}
                      >
                        Ver flujo
                      </Button>
                    </td>
                  </tr>
                  {isSaga && open && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={9} className="px-4 py-3">
                        <PasosTable item={it} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {!query.isLoading && items.length === 0 && !query.error && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">
                  No hay actividad registrada con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {query.hasNextPage && (
        <div className="mt-4 text-center">
          <Button type="button" variant="outline" isLoading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
            Cargar más
          </Button>
        </div>
      )}

      {panel && <TracePanel target={panel} desde={filters.desde} hasta={filters.hasta} ownerId={ownerId} onClose={() => setPanel(null)} />}
    </section>
  );
};
