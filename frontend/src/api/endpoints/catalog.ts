import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { DisponibilidadViewDto, LocalidadViewDto, SearchParams, TarifasViewDto } from '../types';

export async function fetchLocalidades(q?: string): Promise<LocalidadViewDto[]> {
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  const qs = query.toString();
  return apiClient<LocalidadViewDto[]>(`localidades${qs ? `?${qs}` : ''}`);
}

export function useLocalidades(q?: string) {
  return useQuery({
    queryKey: ['localidades', q],
    queryFn: () => fetchLocalidades(q),
    staleTime: 1000 * 60 * 10, // 10 minutes cache
    enabled: q === undefined || q.length >= 1,
  });
}

export async function fetchDisponibilidad(params: SearchParams): Promise<DisponibilidadViewDto> {
  const query = new URLSearchParams();
  if (params.origin) query.set('origin', params.origin);
  if (params.destination) query.set('destination', params.destination);
  if (params.outbound) query.set('outbound', params.outbound);
  if (params.inbound) query.set('inbound', params.inbound);
  if (params.adt !== undefined) query.set('adt', String(params.adt));
  if (params.chd !== undefined) query.set('chd', String(params.chd));
  if (params.inf !== undefined) query.set('inf', String(params.inf));
  if (params.trip) query.set('trip', params.trip);
  if (params.sort) query.set('sort', params.sort);
  query.set('cabin', 'ECONOMY');

  return apiClient<DisponibilidadViewDto>(`disponibilidad?${query.toString()}`);
}

export function useDisponibilidad(params: SearchParams, enabled: boolean = true) {
  return useQuery({
    queryKey: ['disponibilidad', params],
    queryFn: () => fetchDisponibilidad(params),
    enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export async function fetchTarifas(
  itinerarioId: string,
  params: { adt?: number; chd?: number; inf?: number }
): Promise<TarifasViewDto> {
  const query = new URLSearchParams();
  if (params.adt !== undefined) query.set('adt', String(params.adt));
  if (params.chd !== undefined) query.set('chd', String(params.chd));
  if (params.inf !== undefined) query.set('inf', String(params.inf));

  return apiClient<TarifasViewDto>(`itinerarios/${itinerarioId}/tarifas?${query.toString()}`);
}

export function useTarifas(
  itinerarioId?: string,
  params: { adt?: number; chd?: number; inf?: number } = {}
) {
  return useQuery({
    queryKey: ['tarifas', itinerarioId, params],
    queryFn: () => fetchTarifas(itinerarioId!, params),
    enabled: Boolean(itinerarioId),
  });
}
