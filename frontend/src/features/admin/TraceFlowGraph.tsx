import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { TrazaArista, TrazaEnlace, TrazaNodo } from '../../api/endpoints/trazabilidad';
import { formatDuration } from '../../lib/auditoria';
import { formatAdminDateTime } from '../../lib/labels';
import { NODE_H, NODE_W, edgeGeometry, layoutNodes, loopGeometry } from '../../lib/trace-layout';
import { estadoTraza, fuenteLabel } from '../../lib/trazabilidad';
import { TraceEstadoBadge } from './TraceEstadoBadge';

/** One arrow to draw, whether it comes from a flow (numbered steps) or from the general map (totals). */
interface DrawEdge {
  key: string;
  orden: number | null;
  desde: string;
  hasta: string;
  etiqueta: string;
  estado: string;
  fuente: string | null;
  ms: number | null;
  en: string | null;
  correlationId: string | null;
  total: number | null;
  errores: number | null;
}

export interface TraceFlowGraphProps {
  nodos: TrazaNodo[];
  /** Flow of one operation: numbered arrows. */
  aristas?: TrazaArista[];
  /** General map: arrows weighted by `total`, red when `errores > 0`. */
  enlaces?: TrazaEnlace[];
  truncado?: boolean;
}

const STROKE: Record<string, string> = { success: '#047857', warning: '#b45309', danger: '#b91c1c', neutral: '#475569' };
const NEW_EDGE_MS = 5000;

function toDrawEdges(aristas: TrazaArista[] | undefined, enlaces: TrazaEnlace[] | undefined): DrawEdge[] {
  if (aristas) {
    return [...aristas]
      .sort((a, b) => a.orden - b.orden)
      .map((a) => ({
        key: `${a.correlationId ?? ''}|${a.orden}|${a.desde}|${a.hasta}|${a.etiqueta}|${a.en ?? ''}`,
        orden: a.orden,
        desde: a.desde,
        hasta: a.hasta,
        etiqueta: a.etiqueta,
        estado: a.estado,
        fuente: a.fuente,
        ms: a.ms ?? null,
        en: a.en ?? null,
        correlationId: a.correlationId ?? null,
        total: null,
        errores: null,
      }));
  }
  return (enlaces ?? []).map((l) => ({
    key: `${l.desde}|${l.hasta}`,
    orden: null,
    desde: l.desde,
    hasta: l.hasta,
    etiqueta: `${l.total} ${l.total === 1 ? 'llamada' : 'llamadas'}${l.errores > 0 ? `, ${l.errores} con error` : ''}`,
    estado: l.errores > 0 ? 'ERROR' : 'OK',
    fuente: null,
    ms: null,
    en: null,
    correlationId: null,
    total: l.total,
    errores: l.errores,
  }));
}

const pairKey = (e: DrawEdge) => [e.desde, e.hasta].sort().join('|');

/** Graph of nodes drawn with plain SVG. The backend decides which nodes and arrows exist: nothing is hard-coded here. */
export const TraceFlowGraph: React.FC<TraceFlowGraphProps> = ({ nodos, aristas, enlaces, truncado }) => {
  const uid = useId().replace(/:/g, '');
  const edges = useMemo(() => toDrawEdges(aristas, enlaces), [aristas, enlaces]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const seen = useRef<Set<string> | null>(null);

  // An arrow that was not there at the previous refresh is highlighted for a few seconds.
  useEffect(() => {
    const keys = new Set(edges.map((e) => e.key));
    const previous = seen.current;
    seen.current = keys;
    if (!previous) return;
    const added = [...keys].filter((k) => !previous.has(k));
    if (added.length === 0) return;
    setFresh(new Set(added));
    const timer = setTimeout(() => setFresh(new Set()), NEW_EDGE_MS);
    return () => clearTimeout(timer);
  }, [edges]);

  const { layout, labels } = useMemo(() => {
    // An unknown node id is still drawn, with its id as the label.
    const known = new Set(nodos.map((n) => n.id));
    const extra: TrazaNodo[] = [];
    for (const e of edges) {
      for (const id of [e.desde, e.hasta]) {
        if (!known.has(id)) {
          known.add(id);
          extra.push({ id, etiqueta: id, tipo: 'servicio' });
        }
      }
    }
    const all = [...nodos, ...extra];
    return { layout: layoutNodes(all), labels: new Map(all.map((n) => [n.id, n.etiqueta])) };
  }, [nodos, edges]);

  const geometry = useMemo(() => {
    const pos = new Map(layout.nodes.map((n) => [n.id, n]));
    const pairs = new Map<string, DrawEdge[]>();
    const loops = new Map<string, number>();
    for (const e of edges) {
      if (e.desde === e.hasta) continue;
      pairs.set(pairKey(e), [...(pairs.get(pairKey(e)) ?? []), e]);
    }
    return edges.map((e) => {
      const a = pos.get(e.desde)!;
      const b = pos.get(e.hasta)!;
      if (e.desde === e.hasta) {
        const i = loops.get(e.desde) ?? 0;
        loops.set(e.desde, i + 1);
        return { edge: e, ...loopGeometry(a, i) };
      }
      const group = pairs.get(pairKey(e))!;
      return { edge: e, ...edgeGeometry(a, b, group.indexOf(e), group.length, e.desde < e.hasta) };
    });
  }, [layout, edges]);

  const selected = edges.find((e) => e.key === selectedKey) ?? null;
  const name = (id: string) => labels.get(id) ?? id;
  const describe = (e: DrawEdge) => `${e.orden !== null ? `Paso ${e.orden}: ` : ''}${name(e.desde)} a ${name(e.hasta)}, ${e.etiqueta}. Estado: ${estadoTraza(e.estado).label}`;
  const weight = (e: DrawEdge) => (e.total !== null ? 1.5 + Math.min(5, Math.log2(e.total + 1)) : 2);

  return (
    <div>
      {truncado && (
        <p role="note" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs font-semibold text-amber-900">
          El flujo se cortó en 500 pasos: se muestran solo los primeros.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50">
          <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="h-auto w-full min-w-[640px]" role="group" aria-label="Diagrama de nodos de la comunicación entre componentes">
            <defs>
              {Object.entries(STROKE).map(([tone, color]) => (
                <marker key={tone} id={`${uid}-${tone}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
                </marker>
              ))}
            </defs>

            {layout.nodes.map((n) => (
              <g key={n.id} data-node={n.id}>
                <rect x={n.x - NODE_W / 2} y={n.y - NODE_H / 2} width={NODE_W} height={NODE_H} rx={10} fill="#ffffff" stroke="#0f172a" strokeWidth={1.5} />
                <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill="#0f172a">
                  {n.etiqueta}
                </text>
              </g>
            ))}

            {geometry.map(({ edge, path, label }) => {
              const tone = estadoTraza(edge.estado).tone;
              const color = STROKE[tone];
              const isSelected = edge.key === selectedKey;
              const isNew = fresh.has(edge.key);
              const select = () => setSelectedKey(edge.key);
              return (
                <g
                  key={edge.key}
                  role="button"
                  tabIndex={0}
                  aria-label={describe(edge)}
                  aria-pressed={isSelected}
                  data-edge={edge.orden ?? undefined}
                  data-estado={edge.estado}
                  data-new={isNew || undefined}
                  className="cursor-pointer outline-none"
                  onClick={select}
                  onFocus={select}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      select();
                    }
                  }}
                >
                  <path d={path} fill="none" stroke="transparent" strokeWidth={14} />
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth={isSelected || isNew ? weight(edge) + 2 : weight(edge)}
                    strokeDasharray={tone === 'danger' ? '6 4' : undefined}
                    markerEnd={`url(#${uid}-${tone})`}
                  />
                  <circle cx={label.x} cy={label.y} r={11} fill={isNew ? '#fde68a' : '#ffffff'} stroke={color} strokeWidth={isSelected ? 3 : 2} />
                  <text x={label.x} y={label.y + 4} textAnchor="middle" fontSize={11} fontWeight={800} fill="#0f172a">
                    {edge.orden ?? edge.total}
                  </text>
                  {edge.orden !== null && (
                    <text x={label.x} y={label.y - 16} textAnchor="middle" fontSize={11} fill="#0f172a" stroke="#f8fafc" strokeWidth={3} paintOrder="stroke">
                      {edge.etiqueta}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="space-y-3">
          <div aria-live="polite" className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
            <h4 className="mb-1 text-xs font-black uppercase tracking-wider text-slate-500">Detalle de la flecha</h4>
            {selected ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="font-semibold text-slate-500">Ruta</dt>
                <dd>
                  {name(selected.desde)} → {name(selected.hasta)}
                </dd>
                <dt className="font-semibold text-slate-500">Etiqueta</dt>
                <dd>{selected.etiqueta}</dd>
                {selected.fuente && (
                  <>
                    <dt className="font-semibold text-slate-500">Fuente</dt>
                    <dd>{fuenteLabel(selected.fuente)}</dd>
                  </>
                )}
                <dt className="font-semibold text-slate-500">Estado</dt>
                <dd>
                  <TraceEstadoBadge estado={selected.estado} />
                </dd>
                {selected.ms !== null && (
                  <>
                    <dt className="font-semibold text-slate-500">Duración</dt>
                    <dd>{formatDuration(selected.ms)}</dd>
                  </>
                )}
                {selected.en && (
                  <>
                    <dt className="font-semibold text-slate-500">Hora (Ecuador)</dt>
                    <dd>{formatAdminDateTime(selected.en)}</dd>
                  </>
                )}
                {selected.correlationId && (
                  <>
                    <dt className="font-semibold text-slate-500">Correlación</dt>
                    <dd className="break-all font-mono text-[11px]">{selected.correlationId}</dd>
                  </>
                )}
                {selected.total !== null && (
                  <>
                    <dt className="font-semibold text-slate-500">Total</dt>
                    <dd>
                      {selected.total} ({selected.errores ?? 0} con error)
                    </dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="text-slate-500">Elige una flecha (clic o Tab) para ver su detalle.</p>
            )}
          </div>

          <div>
            <h4 className="mb-1 text-xs font-black uppercase tracking-wider text-slate-500">{aristas ? 'Pasos del flujo' : 'Enlaces'}</h4>
            {edges.length === 0 ? (
              <p className="text-xs text-slate-500">Sin comunicaciones registradas.</p>
            ) : (
              <ol aria-label={aristas ? 'Pasos del flujo en orden' : 'Enlaces entre componentes'} className="space-y-1.5 text-xs">
                {edges.map((e) => (
                  <li key={e.key} className={`rounded-lg border p-2 ${fresh.has(e.key) ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                    <span className="font-mono font-bold">{e.orden !== null ? `${e.orden}. ` : ''}</span>
                    <span className="font-semibold">
                      {name(e.desde)} → {name(e.hasta)}
                    </span>
                    : {e.etiqueta} <TraceEstadoBadge estado={e.estado} />
                    {e.ms !== null && <span className="ml-1 text-slate-500">({formatDuration(e.ms)})</span>}
                    {e.en && <span className="ml-1 text-slate-500">{formatAdminDateTime(e.en)}</span>}
                    {fresh.has(e.key) && <span className="ml-1 font-bold text-amber-800">Nuevo</span>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
