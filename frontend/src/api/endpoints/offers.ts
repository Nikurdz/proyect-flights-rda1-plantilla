import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type {
  AceptarCondicionesDto,
  AceptarPrecioDto,
  ArmarOfertaDto,
  CompraDto,
  FacturacionDto,
  MapaAsientosViewDto,
  MedioPagoViewDto,
  OfertaViewDto,
  OrdenViewDto,
  RegistrarPasajerosDto,
  RevalidacionViewDto,
} from '../types';

export async function armarOferta(dto: ArmarOfertaDto, idempotencyKey: string): Promise<OfertaViewDto> {
  return apiClient<OfertaViewDto>('ofertas', {
    method: 'POST',
    body: JSON.stringify(dto),
    idempotencyKey,
  });
}

export async function obtenerOferta(id: string): Promise<OfertaViewDto> {
  return apiClient<OfertaViewDto>(`ofertas/${id}`);
}

export async function cancelarOferta(id: string): Promise<void> {
  return apiClient<void>(`ofertas/${id}`, { method: 'DELETE' });
}

export async function revalidarOferta(id: string): Promise<RevalidacionViewDto> {
  return apiClient<RevalidacionViewDto>(`ofertas/${id}/revalidacion`, { method: 'POST' });
}

export async function aceptarPrecio(id: string, dto: AceptarPrecioDto): Promise<OfertaViewDto> {
  return apiClient<OfertaViewDto>(`ofertas/${id}/aceptacion-precio`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function registrarPasajeros(id: string, dto: RegistrarPasajerosDto): Promise<OfertaViewDto> {
  return apiClient<OfertaViewDto>(`ofertas/${id}/pasajeros`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export async function obtenerMapaAsientos(id: string, trayectoId: string): Promise<MapaAsientosViewDto> {
  return apiClient<MapaAsientosViewDto>(`ofertas/${id}/asientos?trayectoId=${encodeURIComponent(trayectoId)}`);
}

export async function registrarFacturacion(id: string, dto: FacturacionDto): Promise<OfertaViewDto> {
  return apiClient<OfertaViewDto>(`ofertas/${id}/facturacion`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export async function aceptarCondiciones(id: string, dto: AceptarCondicionesDto): Promise<OfertaViewDto> {
  return apiClient<OfertaViewDto>(`ofertas/${id}/condiciones`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function obtenerMediosPago(id: string): Promise<MedioPagoViewDto[]> {
  return apiClient<MedioPagoViewDto[]>(`ofertas/${id}/medios-pago`);
}

export async function comprarOferta(id: string, dto: CompraDto, idempotencyKey: string): Promise<OrdenViewDto> {
  return apiClient<OrdenViewDto>(`ofertas/${id}/compra`, {
    method: 'POST',
    body: JSON.stringify(dto),
    idempotencyKey,
  });
}

export function useOferta(id?: string) {
  return useQuery({
    queryKey: ['oferta', id],
    queryFn: () => obtenerOferta(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      // Don't refetch if offer expired or finalized
      const state = query.state.data?.estado;
      if (state === 'VENCIDA' || state === 'PAGADA' || state === 'CANCELADA') return false;
      return 15000; // Poll every 15s to keep countdown aligned
    },
  });
}

/** The seat map of one leg. Kept fresh-ish: another traveller may take a seat while this one chooses. */
export function useMapaAsientos(id?: string, trayectoId?: string) {
  return useQuery({
    queryKey: ['asientos', id, trayectoId],
    queryFn: () => obtenerMapaAsientos(id!, trayectoId!),
    enabled: Boolean(id && trayectoId),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
}

export function useMediosPago(id?: string) {
  return useQuery({
    queryKey: ['medios-pago', id],
    queryFn: () => obtenerMediosPago(id!),
    enabled: Boolean(id),
  });
}
