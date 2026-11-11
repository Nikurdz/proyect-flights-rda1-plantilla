import React from 'react';
import { LED_DOT_CLASS, LED_TEXT_CLASS, circuitoInfo, semaforo } from '../../lib/proveedores';

/** Traffic-light LED plus its text: the state is never conveyed by colour alone. */
export const LedStatus: React.FC<{ estado: string; className?: string; showHint?: boolean }> = ({ estado, className = '', showHint = false }) => {
  const s = semaforo(estado);
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span aria-hidden="true" className={`inline-block h-3 w-3 shrink-0 rounded-full ${LED_DOT_CLASS[s.tone]} ${s.tone === 'danger' ? 'motion-safe:animate-pulse' : ''}`} />
      <span className={`text-xs font-bold ${LED_TEXT_CLASS[s.tone]}`}>{s.label}</span>
      {showHint && <span className="sr-only">. {s.hint}</span>}
    </span>
  );
};

/** State of the circuit breaker as a pill with text. */
export const CircuitBadge: React.FC<{ circuito: string }> = ({ circuito }) => {
  const c = circuitoInfo(circuito);
  const tone = { success: 'bg-emerald-100 text-emerald-800', warning: 'bg-amber-100 text-amber-800', danger: 'bg-red-100 text-red-800', neutral: 'bg-slate-100 text-slate-700' }[c.tone];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`} title={c.hint}>
      {c.label}
      <span className="sr-only">. {c.hint}</span>
    </span>
  );
};
