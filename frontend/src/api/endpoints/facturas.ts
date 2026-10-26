import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import { toQuery } from './admin';
import type { EstadoFactura, FacturaAdmin, FacturasPaginaAdmin, OrigenFactura } from '../types';

export interface FacturasFiltros {
  estado?: EstadoFactura | '';
  origen?: OrigenFactura | '';
  limite?: number;
}

/** GET /admin/facturas: newest first, with the total of the issued ones (ADMIN). */
export function useAdminFacturas(filtros: FacturasFiltros, ownerId?: string) {
  const params = { estado: filtros.estado || undefined, origen: filtros.origen || undefined, limite: filtros.limite ?? 50 };
  return useQuery({
    queryKey: ['admin-facturas', ownerId, params],
    queryFn: () => apiClient<FacturasPaginaAdmin>(`admin/facturas${toQuery(params)}`),
    enabled: Boolean(ownerId),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** GET /admin/facturas/{numero}: one invoice with its lines. Loaded only when opened. */
export function useAdminFactura(numero: string | undefined, ownerId?: string) {
  return useQuery({
    queryKey: ['admin-factura', ownerId, numero],
    queryFn: () => apiClient<FacturaAdmin>(`admin/facturas/${numero}`),
    enabled: Boolean(numero && ownerId),
    retry: false,
  });
}
