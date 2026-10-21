/** Presentation helpers for the admin dashboard (pure, no React). */
import { formatMoney } from './money';
import { orderStatusLabel, passengerTypeLabel } from './labels';
import { paymentStateLabel } from './observability';

/** Integer cents -> "$12.34". Invalid values -> "—". */
export function centsToUsd(minor: number | null | undefined): string {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return '—';
  return formatMoney(minor / 100, 'USD');
}

/** Compact USD for chart axes: 123456 cents -> "$1.2 k". */
export function compactUsd(minor: number): string {
  const usd = minor / 100;
  if (Math.abs(usd) >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)} M`;
  if (Math.abs(usd) >= 1_000) return `$${(usd / 1_000).toFixed(1)} k`;
  return `$${Math.round(usd)}`;
}

/** "2026-10-07" -> "07/10". */
export function shortDay(iso: string): string {
  const [, m, d] = iso.split('-');
  return m && d ? `${d}/${m}` : iso;
}

export function formatInt(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : n.toLocaleString('es-EC');
}

/** Rounds the max up to a "nice" axis end (1, 2, 5 x 10^n). */
export function niceMax(value: number): number {
  if (!(value > 0)) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * exp;
}

export const OCCUPANCY_ALERT = 0.9;
export const isFull = (occupancy: number): boolean => occupancy >= OCCUPANCY_ALERT;

export interface Slice {
  key: string;
  label: string;
  value: number;
}

/** Counts map -> slices, largest first, zeros dropped. */
export function toSlices(counts: Record<string, number> | undefined, label: (key: string) => string): Slice[] {
  return Object.entries(counts ?? {})
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ key, label: label(key), value }))
    .sort((a, b) => b.value - a.value);
}

export const orderSlices = (c: Record<string, number> | undefined) => toSlices(c, orderStatusLabel);
export const paymentSlices = (c: Record<string, number> | undefined) => toSlices(c, paymentStateLabel);
export const passengerSlices = (c: Record<string, number> | undefined) => toSlices(c, passengerTypeLabel);

/** True when the window has no sales activity at all. */
export function isEmptyWindow(d: { kpis: { ordenesEmitidas: number }; serie: { ordenes: number; ofertas: number }[] }): boolean {
  return d.kpis.ordenesEmitidas === 0 && d.serie.every((p) => p.ordenes === 0 && p.ofertas === 0);
}

/** Share of a slice, "37,5 %". */
export function sharePct(value: number, total: number): string {
  if (total <= 0) return '0 %';
  return `${((value / total) * 100).toLocaleString('es-EC', { maximumFractionDigits: 1 })} %`;
}
