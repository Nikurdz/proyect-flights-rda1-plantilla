import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { apiBlob, apiClient, saveBlob } from '../client';
import { toQuery } from './admin';
import type { EstadoReserva } from './admin';
import { getTodayDateString } from '../../lib/dates';

/** Current month in Ecuador time: from the 1st to today. */
export function currentMonthRange(): { desde: string; hasta: string } {
  const today = getTodayDateString();
  return { desde: `${today.slice(0, 7)}-01`, hasta: today };
}


/** Filters of the reconciliation. `desde`/`hasta` are Ecuador calendar days (YYYY-MM-DD, inclusive). */
export interface ConciliacionFiltros {
  desde?: string;
  hasta?: string;
  partnerId?: string;
  estado?: EstadoReserva | '';
  soloAlertas?: boolean;
  pagina?: number;
  limite?: number;
}

export interface NotaCredito {
  numero: string;
  reembolso: string;
  penalidad: string;
}

/** One sale as an invoice line. Amounts are strings; the tax fields are null on old sales with no stored taxes. */
export interface ConciliacionItem {
  bookingId: string;
  pnr: string;
  fecha: string;
  partnerOrderId: string | null;
  paymentReference: string;
  estado: string;
  moneda: string;
  base: string | null;
  iva: string | null;
  ivaEsperado: string | null;
  ivaSegunBooking: string;
  diferenciaConBooking: string | null;
  ivaAlerta: boolean;
  total: string;
  notaCredito: NotaCredito | null;
  equipaje: string;
  cambiosFecha: { diferencias: string; cargo: string };
}

export interface ConciliacionPagina {
  items: ConciliacionItem[];
  total: number;
  pagina: number;
  limite: number;
}

export interface ConciliacionTotales {
  ventas: number;
  base: string;
  iva: string;
  total: string;
  cancelaciones: number;
  reembolsos: string;
  penalidades: string;
  equipaje: string;
  cambiosFecha: string;
  neto: string;
  alertasIva: number;
}

export interface ConciliacionResumen {
  periodo: { desde: string | null; hasta: string | null; zonaHoraria: string };
  moneda: string;
  total: ConciliacionTotales;
  dias: (ConciliacionTotales & { fecha: string })[];
  truncado: boolean;
}

const base = (f: ConciliacionFiltros) => ({
  desde: f.desde,
  hasta: f.hasta,
  partnerId: f.partnerId?.trim() || undefined,
  estado: f.estado || undefined,
  soloAlertas: f.soloAlertas ? 'true' : undefined,
});

/** GET /admin/facturacion-booking: the sales of the partner as invoice lines (ADMIN, read only). */
export function useConciliacionBooking(filtros: ConciliacionFiltros, ownerId?: string) {
  const params = { ...base(filtros), pagina: filtros.pagina ?? 1, limite: filtros.limite ?? 25 };
  return useQuery({
    queryKey: ['admin-facturacion-booking', ownerId, params],
    queryFn: () => apiClient<ConciliacionPagina>(`admin/facturacion-booking${toQuery(params)}`),
    enabled: Boolean(ownerId),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** GET /admin/facturacion-booking/resumen: totals of the period and of each day. */
export function useResumenConciliacionBooking(filtros: ConciliacionFiltros, ownerId?: string) {
  const params = base(filtros);
  return useQuery({
    queryKey: ['admin-facturacion-booking-resumen', ownerId, params],
    queryFn: () => apiClient<ConciliacionResumen>(`admin/facturacion-booking/resumen${toQuery(params)}`),
    enabled: Boolean(ownerId),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** GET /admin/facturacion-booking/export.csv with the list filters (no paging); saved as `facturacion-booking-AAAA-MM-DD.csv`. */
export function useExportarConciliacionCsv() {
  return useMutation({
    mutationFn: async (filtros: ConciliacionFiltros) => {
      const blob = await apiBlob(`admin/facturacion-booking/export.csv${toQuery(base(filtros))}`);
      const filename = `facturacion-booking-${new Date().toISOString().slice(0, 10)}.csv`;
      saveBlob(blob, filename);
      return filename;
    },
  });
}
