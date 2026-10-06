/** Presentation helpers for the admin observability page. */

export type Tone = 'success' | 'warning' | 'danger' | 'secondary';

/** 0.0123 -> "1,2 %"; null (nothing to divide by) -> "—". */
export function formatRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return '—';
  return `${(rate * 100).toLocaleString('es-EC', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} %`;
}

/** Colour of a rate where lower is better; no data stays neutral. */
export function rateTone(rate: number | null | undefined, warnAt: number, dangerAt: number): Tone {
  if (rate === null || rate === undefined) return 'secondary';
  if (rate >= dangerAt) return 'danger';
  if (rate >= warnAt) return 'warning';
  return 'success';
}

/** A backlog is healthy at zero. */
export function pendingTone(count: number): Tone {
  return count === 0 ? 'success' : count < 10 ? 'warning' : 'danger';
}

/** 3725 -> "1 h 2 min"; shows the two largest units. */
export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

const PAYMENT_STATES: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  AUTORIZADO: 'Autorizado',
  CAPTURADO: 'Capturado',
  CAPTURA_PENDIENTE: 'Captura pendiente',
  RECHAZADO: 'Rechazado por el banco',
  RECHAZADO_ANTIFRAUDE: 'Rechazado por antifraude',
  ANULADO: 'Anulado',
  ANULACION_PENDIENTE: 'Anulación pendiente',
};

const OFFER_STATES: Record<string, string> = {
  ABIERTA: 'Abierta',
  EN_REVISION_PRECIO: 'En revisión de precio',
  EN_PAGO: 'En pago',
  PAGADA: 'Pagada',
  VENCIDA: 'Vencida',
  CANCELADA: 'Cancelada',
};

const HOLD_STATES: Record<string, string> = { HELD: 'Retenida', CONSUMED: 'Convertida en reserva', EXPIRED: 'Vencida', RELEASED: 'Liberada' };
const NOTIFICATION_STATES: Record<string, string> = { ENVIADO: 'Enviada', FALLIDO: 'Fallida' };

const labelOf = (dictionary: Record<string, string>) => (state: string) => dictionary[state] ?? state;

export const paymentStateLabel = labelOf(PAYMENT_STATES);
export const offerStateLabel = labelOf(OFFER_STATES);
export const holdStateLabel = labelOf(HOLD_STATES);
export const notificationStateLabel = labelOf(NOTIFICATION_STATES);

/** Name of a background job as the runtime metrics report it. */
export function jobLabel(name: string): string {
  return name === 'reconciliacion' ? 'Reconciliación de pagos y avisos' : name === 'barredor-holds' ? 'Liberación de reservas vencidas' : name;
}

/** Width (0-100) of a bar for `value` against the largest value of its group. */
export function barPercent(value: number, max: number): number {
  return max > 0 ? Math.max(value > 0 ? 3 : 0, Math.round((value / max) * 100)) : 0;
}
