import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { MercadoViewDto } from '../types';

export async function fetchMercado(codigo: string): Promise<MercadoViewDto> {
  return apiClient<MercadoViewDto>(`mercados/${codigo}`, { skipAuth: true });
}

export function useMercado(codigo: string = 'ec') {
  return useQuery({
    queryKey: ['mercado', codigo],
    queryFn: () => fetchMercado(codigo),
    staleTime: 1000 * 60 * 30, // 30 mins
  });
}
