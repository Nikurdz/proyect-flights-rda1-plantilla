import React, { useId, useState } from 'react';
import { compactUsd, niceMax, sharePct, shortDay, type Slice } from '../../../lib/dashboard';

/** Palette: gold/black/greys plus green and red; legends and tables never rely on colour alone. */
export const PALETTE = ['#B8860B', '#111111', '#6B7280', '#047857', '#B91C1C', '#D4AF37', '#9CA3AF', '#374151'];

export interface TableData {
  headers: string[];
  rows: (string | number)[][];
}

/** Card with a title, an accessible summary, the chart, a live readout (hover/focus) and a data table. */
export const ChartCard: React.FC<{
  title: string;
  summary: string;
  table: TableData;
  readout?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ title, summary, table, readout, className = '', children }) => (
  <section className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ${className}`} aria-label={title}>
    <h3 className="text-sm font-bold text-slate-900">{title}</h3>
    <div role="img" aria-label={`${title}. ${summary}`} className="mt-3">
      {children}
    </div>
    <p className="mt-1 min-h-[1.25rem] text-[11px] font-medium text-slate-600" aria-hidden="true">
      {readout ?? ''}
    </p>
    <details className="mt-1 text-xs">
      <summary className="cursor-pointer font-semibold text-slate-600 hover:text-brand-black">Ver datos en tabla</summary>
      <div className="mt-2 max-h-56 overflow-auto">
        <table className="w-full text-left">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              {table.headers.map((h) => (
                <th key={h} scope="col" className="border-b border-slate-200 py-1 pr-3 font-bold text-slate-700">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="border-b border-slate-100 py-1 pr-3 text-slate-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  </section>
);

export const EmptyChart: React.FC<{ text?: string }> = ({ text = 'Sin datos en esta ventana.' }) => <p className="py-8 text-center text-xs text-slate-500">{text}</p>;

const W = 600;
const H = 220;
const PAD = { l: 44, r: 12, t: 10, b: 24 };

function xAt(i: number, n: number): number {
  return n <= 1 ? (PAD.l + W - PAD.r) / 2 : PAD.l + (i * (W - PAD.l - PAD.r)) / (n - 1);
}

const Axis: React.FC<{ max: number; fmt: (v: number) => string }> = ({ max, fmt }) => (
  <g>
    {[0, 0.5, 1].map((t) => {
      const y = PAD.t + (1 - t) * (H - PAD.t - PAD.b);
      return (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="#E5E7EB" strokeWidth="1" />
          <text x={PAD.l - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#4B5563">
            {fmt(max * t)}
          </text>
        </g>
      );
    })}
  </g>
);

const XLabels: React.FC<{ labels: string[]; at: (i: number) => number }> = ({ labels, at }) => {
  const step = Math.max(1, Math.ceil(labels.length / 8));
  return (
    <g>
      {labels.map((l, i) =>
        i % step === 0 || i === labels.length - 1 ? (
          <text key={i} x={at(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#4B5563">
            {shortDay(l)}
          </text>
        ) : null,
      )}
    </g>
  );
};

/** Daily series as a line over a gold area. Values in cents. */
export const RevenueAreaChart: React.FC<{ title: string; days: { fecha: string; ingresosMinor: number }[]; formatValue: (minor: number) => string }> = ({ title, days, formatValue }) => {
  const [active, setActive] = useState<number | null>(null);
  const gradId = useId();
  const max = niceMax(Math.max(0, ...days.map((d) => d.ingresosMinor)));
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const pts = days.map((d, i) => [xAt(i, days.length), y(d.ingresosMinor)] as const);
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${pts[pts.length - 1][0].toFixed(1)},${y(0)} L${pts[0][0].toFixed(1)},${y(0)} Z` : '';
  const total = days.reduce((n, d) => n + d.ingresosMinor, 0);
  const best = days.reduce((b, d) => (d.ingresosMinor > (b?.ingresosMinor ?? -1) ? d : b), days[0]);
  const readout = active !== null && days[active] ? `${days[active].fecha}: ${formatValue(days[active].ingresosMinor)}` : undefined;
  return (
    <ChartCard
      title={title}
      summary={`Total ${formatValue(total)} en ${days.length} días. Mejor día: ${best ? `${best.fecha} con ${formatValue(best.ingresosMinor)}` : 'sin datos'}.`}
      table={{ headers: ['Fecha', 'Ingresos'], rows: days.map((d) => [d.fecha, formatValue(d.ingresosMinor)]) }}
      readout={readout}
    >
      {days.length === 0 ? (
        <EmptyChart />
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" focusable="false">
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <Axis max={max} fmt={compactUsd} />
          <path d={area} fill={`url(#${gradId})`} />
          <path d={line} fill="none" stroke="#8A6508" strokeWidth="2" strokeLinejoin="round" />
          {pts.map(([px, py], i) => (
            <circle
              key={i}
              cx={px}
              cy={py}
              r={active === i ? 5 : days.length > 40 ? 2 : 3.5}
              fill="#111111"
              stroke="#D4AF37"
              strokeWidth="1.5"
              tabIndex={0}
              aria-label={`${days[i].fecha}: ${formatValue(days[i].ingresosMinor)}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <title>{`${days[i].fecha}: ${formatValue(days[i].ingresosMinor)}`}</title>
            </circle>
          ))}
          <XLabels labels={days.map((d) => d.fecha)} at={(i) => xAt(i, days.length)} />
        </svg>
      )}
    </ChartCard>
  );
};

/** Two series of daily bars: solid gold = orders, hatched red = cancellations. */
export const DailyBarsChart: React.FC<{ title: string; days: { fecha: string; ordenes: number; cancelaciones: number }[] }> = ({ title, days }) => {
  const [active, setActive] = useState<number | null>(null);
  const patId = useId();
  const max = niceMax(Math.max(0, ...days.map((d) => Math.max(d.ordenes, d.cancelaciones))));
  const slot = days.length ? (W - PAD.l - PAD.r) / days.length : 0;
  const bw = Math.max(1.5, Math.min(14, slot / 2 - 1));
  const hOf = (v: number) => (v / max) * (H - PAD.t - PAD.b);
  const baseY = H - PAD.b;
  const totO = days.reduce((n, d) => n + d.ordenes, 0);
  const totC = days.reduce((n, d) => n + d.cancelaciones, 0);
  const readout = active !== null && days[active] ? `${days[active].fecha}: ${days[active].ordenes} órdenes, ${days[active].cancelaciones} cancelaciones` : undefined;
  return (
    <ChartCard
      title={title}
      summary={`${totO} órdenes y ${totC} cancelaciones en ${days.length} días.`}
      table={{ headers: ['Fecha', 'Órdenes', 'Cancelaciones'], rows: days.map((d) => [d.fecha, d.ordenes, d.cancelaciones]) }}
      readout={readout}
    >
      {days.length === 0 ? (
        <EmptyChart />
      ) : (
        <>
          <ul className="mb-2 flex gap-4 text-[11px] text-slate-700" aria-hidden="true">
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#B8860B]" /> Órdenes
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border border-red-700 bg-red-200" /> Cancelaciones
            </li>
          </ul>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" focusable="false">
            <defs>
              <pattern id={patId} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="4" height="4" fill="#FEE2E2" />
                <rect width="2" height="4" fill="#B91C1C" />
              </pattern>
            </defs>
            <Axis max={max} fmt={(v) => String(Math.round(v))} />
            {days.map((d, i) => {
              const cx = PAD.l + slot * i + slot / 2;
              return (
                <g
                  key={d.fecha}
                  tabIndex={0}
                  aria-label={`${d.fecha}: ${d.ordenes} órdenes, ${d.cancelaciones} cancelaciones`}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  opacity={active === null || active === i ? 1 : 0.55}
                >
                  <title>{`${d.fecha}: ${d.ordenes} órdenes, ${d.cancelaciones} cancelaciones`}</title>
                  <rect x={cx - slot / 2} y={PAD.t} width={slot} height={H - PAD.t - PAD.b} fill="transparent" />
                  <rect x={cx - bw - 0.5} y={baseY - hOf(d.ordenes)} width={bw} height={hOf(d.ordenes)} fill="#B8860B" />
                  <rect x={cx + 0.5} y={baseY - hOf(d.cancelaciones)} width={bw} height={hOf(d.cancelaciones)} fill={`url(#${patId})`} stroke="#B91C1C" strokeWidth="0.5" />
                </g>
              );
            })}
            <XLabels labels={days.map((d) => d.fecha)} at={(i) => PAD.l + slot * i + slot / 2} />
          </svg>
        </>
      )}
    </ChartCard>
  );
};

export interface HBarItem {
  label: string;
  value: number;
  display: string;
  highlight?: boolean;
  note?: string;
}

/** Horizontal bars; `highlight` bars are red and carry a text flag so colour is not the only cue. */
export const HBarsChart: React.FC<{
  title: string;
  items: HBarItem[];
  max?: number;
  valueHeader: string;
  summary: string;
  flagText?: string;
  empty?: string;
}> = ({ title, items, max, valueHeader, summary, flagText = 'alta', empty }) => {
  const [active, setActive] = useState<number | null>(null);
  const top = max ?? Math.max(0, ...items.map((i) => i.value));
  const readout = active !== null && items[active] ? `${items[active].label}: ${items[active].display}${items[active].note ? ` (${items[active].note})` : ''}` : undefined;
  return (
    <ChartCard
      title={title}
      summary={summary}
      table={{ headers: ['Elemento', valueHeader], rows: items.map((i) => [i.label, i.display]) }}
      readout={readout}
    >
      {items.length === 0 ? (
        <EmptyChart text={empty} />
      ) : (
        <ul className="space-y-2.5">
          {items.map((it, i) => (
            <li
              key={it.label}
              tabIndex={0}
              aria-label={`${it.label}: ${it.display}${it.highlight ? `, ${flagText}` : ''}`}
              className="rounded text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
              title={`${it.label}: ${it.display}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <div className="mb-1 flex justify-between gap-2">
                <span className="font-medium text-slate-800">
                  {it.label}
                  {it.highlight && <span className="ml-1.5 rounded bg-red-100 px-1 py-px text-[10px] font-bold uppercase text-red-800">{flagText}</span>}
                </span>
                <span className="font-mono font-bold text-slate-900">{it.display}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <div
                  className={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500 ${it.highlight ? 'bg-red-700' : 'bg-brand-gold-dark'}`}
                  style={{ width: `${top > 0 ? Math.min(100, Math.max(it.value > 0 ? 2 : 0, (it.value / top) * 100)) : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
};

/** Donut with a legend that repeats values and percentages. */
export const DonutChart: React.FC<{ title: string; slices: Slice[]; unit?: string; empty?: string }> = ({ title, slices, unit = '', empty }) => {
  const [active, setActive] = useState<number | null>(null);
  const total = slices.reduce((n, s) => n + s.value, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const readout = active !== null && slices[active] ? `${slices[active].label}: ${slices[active].value}${unit} (${sharePct(slices[active].value, total)})` : undefined;
  return (
    <ChartCard
      title={title}
      summary={slices.length ? `Total ${total}. ${slices.map((s) => `${s.label} ${sharePct(s.value, total)}`).join(', ')}.` : 'Sin datos.'}
      table={{ headers: ['Categoría', 'Cantidad', 'Porcentaje'], rows: slices.map((s) => [s.label, s.value, sharePct(s.value, total)]) }}
      readout={readout}
    >
      {slices.length === 0 ? (
        <EmptyChart text={empty} />
      ) : (
        <div className="flex flex-wrap items-center gap-5">
          <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90" focusable="false">
            <circle cx="70" cy="70" r={R} fill="none" stroke="#F3F4F6" strokeWidth="20" />
            {slices.map((s, i) => {
              const len = (s.value / total) * C;
              const offset = -acc;
              acc += len;
              return (
                <circle
                  key={s.key}
                  cx="70"
                  cy="70"
                  r={R}
                  fill="none"
                  stroke={PALETTE[i % PALETTE.length]}
                  strokeWidth={active === i ? 24 : 20}
                  strokeDasharray={`${Math.max(0, len - (slices.length > 1 ? 1 : 0))} ${C}`}
                  strokeDashoffset={offset}
                  tabIndex={0}
                  aria-label={`${s.label}: ${s.value}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                >
                  <title>{`${s.label}: ${s.value} (${sharePct(s.value, total)})`}</title>
                </circle>
              );
            })}
            <g transform="rotate(90 70 70)">
              <text x="70" y="74" textAnchor="middle" fontSize="16" fontWeight="800" fill="#111111">
                {total}
              </text>
            </g>
          </svg>
          <ul className="min-w-0 flex-1 space-y-1.5 text-xs" aria-hidden="true">
            {slices.map((s, i) => (
              <li key={s.key} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="truncate text-slate-700">{s.label}</span>
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {s.value} <span className="font-normal text-slate-500">· {sharePct(s.value, total)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
};
