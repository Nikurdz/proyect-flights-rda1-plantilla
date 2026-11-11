import type { EstadoCircuito, EstadoSalud, ProveedorView, SaludView, SincronizacionView, TipoServicio } from '../api/types';

/** Presentation rules of the provider console: pure functions, no React. */

export type LedTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface Semaforo {
  tone: LedTone;
  /** Text that always accompanies the colour (never colour alone). */
  label: string;
  hint: string;
}

const SEMAFOROS: Record<EstadoSalud, Semaforo> = {
  UP: { tone: 'success', label: 'En línea', hint: 'Responde con normalidad.' },
  DEGRADADO: { tone: 'warning', label: 'Degradado', hint: 'Responde, pero lento o con avisos.' },
  DOWN: { tone: 'danger', label: 'Caído', hint: 'No responde al healthcheck.' },
  APAGADO: { tone: 'neutral', label: 'Apagado', hint: 'Apagado a mano (kill-switch): no se le llama.' },
  SIN_DATOS: { tone: 'neutral', label: 'Sin datos', hint: 'Aún no se ha comprobado.' },
};

/** Maps the health state of the API to the traffic light: green UP, amber DEGRADADO, red DOWN, grey otherwise. */
export function semaforo(estado: string | null | undefined): Semaforo {
  return SEMAFOROS[(estado ?? 'SIN_DATOS') as EstadoSalud] ?? SEMAFOROS.SIN_DATOS;
}

export const LED_DOT_CLASS: Record<LedTone, string> = {
  success: 'bg-emerald-500 shadow-[0_0_8px_2px_rgba(16,185,129,0.55)]',
  warning: 'bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.55)]',
  danger: 'bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.55)]',
  neutral: 'bg-slate-400',
};

export const LED_TEXT_CLASS: Record<LedTone, string> = {
  success: 'text-emerald-800',
  warning: 'text-amber-800',
  danger: 'text-red-800',
  neutral: 'text-slate-600',
};

export interface CircuitoInfo {
  tone: LedTone;
  label: string;
  hint: string;
}

const CIRCUITOS: Record<EstadoCircuito, CircuitoInfo> = {
  CERRADO: { tone: 'success', label: 'Circuito cerrado', hint: 'Las llamadas pasan con normalidad.' },
  SEMIABIERTO: { tone: 'warning', label: 'Circuito semiabierto', hint: 'Se están probando llamadas sueltas para ver si se recuperó.' },
  ABIERTO: { tone: 'danger', label: 'Circuito abierto', hint: 'Se rechazan las llamadas sin intentarlas, para no esperar a un nodo caído.' },
};

export function circuitoInfo(circuito: string | null | undefined): CircuitoInfo {
  return CIRCUITOS[circuito as EstadoCircuito] ?? CIRCUITOS.CERRADO;
}

const TIPOS: Record<TipoServicio, string> = { ATRACCIONES: 'Atracciones', AUTOS: 'Autos', ALOJAMIENTOS: 'Alojamientos' };

export const TIPOS_SERVICIO: { value: TipoServicio; label: string }[] = [
  { value: 'ATRACCIONES', label: TIPOS.ATRACCIONES },
  { value: 'AUTOS', label: TIPOS.AUTOS },
  { value: 'ALOJAMIENTOS', label: TIPOS.ALOJAMIENTOS },
];

export const tipoServicioLabel = (tipo: string): string => TIPOS[tipo as TipoServicio] ?? tipo;

/** Only the attractions catalog can be imported; AUTOS and ALOJAMIENTOS answer 422 by design. */
export const puedeSincronizar = (tipo: string): boolean => tipo === 'ATRACCIONES';

export function formatLatency(ms: number | null | undefined): string {
  return ms === null || ms === undefined ? '—' : `${Math.round(ms).toLocaleString('es-EC')} ms`;
}

export function resumenSincronizacion(r: SincronizacionView): string {
  return `${r.importados} importados: ${r.nuevos} nuevos, ${r.actualizados} actualizados y ${r.desactivados} desactivados.`;
}

/** A provider that is on and not answering: what the dashboard counts as «caído». */
export const estaCaido = (p: Pick<ProveedorView, 'activo' | 'salud'>): boolean => p.activo && p.salud.estado === 'DOWN';

export interface ResumenFlota {
  total: number;
  enLinea: number;
  degradados: number;
  caidos: number;
  apagados: number;
  sinDatos: number;
  circuitosAbiertos: number;
}

export function resumenFlota(proveedores: ProveedorView[]): ResumenFlota {
  const r: ResumenFlota = { total: proveedores.length, enLinea: 0, degradados: 0, caidos: 0, apagados: 0, sinDatos: 0, circuitosAbiertos: 0 };
  for (const p of proveedores) {
    if (!p.activo) r.apagados++;
    else if (p.salud.estado === 'UP') r.enLinea++;
    else if (p.salud.estado === 'DEGRADADO') r.degradados++;
    else if (p.salud.estado === 'DOWN') r.caidos++;
    else r.sinDatos++;
    if (p.activo && p.circuito === 'ABIERTO') r.circuitosAbiertos++;
  }
  return r;
}

export interface PuntoLatencia {
  at: number;
  ms: number;
  estado: string;
}

/** The API sends the history newest first; a chart needs it oldest first and only the checks that measured something. */
export function seriesLatencia(historial: SaludView[]): PuntoLatencia[] {
  return historial
    .filter((h): h is SaludView & { latenciaMs: number; comprobadoEn: string } => h.latenciaMs !== null && h.comprobadoEn !== null && !Number.isNaN(Date.parse(h.comprobadoEn)))
    .map((h) => ({ at: Date.parse(h.comprobadoEn), ms: h.latenciaMs, estado: h.estado }))
    .sort((a, b) => a.at - b.at);
}

export interface EstadisticasLatencia {
  min: number;
  max: number;
  media: number;
  ultima: number;
}

export function estadisticasLatencia(puntos: PuntoLatencia[]): EstadisticasLatencia | null {
  if (puntos.length === 0) return null;
  const valores = puntos.map((p) => p.ms);
  return {
    min: Math.min(...valores),
    max: Math.max(...valores),
    media: Math.round(valores.reduce((s, v) => s + v, 0) / valores.length),
    ultima: valores[valores.length - 1],
  };
}

/** A round upper bound for the Y axis so the grid lines fall on tidy numbers. */
export function techoEje(max: number): number {
  if (max <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((v) => v >= max) ?? 10 * magnitude;
  return step;
}

/** "hace 3 min" for the age of the last check; «nunca» when it never ran. */
export function haceTiempo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return 'nunca';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'nunca';
  const seconds = Math.max(0, Math.round((now - t) / 1000));
  if (seconds < 60) return 'hace unos segundos';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}
