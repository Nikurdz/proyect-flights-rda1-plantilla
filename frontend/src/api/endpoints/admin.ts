import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { Schemas } from '../types';

export type AdminOrdenView = Schemas['AdminOrdenViewDto'];
export type AdminOrdenesPagina = Schemas['AdminOrdenesPaginaDto'];
export type AdminVueloView = Schemas['AdminVueloViewDto'];
export type AdminVuelosPagina = Schemas['AdminVuelosPaginaDto'];

/** GET /admin/vuelos/{id}/asientos: the cabin and every reserved seat with its locator (no passenger names). */
export interface AdminAsientosVuelo {
  vueloId: string;
  codigoVuelo: string;
  origen: string;
  destino: string;
  salida: string;
  capacidadTotal: number;
  reservados: { asiento: string; pnr: string; numeroOrden: string | null }[];
  filas: { rowNumber: number; seats: { seatNumber: string; isAvailable: boolean; characteristics: string[] }[] }[];
}

export type VentanaObservabilidad = '24h' | '7d';

type Counts = Record<string, number>;

/** GET /admin/observabilidad/resumen: aggregates computed from the database (no personal data). */
export interface ObservabilidadResumen {
  ventana: VentanaObservabilidad;
  generadoEn: string;
  desde: string;
  ordenes: { total: number; porEstado: Counts };
  ingresos: { moneda: string; monto: string; ordenes: number }[];
  pagos: { total: number; porEstado: Counts };
  tasas: { rechazoDePago: number | null; antifraude: number | null; compensacion: number | null; notificacionesFallidas: number | null };
  pendientes: { capturaPendiente: number; anulacionPendiente: number; autorizadoSinCaptura: number; emitidasSinConfirmacion: number };
  ofertas: { total: number; porEstado: Counts };
  notificaciones: { total: number; porEstado: Counts };
  holds: { total: number; porEstado: Counts; vencidosSinLiberar: number };
  inventario: { vuelosFuturos: number; asientosLibres: number; capacidad: number; ocupacion: number | null };
  idempotencia: { enCurso: number; respuestasConError5xx: number };
  auditoriaReciente: { id: string; entidad: string; entidadId: string; accion: string; creadoEn: string }[];
}

/** GET /admin/observabilidad/runtime: counters of the running process (reset on every restart). */
export interface ObservabilidadRuntime {
  startedAt: string;
  uptimeSeconds: number;
  requests: { total: number; clientErrors: number; serverErrors: number };
  rateLimited: number;
  routes: { route: string; count: number; clientErrors: number; serverErrors: number; avgMs: number; maxMs: number }[];
  problemCodes: Counts;
  events: Counts;
  consumerFailures: Counts;
  jobs: Record<string, { runs: number; failures: number; lastRunAt: string | null; lastDurationMs: number | null; lastResult: Counts | null; lastError: string | null }>;
}

export interface AdminOrdersFilters {
  estado?: string;
  numero?: string;
  pnr?: string;
  desde?: string;
  hasta?: string;
}

export interface AdminFlightsFilters {
  origen?: string;
  destino?: string;
  fecha?: string;
  vuelo?: string;
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

/** Back-office orders across customers (ADMIN only; the API answers 403 to anyone else). */
export function useAdminOrdenes(filters: AdminOrdersFilters, ownerId?: string) {
  return useInfiniteQuery({
    queryKey: ['admin-ordenes', ownerId, filters],
    queryFn: ({ pageParam }) => apiClient<AdminOrdenesPagina>(`admin/ordenes${toQuery({ ...filters, limit: 25, cursor: pageParam })}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(ownerId),
    retry: false,
  });
}

/** Database-backed summary; refreshes by itself so the page can stay open on a screen. */
export function useAdminObservabilidad(ventana: VentanaObservabilidad, ownerId?: string) {
  return useQuery({
    queryKey: ['admin-observabilidad', ownerId, ventana],
    queryFn: () => apiClient<ObservabilidadResumen>(`admin/observabilidad/resumen${toQuery({ ventana })}`),
    enabled: Boolean(ownerId),
    refetchInterval: 30_000,
    refetchOnWindowFocus: 'always',
    retry: false,
  });
}

export type DashboardDias = 7 | 30 | 90;

/** GET /admin/dashboard: business metrics of the window. `*Minor` fields are integer cents. */
export interface AdminDashboard {
  dias: number;
  moneda: string;
  generadoEn: string;
  desde: string;
  hasta: string;
  kpis: {
    ingresosMinor: number;
    ordenesEmitidas: number;
    ticketPromedioMinor: number;
    pasajeros: number;
    conversion: number | null;
    tasaCancelacion: number | null;
    reembolsosMinor: number;
    ocupacionFutura: number | null;
    vuelosAgotados: number;
    rechazoDePago: number | null;
  };
  serie: { fecha: string; ordenes: number; emitidas: number; ingresosMinor: number; ofertas: number; cancelaciones: number }[];
  embudo: { etapa: string; valor: number }[];
  ordenesPorEstado: Counts;
  pagosPorEstado: Counts;
  ofertasPorEstado: Counts;
  notificacionesPorEstado: Counts;
  pasajerosPorTipo: Counts;
  topRutas: { ruta: string; reservas: number; canceladas: number; ingresos: number }[];
  ocupacionPorRuta: { ruta: string; vuelos: number; capacidad: number; libres: number; agotados: number; ocupacion: number }[];
  posventa: { maletasExtra: number; ingresosEquipajeMinor: number; cambiosDeFecha: number; cancelaciones: number; checkIns: number };
  webhooks: { entregasPendientes: number; entregasEntregadas: number; entregasMuertas: number };
}

export const DASHBOARD_REFRESH_MS = 60_000;

/** Dashboard of the window; refreshes every 60 s and never while the tab is hidden. */
export function useAdminDashboard(dias: DashboardDias, ownerId?: string) {
  return useQuery({
    queryKey: ['admin-dashboard', ownerId, dias],
    queryFn: () => apiClient<AdminDashboard>(`admin/dashboard${toQuery({ dias })}`),
    enabled: Boolean(ownerId),
    refetchInterval: DASHBOARD_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    retry: false,
  });
}

/** Refresh period of the live process counters. */
export const RUNTIME_REFRESH_MS = 3_000;

/** Live counters: polled every 3 s while the tab is visible; `paused` stops the automatic refresh. */
export function useAdminRuntime(ownerId?: string, options: { paused?: boolean } = {}) {
  return useQuery({
    queryKey: ['admin-runtime', ownerId],
    queryFn: () => apiClient<ObservabilidadRuntime>('admin/observabilidad/runtime'),
    enabled: Boolean(ownerId),
    refetchInterval: options.paused ? false : RUNTIME_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    staleTime: 0,
    retry: false,
  });
}

/** Loaded only when a flight is opened. */
export function useAdminAsientosVuelo(vueloId?: string, ownerId?: string) {
  return useQuery({
    queryKey: ['admin-asientos-vuelo', ownerId, vueloId],
    queryFn: () => apiClient<AdminAsientosVuelo>(`admin/vuelos/${vueloId}/asientos`),
    enabled: Boolean(vueloId && ownerId),
    retry: false,
  });
}

export function useAdminVuelos(filters: AdminFlightsFilters, ownerId?: string) {
  return useInfiniteQuery({
    queryKey: ['admin-vuelos', ownerId, filters],
    queryFn: ({ pageParam }) => apiClient<AdminVuelosPagina>(`admin/vuelos${toQuery({ ...filters, limit: 25, cursor: pageParam })}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(ownerId),
    retry: false,
  });
}
