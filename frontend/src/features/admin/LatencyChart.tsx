import React from 'react';
import { LED_DOT_CLASS, estadisticasLatencia, formatLatency, semaforo, techoEje, type PuntoLatencia } from '../../lib/proveedores';
import { formatDateTime } from '../../lib/labels';
import { ChartCard, EmptyChart } from './dashboard/charts';

const W = 600;
const H = 220;
const PAD = { l: 52, r: 14, t: 12, b: 28 };

const POINT_COLOR: Record<string, string> = { success: '#059669', warning: '#D97706', danger: '#DC2626', neutral: '#64748B' };

const hhmm = (ms: number) => new Date(ms).toISOString().slice(11, 16);

/** Latency history of one node as a plain SVG line chart (no chart library). The data table is always available under it. */
export const LatencyChart: React.FC<{ title: string; puntos: PuntoLatencia[] }> = ({ title, puntos }) => {
  const stats = estadisticasLatencia(puntos);
  const table = {
    headers: ['Fecha (UTC)', 'Estado', 'Latencia'],
    rows: [...puntos].reverse().map((p) => [formatDateTime(new Date(p.at).toISOString()), semaforo(p.estado).label, formatLatency(p.ms)]),
  };

  if (!stats) {
    return (
      <ChartCard title={title} summary="Sin comprobaciones con latencia medida." table={table}>
        <EmptyChart text="Todavía no hay comprobaciones con latencia. Usa «Comprobar» en Proveedores." />
      </ChartCard>
    );
  }

  const top = techoEje(stats.max);
  const t0 = puntos[0].at;
  const t1 = puntos[puntos.length - 1].at;
  const span = Math.max(1, t1 - t0);
  const x = (at: number) => (puntos.length === 1 ? (PAD.l + W - PAD.r) / 2 : PAD.l + ((at - t0) / span) * (W - PAD.l - PAD.r));
  const y = (ms: number) => PAD.t + (1 - ms / top) * (H - PAD.t - PAD.b);
  const path = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.at).toFixed(1)},${y(p.ms).toFixed(1)}`).join(' ');

  return (
    <ChartCard
      title={title}
      summary={`${puntos.length} comprobaciones entre ${hhmm(t0)} y ${hhmm(t1)} UTC. Latencia mínima ${stats.min} ms, media ${stats.media} ms, máxima ${stats.max} ms, última ${stats.ultima} ms.`}
      table={table}
      readout={`Mín. ${stats.min} ms · media ${stats.media} ms · máx. ${stats.max} ms · última ${stats.ultima} ms`}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden="true">
        {[0, 0.5, 1].map((t) => {
          const yy = PAD.t + (1 - t) * (H - PAD.t - PAD.b);
          return (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={yy} y2={yy} stroke="#E5E7EB" strokeWidth="1" />
              <text x={PAD.l - 6} y={yy + 3} textAnchor="end" fontSize="10" fill="#4B5563">
                {Math.round(top * t)} ms
              </text>
            </g>
          );
        })}
        <text x={PAD.l} y={H - 8} fontSize="10" fill="#4B5563">
          {hhmm(t0)}
        </text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="10" fill="#4B5563">
          {hhmm(t1)} UTC
        </text>
        {puntos.length > 1 && <path d={path} fill="none" stroke="#8C7547" strokeWidth="2" strokeLinejoin="round" />}
        {puntos.map((p) => {
          const s = semaforo(p.estado);
          return (
            <circle key={p.at} cx={x(p.at)} cy={y(p.ms)} r="4" fill={POINT_COLOR[s.tone]} stroke="#fff" strokeWidth="1.5">
              <title>{`${hhmm(p.at)} UTC · ${s.label} · ${formatLatency(p.ms)}`}</title>
            </circle>
          );
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600" aria-label="Leyenda">
        {(['UP', 'DEGRADADO', 'DOWN'] as const).map((e) => {
          const s = semaforo(e);
          return (
            <li key={e} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-full ${LED_DOT_CLASS[s.tone].split(' ')[0]}`} />
              {s.label}
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
};
