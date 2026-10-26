import type { AuditoriaSaga, EstadoFactura, OrigenFactura } from '../api/types';

/** Presentation rules of the audit and invoice consoles: pure functions, no React. */

export type AuditTone = 'success' | 'warning' | 'danger' | 'neutral';

const SAGA_ESTADOS: Record<string, { label: string; tone: AuditTone }> = {
  EN_CURSO: { label: 'En curso', tone: 'warning' },
  COMPLETADA: { label: 'Completada', tone: 'success' },
  COMPENSADA: { label: 'Compensada (deshecha)', tone: 'danger' },
  FALLIDA: { label: 'Fallida', tone: 'danger' },
};

export function sagaEstado(estado: string): { label: string; tone: AuditTone } {
  return SAGA_ESTADOS[estado] ?? { label: estado, tone: 'neutral' };
}

/** COMPENSADA and FALLIDA are the ones a person must look at. */
export const sagaRequiereAtencion = (estado: string): boolean => estado === 'COMPENSADA' || estado === 'FALLIDA';

const PASO_ESTADOS: Record<string, { label: string; tone: AuditTone }> = {
  OK: { label: 'Correcto', tone: 'success' },
  COMPLETADO: { label: 'Correcto', tone: 'success' },
  COMPLETADA: { label: 'Correcto', tone: 'success' },
  EJECUTADO: { label: 'Correcto', tone: 'success' },
  FALLIDO: { label: 'Falló', tone: 'danger' },
  FALLIDA: { label: 'Falló', tone: 'danger' },
  ERROR: { label: 'Falló', tone: 'danger' },
  COMPENSADO: { label: 'Compensado', tone: 'danger' },
  COMPENSADA: { label: 'Compensado', tone: 'danger' },
  OMITIDO: { label: 'Omitido', tone: 'neutral' },
};

export function pasoEstado(estado: string): { label: string; tone: AuditTone } {
  return PASO_ESTADOS[estado.toUpperCase()] ?? { label: estado, tone: 'neutral' };
}

export const AUDIT_BADGE_CLASS: Record<AuditTone, string> = {
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  neutral: 'bg-slate-100 text-slate-700',
};

/** 850 -> "850 ms"; 12400 -> "12,4 s". */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toLocaleString('es-EC', { maximumFractionDigits: 1 })} s`;
}

/** Wall-clock duration of a whole saga, or null while it is still running. */
export function sagaDuration(saga: Pick<AuditoriaSaga, 'iniciadaEn' | 'finalizadaEn'>): number | null {
  if (!saga.finalizadaEn) return null;
  const ms = Date.parse(saga.finalizadaEn) - Date.parse(saga.iniciadaEn);
  return Number.isNaN(ms) || ms < 0 ? null : ms;
}

/** Steps in execution order whatever the order the API used. */
export const pasosOrdenados = (saga: Pick<AuditoriaSaga, 'pasos'>) => [...saga.pasos].sort((a, b) => a.secuencia - b.secuencia);

/** The filter box: blank means «no filter»; anything else is sent trimmed. */
export function cleanCorrelation(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 120) : undefined;
}

export const SAGA_STATES = ['EN_CURSO', 'COMPLETADA', 'COMPENSADA', 'FALLIDA'] as const;

const ORIGEN: Record<OrigenFactura, string> = { ORDEN: 'Vuelo', EXPERIENCIA: 'Experiencia' };
export const origenFacturaLabel = (origen: string): string => ORIGEN[origen as OrigenFactura] ?? origen;

const ESTADO_FACTURA: Record<EstadoFactura, string> = { EMITIDA: 'Emitida', ANULADA: 'Anulada' };
export const estadoFacturaLabel = (estado: string): string => ESTADO_FACTURA[estado as EstadoFactura] ?? estado;
