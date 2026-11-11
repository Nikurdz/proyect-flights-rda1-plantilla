import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { apiBlob, apiClient, saveBlob } from '../client';
import { toQuery } from './admin';

/** Types by hand: they mirror `ecommerce/admin/trazabilidad.*` (ADMIN, all times in UTC `…Z`). */

export type TrazaFuente = 'evento' | 'saga' | 'admin';
export type TrazaEstado = 'OK' | 'ERROR' | 'COMPENSADA' | 'EN_CURSO';
export type TrazaActorTipo = 'CUSTOMER' | 'GUEST' | 'PARTNER' | 'ADMIN' | 'SYSTEM' | 'ANONIMO';

export interface TrazaPaso {
  secuencia: number;
  nombre: string;
  estado: string;
  detalle: string | null;
  duracionMs: number | null;
  en: string | null;
}

export interface TrazaItem {
  fuente: TrazaFuente;
  id: string;
  en: string;
  correlationId: string | null;
  tipo: string;
  estado: TrazaEstado;
  actorId: string | null;
  actorTipo: TrazaActorTipo | null;
  entidad: string | null;
  referencia: string | null;
  numero: string | null;
  origen: string | null;
  destino: string | null;
  resumen: string | null;
  pasos?: TrazaPaso[];
}

export interface TrazaPagina {
  items: TrazaItem[];
  /** Cursor for «Cargar más» (`antes`); null when there is no more. */
  siguiente: string | null;
}

export interface TrazaFiltros {
  correlationId?: string;
  numero?: string;
  entidad?: string;
  id?: string;
  actor?: string;
  tipo?: string;
  fuente?: TrazaFuente | '';
  /** YYYY-MM-DD, Ecuador day, inclusive. */
  desde?: string;
  hasta?: string;
}

export const TRAZA_LIMITE = 50;
/** The flow is refreshed this often while its panel is open. */
export const TRAZA_REFRESH_MS = 10_000;

export interface TrazaNodo {
  id: string;
  etiqueta: string;
  tipo: string;
}

export interface TrazaArista {
  orden: number;
  desde: string;
  hasta: string;
  etiqueta: string;
  fuente: string;
  estado: string;
  ms: number | null;
  en: string | null;
  correlationId: string | null;
}

export interface TrazaFlujo {
  nodos: TrazaNodo[];
  aristas: TrazaArista[];
  correlaciones: string[];
  truncado: boolean;
}

export interface TrazaEnlace {
  desde: string;
  hasta: string;
  total: number;
  errores: number;
}

export interface TrazaMapa {
  nodos: TrazaNodo[];
  enlaces: TrazaEnlace[];
}

export interface TrazaFlujoParams {
  correlationId?: string;
  numero?: string;
}

export interface TrazaMapaParams {
  desde?: string;
  hasta?: string;
}

export function useTrazabilidad(filters: TrazaFiltros, ownerId?: string) {
  return useInfiniteQuery({
    queryKey: ['admin-trazabilidad', ownerId, filters],
    queryFn: ({ pageParam }) => apiClient<TrazaPagina>(`admin/trazabilidad${toQuery({ ...filters, antes: pageParam, limite: TRAZA_LIMITE })}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.siguiente ?? undefined,
    enabled: Boolean(ownerId),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** GET /admin/trazabilidad/flujo: by correlation id or by order number / PNR. Polls while `enabled` (panel open). */
export function useFlujoTraza(params: TrazaFlujoParams, ownerId?: string, enabled = true) {
  return useQuery({
    queryKey: ['admin-traza-flujo', ownerId, params],
    queryFn: () => apiClient<TrazaFlujo>(`admin/trazabilidad/flujo${toQuery({ ...params })}`),
    enabled: Boolean(ownerId) && enabled && Boolean(params.correlationId || params.numero),
    refetchInterval: TRAZA_REFRESH_MS,
    refetchIntervalInBackground: false,
    retry: false,
  });
}

/** GET /admin/trazabilidad/mapa: every link between components in the period. Polls while `enabled`. */
export function useMapaTraza(params: TrazaMapaParams, ownerId?: string, enabled = true) {
  return useQuery({
    queryKey: ['admin-traza-mapa', ownerId, params],
    queryFn: () => apiClient<TrazaMapa>(`admin/trazabilidad/mapa${toQuery({ ...params })}`),
    enabled: Boolean(ownerId) && enabled,
    refetchInterval: TRAZA_REFRESH_MS,
    refetchIntervalInBackground: false,
    retry: false,
  });
}

/** GET /admin/trazabilidad/export.csv with the list filters; saved as `trazabilidad-AAAA-MM-DD.csv`. */
export function useExportarTrazaCsv() {
  return useMutation({
    mutationFn: async (filters: TrazaFiltros) => {
      const blob = await apiBlob(`admin/trazabilidad/export.csv${toQuery({ ...filters })}`);
      const filename = `trazabilidad-${new Date().toISOString().slice(0, 10)}.csv`;
      saveBlob(blob, filename);
      return filename;
    },
  });
}
