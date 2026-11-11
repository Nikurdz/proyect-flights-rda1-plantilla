import type { TrazaFiltros, TrazaFuente } from '../api/endpoints/trazabilidad';
import type { AuditTone } from './auditoria';

/** Presentation rules of the traceability console: pure functions, no React. */

export interface EstadoTraza {
  label: string;
  tone: AuditTone;
}

const ESTADOS: Record<string, EstadoTraza> = {
  OK: { label: 'OK', tone: 'success' },
  COMPENSADA: { label: 'Compensada', tone: 'warning' },
  ERROR: { label: 'Error', tone: 'danger' },
  EN_CURSO: { label: 'En curso', tone: 'neutral' },
};

export const estadoTraza = (estado: string): EstadoTraza => ESTADOS[estado] ?? { label: estado, tone: 'neutral' };

export const FUENTE_LABEL: Record<TrazaFuente, string> = { evento: 'Evento', saga: 'Saga', admin: 'Administración' };
export const fuenteLabel = (fuente: string): string => FUENTE_LABEL[fuente as TrazaFuente] ?? fuente;

/** `0a1b2c3d-…` -> `0a1b2c3d…`; a short id is kept. */
export function abbreviateId(id: string | null | undefined, max = 10): string {
  if (!id) return '';
  return id.length > max ? `${id.slice(0, max)}…` : id;
}

export interface TrazaForm {
  numero: string;
  correlationId: string;
  actor: string;
  tipo: string;
  fuente: TrazaFuente | '';
  desde: string;
  hasta: string;
}

export const EMPTY_TRAZA_FORM: TrazaForm = { numero: '', correlationId: '', actor: '', tipo: '', fuente: '', desde: '', hasta: '' };

/** Blank fields are not sent: they would filter by «nothing». */
export function toTrazaFiltros(form: TrazaForm): TrazaFiltros {
  const clean = (v: string, max = 120) => v.trim().slice(0, max) || undefined;
  return {
    numero: clean(form.numero),
    correlationId: clean(form.correlationId),
    actor: clean(form.actor),
    tipo: clean(form.tipo),
    fuente: form.fuente || undefined,
    desde: form.desde || undefined,
    hasta: form.hasta || undefined,
  };
}
