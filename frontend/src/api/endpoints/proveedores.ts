import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ActualizarProveedorInput, ProveedorView, RegistrarProveedorInput, ReservaExternaView, SaludView, SincronizacionView } from '../types';
import { generateUUID } from '../../lib/uuid';

/** The traffic light is re-read this often while a page that shows it is open. */
export const PROVEEDORES_REFRESH_MS = 30_000;

const KEY = 'admin-proveedores';

/** GET /admin/proveedores: the fleet with its semaphore, circuit and synced products (ADMIN). */
export function useProveedores(ownerId?: string) {
  return useQuery({
    queryKey: [KEY, ownerId],
    queryFn: () => apiClient<ProveedorView[]>('admin/proveedores'),
    enabled: Boolean(ownerId),
    refetchInterval: PROVEEDORES_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    retry: false,
  });
}

/** GET /admin/proveedores/{id}/salud: checks of one provider, newest first. Loaded only when asked for. */
export function useSaludProveedor(id: string | undefined, ownerId?: string, options: { refetchMs?: number | false } = {}) {
  return useQuery({
    queryKey: [KEY, 'salud', ownerId, id],
    queryFn: () => apiClient<SaludView[]>(`admin/proveedores/${id}/salud`),
    enabled: Boolean(id && ownerId),
    refetchInterval: options.refetchMs ?? false,
    refetchIntervalInBackground: false,
    retry: false,
  });
}

/** GET /admin/proveedores/reservas/todas: experience bookings of every customer (ADMIN). */
export function useReservasExternasAdmin(ownerId?: string) {
  return useQuery({
    queryKey: [KEY, 'reservas', ownerId],
    queryFn: () => apiClient<{ items: ReservaExternaView[] }>('admin/proveedores/reservas/todas'),
    enabled: Boolean(ownerId),
    retry: false,
  });
}

function useRefreshProveedores() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

export function useRegistrarProveedor() {
  const refresh = useRefreshProveedores();
  return useMutation({
    mutationFn: (body: RegistrarProveedorInput) =>
      apiClient<ProveedorView>('admin/proveedores', { method: 'POST', body: JSON.stringify(body), idempotencyKey: generateUUID() }),
    onSuccess: refresh,
  });
}

/** PATCH: edit, or `activo: false` for the kill-switch. */
export function useActualizarProveedor() {
  const refresh = useRefreshProveedores();
  return useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: ActualizarProveedorInput }) =>
      apiClient<ProveedorView>(`admin/proveedores/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }),
    onSuccess: refresh,
  });
}

export function useEliminarProveedor() {
  const refresh = useRefreshProveedores();
  return useMutation({
    mutationFn: (id: string) => apiClient<unknown>(`admin/proveedores/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
}

/** POST .../ping: checks the provider now and stores the result. */
export function usePingProveedor() {
  const refresh = useRefreshProveedores();
  return useMutation({
    mutationFn: (id: string) => apiClient<SaludView>(`admin/proveedores/${id}/ping`, { method: 'POST' }),
    onSuccess: refresh,
  });
}

/** POST .../sincronizar: imports the partner's catalog into the local cache the customers see. */
export function useSincronizarProveedor() {
  const refresh = useRefreshProveedores();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient<SincronizacionView>(`admin/proveedores/${id}/sincronizar`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['experiencias'] });
      return refresh();
    },
  });
}
