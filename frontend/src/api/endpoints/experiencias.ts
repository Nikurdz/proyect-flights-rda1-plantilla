import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import { toQuery } from './admin';
import type { ExperienciaView, ExperienciasPagina, ReservarExperienciaInput, ReservaExternaView } from '../types';

export const EXPERIENCIAS_PAGE = 12;

/** GET /experiencias: public catalog of the synced providers that are switched on. */
export function useExperiencias(filtros: { q?: string; desde?: number; limite?: number }) {
  const params = { q: filtros.q || undefined, limite: filtros.limite ?? EXPERIENCIAS_PAGE, desde: filtros.desde ?? 0 };
  return useQuery({
    queryKey: ['experiencias', params],
    queryFn: () => apiClient<ExperienciasPagina>(`experiencias${toQuery(params)}`, { skipAuth: true }),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useExperiencia(id?: string) {
  return useQuery({
    queryKey: ['experiencia', id],
    queryFn: () => apiClient<ExperienciaView>(`experiencias/${id}`, { skipAuth: true }),
    enabled: Boolean(id),
    retry: false,
  });
}

/**
 * POST /experiencias/{id}/reservas. The caller owns the Idempotency-Key: the same key is reused only to retry
 * the SAME payment (so it can never charge twice), and a new one starts a different attempt.
 */
export async function reservarExperiencia(id: string, body: ReservarExperienciaInput, idempotencyKey: string): Promise<ReservaExternaView> {
  return apiClient<ReservaExternaView>(`experiencias/${id}/reservas`, { method: 'POST', body: JSON.stringify(body), idempotencyKey });
}

/** GET /reservas-externas: the signed-in person's bookings (a customer or the guest of this session). */
export function useMisReservasExternas(ownerId?: string) {
  return useQuery({
    queryKey: ['reservas-externas', ownerId],
    queryFn: () => apiClient<{ items: ReservaExternaView[] }>('reservas-externas'),
    enabled: Boolean(ownerId),
    retry: false,
  });
}

export function useCancelarReservaExterna() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo, idempotencyKey }: { id: string; motivo?: string; idempotencyKey: string }) =>
      apiClient<ReservaExternaView>(`reservas-externas/${id}/cancelar`, {
        method: 'POST',
        body: JSON.stringify(motivo ? { motivo } : {}),
        idempotencyKey,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservas-externas'] }),
  });
}
