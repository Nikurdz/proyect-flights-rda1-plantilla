import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { Schemas } from '../types';

export type AdminOrdenView = Schemas['AdminOrdenViewDto'];
export type AdminOrdenesPagina = Schemas['AdminOrdenesPaginaDto'];
export type AdminVueloView = Schemas['AdminVueloViewDto'];
export type AdminVuelosPagina = Schemas['AdminVuelosPaginaDto'];

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
