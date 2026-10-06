import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { OrdenViewDto, OrdenesPaginaViewDto } from '../types';

export async function recuperarOrden(params: { numero?: string; pnr?: string; apellido: string }): Promise<OrdenViewDto> {
  const query = new URLSearchParams();
  if (params.numero) query.set('numero', params.numero);
  if (params.pnr) query.set('pnr', params.pnr);
  query.set('apellido', params.apellido);

  return apiClient<OrdenViewDto>(`ordenes?${query.toString()}`, { skipAuth: true });
}

export async function obtenerOrdenPropia(numero: string): Promise<OrdenViewDto> {
  return apiClient<OrdenViewDto>(`ordenes/${numero}`);
}

export async function obtenerHistorialOrdenes(params: { limit?: number; cursor?: string } = {}): Promise<OrdenesPaginaViewDto> {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  if (params.cursor) query.set('cursor', params.cursor);
  const qs = query.toString();

  return apiClient<OrdenesPaginaViewDto>(`clientes/me/ordenes${qs ? `?${qs}` : ''}`);
}

export function useOrdenPropia(numero?: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['orden', numero],
    queryFn: () => obtenerOrdenPropia(numero!),
    enabled: Boolean(numero) && enabled,
    retry: false,
  });
}

/** The customer's own trips, newest first; each "load more" appends the next page. */
export function useHistorialOrdenes(ownerId?: string) {
  return useInfiniteQuery({
    queryKey: ['mis-ordenes', ownerId],
    queryFn: ({ pageParam }) => obtenerHistorialOrdenes({ cursor: pageParam, limit: 10 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(ownerId),
  });
}

/** Adds a trip bought as a guest to the signed-in account (same proof as the public recovery). */
export async function vincularOrden(params: { numero?: string; pnr?: string; apellido: string }): Promise<OrdenViewDto> {
  return apiClient<OrdenViewDto>('clientes/me/ordenes', { method: 'POST', body: JSON.stringify(params) });
}
