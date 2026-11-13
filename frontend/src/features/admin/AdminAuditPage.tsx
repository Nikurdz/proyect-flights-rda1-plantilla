import React, { useMemo, useState } from 'react';
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
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../../components/ui/Table';
import { useToast } from '../../lib/toast';
import { AdminPageHeader } from './AdminPageHeader';
import { FilterPanel } from './FilterPanel';
import { cleanCorrelation, formatDuration, pasoEstado, AUDIT_BADGE_CLASS } from '../../lib/auditoria';
import { formatAdminDateTime } from '../../lib/labels';
import { useSession } from '../../lib/session';
import { EMPTY_TRAZA_FORM, FUENTE_LABEL, abbreviateId, fuenteLabel, toTrazaFiltros, type TrazaForm } from '../../lib/trazabilidad';
import { TraceEstadoBadge } from './TraceEstadoBadge';
import { TraceFlowGraph } from './TraceFlowGraph';

const FUENTE_CLASS: Record<string, string> = {
  evento: 'bg-ink/10 text-ink',
  saga: 'bg-gold-soft text-gold-text',
  admin: 'bg-line text-ink',
};

type PanelTarget = { kind: 'flujo'; params: TrazaFlujoParams } | { kind: 'mapa' };

/** A request id that opens the timeline filtered by it: everything that request touched. */
const CorrelationLink: React.FC<{ id: string }> = ({ id }) => (
  <Link
    to={`/admin/auditoria?correlationId=${encodeURIComponent(id)}`}
    className="num break-all text-small font-medium text-gold-text underline underline-offset-2 hover:text-ink"
    aria-label={`Ver todo lo que tocó la solicitud ${id}`}
    title="Ver todo lo que tocó esta solicitud"
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
  const title = isMap ? 'Mapa general de comunicación' : 'Flujo de comunicación';

  const subject = target.kind === 'flujo' ? (target.params.numero ? `Orden o PNR ${target.params.numero}` : `Solicitud ${target.params.correlationId}`) : desde || hasta ? `Periodo ${desde ?? '…'} a ${hasta ?? '…'} (días de Ecuador)` : 'Todo el periodo';

  return (
    <Dialog isOpen onClose={onClose} title={title} description={`${subject}. Se actualiza cada 10 s mientras este panel está abierto; las horas son de Ecuador.`} maxWidth="5xl">
        {query.error != null && <ProblemAlert error={query.error} onRetry={() => query.refetch()} className="mb-3" />}
        {query.isLoading && (
          <div role="status" aria-busy="true" aria-label="Cargando el diagrama">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        )}
        {!isMap && flujo.data && (
          <>
            {flujo.data.correlaciones.length > 1 && (
              <p className="mb-3 text-small text-muted">
                Reúne {flujo.data.correlaciones.length} solicitudes: <span className="num break-all">{flujo.data.correlaciones.join(', ')}</span>
              </p>
            )}
            <TraceFlowGraph nodos={flujo.data.nodos} aristas={flujo.data.aristas} truncado={flujo.data.truncado} />
          </>
        )}
        {isMap && mapa.data && <TraceFlowGraph nodos={mapa.data.nodos} enlaces={mapa.data.enlaces} />}
    </Dialog>
  );
};

const PasosTable: React.FC<{ item: TrazaItem }> = ({ item }) => {
  const pasos = [...(item.pasos ?? [])].sort((a, b) => a.secuencia - b.secuencia);
  return (
    <div role="region" tabIndex={0} aria-label={`Pasos de la saga ${item.tipo}, desplazable horizontalmente`} className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-xs">
        <caption className="sr-only">Pasos de la saga {item.tipo} en orden de ejecución</caption>
        <thead className="text-muted">
          <tr>
            <th scope="col" className="py-1 pr-3 font-semibold">#</th>
            <th scope="col" className="py-1 pr-3 font-semibold">Paso</th>
            <th scope="col" className="py-1 pr-3 font-semibold">Estado</th>
            <th scope="col" className="py-1 pr-3 text-right font-semibold">Duración</th>
            <th scope="col" className="py-1 font-semibold">Detalle</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {pasos.map((p) => {
            const e = pasoEstado(p.estado);
            return (
              <tr key={p.secuencia} className={e.tone === 'danger' ? 'bg-danger-soft/60' : ''}>
                <td className="py-1.5 pr-3 num text-muted">{p.secuencia}</td>
                <td className="py-1.5 pr-3 font-semibold text-ink">{p.nombre}</td>
                <td className="py-1.5 pr-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${AUDIT_BADGE_CLASS[e.tone]}`}>{e.label}</span>
                </td>
                <td className="py-1.5 pr-3 text-right num">{p.duracionMs !== null && p.duracionMs !== undefined ? formatDuration(p.duracionMs) : '—'}</td>
                <td className="py-1.5 text-muted">{p.detalle ?? '—'}</td>
              </tr>
            );
          })}
          {pasos.length === 0 && (
            <tr>
              <td colSpan={5} className="py-3 text-center text-muted">
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
  const toast = useToast();

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
    exportCsv.mutate(filters, { onSuccess: (filename) => toast.success(`Descargado ${filename}.`) });
  };

  return (
    <section aria-label="Trazabilidad">
      <AdminPageHeader
        page="auditoria"
        description="Todo lo que pasó en el sistema: eventos, procesos y cambios hechos desde la administración. Los proveedores no se incluyen."
        actions={
          <>
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
          </>
        }
      />

      <FilterPanel defaultOpen activeCount={Object.values(filters).filter(Boolean).length}>
      <form onSubmit={apply} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filtros de trazabilidad">
        <Input label="Orden o PNR" placeholder="Ej. el número de orden o ABC123" value={draft.numero} onChange={(e) => set('numero', e.target.value)} leftIcon={<Search className="h-4 w-4" />} />
        <Input label="Id de solicitud" placeholder="Pega el id de una solicitud" helperText="Sale en cada fila y agrupa todo lo que hizo una misma acción." value={draft.correlationId} onChange={(e) => set('correlationId', e.target.value)} />
        <Input label="Quién lo hizo" placeholder="Id de la persona o del sistema" value={draft.actor} onChange={(e) => set('actor', e.target.value)} />
        <Input label="Tipo" placeholder="Parte del nombre del evento" helperText="Escribe una palabra del Tipo que ves en la tabla." value={draft.tipo} onChange={(e) => set('tipo', e.target.value)} />
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
      </FilterPanel>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3" aria-live="polite">
        <p className="text-small text-muted">Más reciente primero, hora de Ecuador. El CSV usa los filtros aplicados y no contiene datos personales.</p>
        <Button type="button" variant="outline" size="sm" isLoading={exportCsv.isPending} onClick={doExport}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Exportar CSV
        </Button>
      </div>
      {exportCsv.error != null && <ProblemAlert error={exportCsv.error} className="mb-4" />}

      {filters.correlationId && (
        <p role="status" className="mb-4 inline-flex flex-wrap items-center gap-2 rounded-full border border-gold/40 bg-gold-soft px-3 py-1.5 text-small font-medium text-ink">
          Filtrando por la solicitud <span className="num">{filters.correlationId}</span>
          <button type="button" onClick={() => setPanel({ kind: 'flujo', params: { correlationId: filters.correlationId } })} className="rounded-full bg-surface px-2 py-0.5 hover:bg-ink/5">
            Ver flujo
          </button>
          <button type="button" onClick={clear} className="rounded-full p-0.5 hover:bg-surface" aria-label="Quitar el filtro de solicitud">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </p>
      )}

      {query.error != null && <ProblemAlert error={query.error} onRetry={() => query.refetch()} className="mb-4" />}

      <Table label="Línea de tiempo de eventos, procesos y cambios" className="min-w-[1100px]" aria-busy={query.isFetching}>
          <TableHead>
            <tr>
              <TableHeaderCell>Cuándo (hora de Ecuador)</TableHeaderCell>
              <TableHeaderCell>Fuente</TableHeaderCell>
              <TableHeaderCell>Tipo</TableHeaderCell>
              <TableHeaderCell>Estado</TableHeaderCell>
              <TableHeaderCell>Quién lo hizo</TableHeaderCell>
              <TableHeaderCell>Referencia</TableHeaderCell>
              <TableHeaderCell>Resumen</TableHeaderCell>
              <TableHeaderCell>Id de solicitud</TableHeaderCell>
              <TableHeaderCell className="text-right">Flujo</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
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
                  <TableRow>
                    <TableCell className="num whitespace-nowrap text-muted">{formatAdminDateTime(it.en)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${FUENTE_CLASS[it.fuente] ?? 'bg-line text-ink'}`}>{fuenteLabel(it.fuente)}</span>
                    </TableCell>
                    <TableCell className="num font-semibold text-ink">
                      {isSaga ? (
                        <button
                          type="button"
                          onClick={() => toggle(key)}
                          aria-expanded={open}
                          aria-label={`${open ? 'Ocultar' : 'Ver'} los pasos de la saga ${it.tipo}`}
                          className="inline-flex items-center gap-1 rounded hover:text-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-text"
                        >
                          {open ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
                          {it.tipo}
                          <span className="font-sans text-small font-medium text-muted">({it.pasos?.length ?? 0} pasos)</span>
                        </button>
                      ) : (
                        it.tipo
                      )}
                    </TableCell>
                    <TableCell>
                      <TraceEstadoBadge estado={it.estado} />
                    </TableCell>
                    <TableCell className="text-small">
                      {it.actorTipo ?? '—'}
                      {it.actorId && (
                        <span className="num ml-1 text-small text-muted" title={it.actorId}>
                          {abbreviateId(it.actorId)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="num break-all text-small text-muted">{it.numero ?? it.referencia ?? '—'}</TableCell>
                    <TableCell className="text-small">{it.resumen ?? '—'}</TableCell>
                    <TableCell>{it.correlationId ? <CorrelationLink id={it.correlationId} /> : '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!it.correlationId}
                        aria-label={`Ver flujo de la solicitud ${it.correlationId ?? ''}`}
                        onClick={() => it.correlationId && setPanel({ kind: 'flujo', params: { correlationId: it.correlationId } })}
                      >
                        Ver flujo
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isSaga && open && (
                    <tr className="bg-paper">
                      <td colSpan={9} className="px-4 py-3">
                        <PasosTable item={it} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
      </Table>
      {!query.isLoading && items.length === 0 && !query.error && (
        <EmptyState icon={<ClipboardList />} title="No hay actividad registrada con estos filtros" description="Prueba con otras fechas o quita algún filtro." />
      )}

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
