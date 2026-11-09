import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiBlob, apiClient, saveBlob } from '../client';
import { generateUUID } from '../../lib/uuid';
import type { Schemas } from '../types';

export type AdminOrdenView = Schemas['AdminOrdenViewDto'];
export type AdminOrdenesPagina = Schemas['AdminOrdenesPaginaDto'];
export type AdminVueloView = Schemas['AdminVueloViewDto'];
export type AdminVuelosPagina = Schemas['AdminVuelosPaginaDto'];

/** GET /admin/vuelos/{id}/asientos: the cabin and every reserved seat with its locator (no passenger names). */
export interface AdminAsientosVuelo {
  vueloId: string;
  codigoVuelo: string;
  origen: string;
  destino: string;
  salida: string;
  capacidadTotal: number;
  reservados: { asiento: string; pnr: string; numeroOrden: string | null }[];
  filas: { rowNumber: number; seats: { seatNumber: string; isAvailable: boolean; characteristics: string[] }[] }[];
}

export type VentanaObservabilidad = '24h' | '7d';

type Counts = Record<string, number>;

/** GET /admin/observabilidad/resumen: aggregates computed from the database (no personal data). */
export interface ObservabilidadResumen {
  ventana: VentanaObservabilidad;
  generadoEn: string;
  desde: string;
  ordenes: { total: number; porEstado: Counts };
  ingresos: { moneda: string; monto: string; ordenes: number }[];
  pagos: { total: number; porEstado: Counts };
  tasas: { rechazoDePago: number | null; antifraude: number | null; compensacion: number | null; notificacionesFallidas: number | null };
  pendientes: { capturaPendiente: number; anulacionPendiente: number; autorizadoSinCaptura: number; emitidasSinConfirmacion: number };
  ofertas: { total: number; porEstado: Counts };
  notificaciones: { total: number; porEstado: Counts };
  holds: { total: number; porEstado: Counts; vencidosSinLiberar: number };
  inventario: { vuelosFuturos: number; asientosLibres: number; capacidad: number; ocupacion: number | null };
  idempotencia: { enCurso: number; respuestasConError5xx: number };
  auditoriaReciente: { id: string; entidad: string; entidadId: string; accion: string; creadoEn: string }[];
}

/** GET /admin/observabilidad/runtime: counters of the running process (reset on every restart). */
export interface ObservabilidadRuntime {
  startedAt: string;
  uptimeSeconds: number;
  requests: { total: number; clientErrors: number; serverErrors: number };
  rateLimited: number;
  routes: { route: string; count: number; clientErrors: number; serverErrors: number; avgMs: number; maxMs: number }[];
  problemCodes: Counts;
  events: Counts;
  consumerFailures: Counts;
  jobs: Record<string, { runs: number; failures: number; lastRunAt: string | null; lastDurationMs: number | null; lastResult: Counts | null; lastError: string | null }>;
  /** What each integration reports about itself (process-local, absent until the integration starts). */
  integrations?: IntegracionesRuntime;
}

/** `integrations['booking-stock']`: the stock push to Booking (HTTP or gRPC). */
export interface IntegracionStockBooking {
  modo: 'HTTP' | 'GRPC' | 'OFF';
  destino?: string;
  serviceId?: string;
  horizonteDias?: number;
  ultimaRonda?: { en: string; enviados: number; rechazados: number; fallidos: number; sinIntentar: number; total: number };
  ultimoRechazo?: { en: string; detalle: string };
  ultimoError?: { en: string; mensaje: string };
  vuelosEnviadosAlgunaVez?: number;
  vuelosEnEspera?: number;
  contadores?: Counts;
  updatedAt: string;
}

/** `integrations['booking-webhook']`: the webhook subscription registered for Booking at boot. */
export interface IntegracionWebhookBooking {
  estado: 'SUSCRITO' | 'SIN_CONFIGURAR' | 'ERROR';
  owner?: string;
  destino?: string;
  suscripcionId?: string;
  detalle?: string;
  updatedAt: string;
}

export interface IntegracionesRuntime {
  'booking-stock'?: IntegracionStockBooking;
  'booking-webhook'?: IntegracionWebhookBooking;
  [name: string]: unknown;
}

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

export function toQuery(params: Record<string, string | number | undefined>): string {
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

/** Database-backed summary; refreshes by itself so the page can stay open on a screen. */
export function useAdminObservabilidad(ventana: VentanaObservabilidad, ownerId?: string) {
  return useQuery({
    queryKey: ['admin-observabilidad', ownerId, ventana],
    queryFn: () => apiClient<ObservabilidadResumen>(`admin/observabilidad/resumen${toQuery({ ventana })}`),
    enabled: Boolean(ownerId),
    refetchInterval: 30_000,
    refetchOnWindowFocus: 'always',
    retry: false,
  });
}

export type DashboardDias = 7 | 30 | 90;

/** GET /admin/dashboard: business metrics of the window. `*Minor` fields are integer cents. */
export interface AdminDashboard {
  dias: number;
  moneda: string;
  generadoEn: string;
  desde: string;
  hasta: string;
  kpis: {
    ingresosMinor: number;
    ordenesEmitidas: number;
    ticketPromedioMinor: number;
    pasajeros: number;
    conversion: number | null;
    tasaCancelacion: number | null;
    reembolsosMinor: number;
    ocupacionFutura: number | null;
    vuelosAgotados: number;
    rechazoDePago: number | null;
  };
  serie: { fecha: string; ordenes: number; emitidas: number; ingresosMinor: number; ofertas: number; cancelaciones: number }[];
  embudo: { etapa: string; valor: number }[];
  ordenesPorEstado: Counts;
  pagosPorEstado: Counts;
  ofertasPorEstado: Counts;
  notificacionesPorEstado: Counts;
  pasajerosPorTipo: Counts;
  topRutas: { ruta: string; reservas: number; canceladas: number; ingresos: number }[];
  ocupacionPorRuta: { ruta: string; vuelos: number; capacidad: number; libres: number; agotados: number; ocupacion: number }[];
  posventa: { maletasExtra: number; ingresosEquipajeMinor: number; cambiosDeFecha: number; cancelaciones: number; checkIns: number };
  webhooks: { entregasPendientes: number; entregasEntregadas: number; entregasMuertas: number };
}

export const DASHBOARD_REFRESH_MS = 60_000;

/** Dashboard of the window; refreshes every 60 s and never while the tab is hidden. */
export function useAdminDashboard(dias: DashboardDias, ownerId?: string) {
  return useQuery({
    queryKey: ['admin-dashboard', ownerId, dias],
    queryFn: () => apiClient<AdminDashboard>(`admin/dashboard${toQuery({ dias })}`),
    enabled: Boolean(ownerId),
    refetchInterval: DASHBOARD_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    retry: false,
  });
}

/** Refresh period of the live process counters. */
export const RUNTIME_REFRESH_MS = 3_000;

/** Live counters: polled every 3 s while the tab is visible; `paused` stops the automatic refresh. */
export function useAdminRuntime(ownerId?: string, options: { paused?: boolean } = {}) {
  return useQuery({
    queryKey: ['admin-runtime', ownerId],
    queryFn: () => apiClient<ObservabilidadRuntime>('admin/observabilidad/runtime'),
    enabled: Boolean(ownerId),
    refetchInterval: options.paused ? false : RUNTIME_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    staleTime: 0,
    retry: false,
  });
}

/** Loaded only when a flight is opened. */
export function useAdminAsientosVuelo(vueloId?: string, ownerId?: string) {
  return useQuery({
    queryKey: ['admin-asientos-vuelo', ownerId, vueloId],
    queryFn: () => apiClient<AdminAsientosVuelo>(`admin/vuelos/${vueloId}/asientos`),
    enabled: Boolean(vueloId && ownerId),
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

// ---------------------------------------------------------------------------------------------
// Users (ADMIN). Types are declared by hand: they mirror `usuarios.controller.ts`.
// ---------------------------------------------------------------------------------------------

export type RolUsuario = 'ADMIN' | 'CUSTOMER';

export interface AdminUsuario {
  clienteId: string;
  correo: string;
  nombres: string;
  apellidos: string;
  roles: string[];
  correoVerificado: boolean;
  bloqueada: boolean;
  creadoEn: string;
}

export interface AdminUsuariosPagina {
  items: AdminUsuario[];
  total: number;
  pagina: number;
  limite: number;
}

export interface AdminUsuariosFilters {
  q?: string;
  rol?: RolUsuario | '';
  pagina?: number;
  limite?: number;
}

export interface CrearUsuarioInput {
  correo: string;
  contrasena: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  telefono?: string;
  roles?: RolUsuario[];
}

export function esAdministrador(usuario: Pick<AdminUsuario, 'roles'>): boolean {
  return usuario.roles.includes('ADMIN');
}

export function useAdminUsuarios(filters: AdminUsuariosFilters, ownerId?: string) {
  const params = { ...filters, limite: filters.limite ?? 25, pagina: filters.pagina ?? 1 };
  return useQuery({
    queryKey: ['admin-usuarios', ownerId, params],
    queryFn: () => apiClient<AdminUsuariosPagina>(`admin/usuarios${toQuery(params)}`),
    enabled: Boolean(ownerId),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useCrearUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CrearUsuarioInput) =>
      apiClient<AdminUsuario>('admin/usuarios', { method: 'POST', body: JSON.stringify(body), idempotencyKey: generateUUID() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-usuarios'] }),
  });
}

/** PUT /admin/usuarios/{id}/roles. The new roles apply the next time that person signs in. */
export function useCambiarRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clienteId, roles }: { clienteId: string; roles: RolUsuario[] }) =>
      apiClient<AdminUsuario>(`admin/usuarios/${clienteId}/roles`, { method: 'PUT', body: JSON.stringify({ roles }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-usuarios'] }),
  });
}

// ---------------------------------------------------------------------------------------------
// Flight management (ADMIN).
// ---------------------------------------------------------------------------------------------

export interface CrearVueloInput {
  codigoVuelo: string;
  aerolinea: string;
  origen: string;
  destino: string;
  salida: string;
  duracionMinutos: number;
  precioBaseUsd: number;
  capacidad?: number;
}

export interface EditarVueloInput {
  aerolinea?: string;
  precioBaseUsd?: number;
  duracionMinutos?: number;
  capacidadTotal?: number;
}

export interface AdminAccionVuelo {
  vueloId: string;
  codigoVuelo: string;
  estado: 'SCHEDULED' | 'CANCELLED';
  salida: string;
  reservasAfectadas: number;
  eventos: string[];
}

function useRefreshVuelos() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['admin-vuelos'] }),
      qc.invalidateQueries({ queryKey: ['admin-asientos-vuelo'] }),
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] }),
    ]);
}

export function useCrearVuelo() {
  const refresh = useRefreshVuelos();
  return useMutation({
    mutationFn: (body: CrearVueloInput) =>
      apiClient<AdminVueloView>('admin/vuelos', { method: 'POST', body: JSON.stringify(body), idempotencyKey: generateUUID() }),
    onSuccess: refresh,
  });
}

export function useEditarVuelo() {
  const refresh = useRefreshVuelos();
  return useMutation({
    mutationFn: ({ vueloId, cambios }: { vueloId: string; cambios: EditarVueloInput }) =>
      apiClient<AdminVueloView>(`admin/vuelos/${vueloId}`, { method: 'PATCH', body: JSON.stringify(cambios) }),
    onSuccess: refresh,
  });
}

export function useEliminarVuelo() {
  const refresh = useRefreshVuelos();
  return useMutation({
    mutationFn: (vueloId: string) => apiClient<unknown>(`admin/vuelos/${vueloId}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
}

export function useCancelarVuelo() {
  const refresh = useRefreshVuelos();
  return useMutation({
    mutationFn: ({ vueloId, motivo }: { vueloId: string; motivo?: string }) =>
      apiClient<AdminAccionVuelo>(`admin/vuelos/${vueloId}/cancelar`, { method: 'POST', body: JSON.stringify(motivo ? { motivo } : {}) }),
    onSuccess: refresh,
  });
}

export function useReprogramarVuelo() {
  const refresh = useRefreshVuelos();
  return useMutation({
    mutationFn: ({ vueloId, nuevaSalida, motivo }: { vueloId: string; nuevaSalida: string; motivo?: string }) =>
      apiClient<AdminAccionVuelo>(`admin/vuelos/${vueloId}/reprogramar`, {
        method: 'POST',
        body: JSON.stringify(motivo ? { nuevaSalida, motivo } : { nuevaSalida }),
      }),
    onSuccess: refresh,
  });
}

// ---------------------------------------------------------------------------------------------
// Counter (mostrador): bookings of every channel and the operational status of a flight (ADMIN).
// The 200 answers have no schema in the contract: these types mirror `reservas-admin.service.ts`.
// ---------------------------------------------------------------------------------------------

export type CanalReserva = 'SOCIO' | 'DIRECTO';
export type TipoDocumento = 'NATIONAL_ID' | 'PASSPORT';

export interface ReservaVuelo {
  vueloId: string;
  codigoVuelo: string;
  origen: string;
  destino: string;
  salida: string;
  estado: string;
}

export interface ReservaPasajero {
  passengerId: string;
  travellerId: string;
  nombre: string;
  tipoDocumento: string;
  /** Already masked by the API (only the last 3 characters). */
  documento: string;
  asientos: { vueloId: string; asiento: string }[];
  checkIn: boolean;
}

export interface AdminReserva {
  bookingId: string;
  pnr: string;
  status: string;
  canal: CanalReserva;
  socio: { partnerId: string; partnerOrderId: string | null } | null;
  paymentReference: string;
  paymentProvider: string | null;
  total: { currency: string; total: string };
  /** Breakdown of what was charged plus what a cancellation gave back (amounts as strings; null when unknown). */
  importes?: ReservaImportes;
  creadaEn: string;
  vuelos: ReservaVuelo[];
  pasajeros: ReservaPasajero[];
  billetes: number;
}

export interface ReservaImportes {
  moneda: string;
  base: string | null;
  impuestos: string | null;
  total: string;
  reembolso: string | null;
  penalidad: string | null;
}

export interface AdminReservaDetalle extends AdminReserva {
  cambios: { en: string; descripcion: string }[];
}

export interface AdminReservasPagina {
  items: AdminReserva[];
  total: number;
  pagina: number;
  limite: number;
}

export interface AdminReservasFilters {
  pnr?: string;
  partnerOrderId?: string;
  paymentReference?: string;
  canal?: CanalReserva | '';
  documento?: string;
  tipoDocumento?: TipoDocumento;
  nacionalidad?: string;
  estado?: EstadoReserva | '';
  /** YYYY-MM-DD (UTC day, inclusive). */
  desde?: string;
  /** YYYY-MM-DD (covers the whole UTC day). */
  hasta?: string;
  pagina?: number;
  limite?: number;
}

/** `BookingStatus` of the backend (`entities/booking.entity.ts`). */
export const ESTADOS_RESERVA = ['PENDING', 'PENDING_PAYMENT', 'TICKET_ISSUING', 'CONFIRMED', 'FAILED', 'CHANGE_PENDING', 'CANCELLATION_PENDING', 'CANCELLED'] as const;
export type EstadoReserva = (typeof ESTADOS_RESERVA)[number];

/** GET /admin/reservas/export.csv with the list filters (no paging); saved as `reservas-AAAA-MM-DD.csv`. */
export function useExportarReservasCsv() {
  return useMutation({
    mutationFn: async (filters: AdminReservasFilters) => {
      // The export takes the list filters but no paging (it returns up to 5000 rows).
      const blob = await apiBlob(`admin/reservas/export.csv${toQuery({ ...filters, pagina: undefined, limite: undefined })}`);
      const filename = `reservas-${new Date().toISOString().slice(0, 10)}.csv`;
      saveBlob(blob, filename);
      return filename;
    },
  });
}

export interface CotizacionCancelacion {
  quoteId: string;
  isRefundable: boolean;
  refundAmount: string;
  penaltyAmount: string;
  currency: string;
  expiresAt: string;
}

export interface CancelacionResultado {
  bookingId: string;
  status: string;
  refundAmount: string;
  penaltyAmount: string;
  currency: string;
}

export interface CheckInResultado {
  bookingId: string;
  status: string;
  checkedInPassengers: unknown[];
}

export function useAdminReservas(filters: AdminReservasFilters, ownerId?: string) {
  const params = { ...filters, limite: filters.limite ?? 20, pagina: filters.pagina ?? 1 };
  return useQuery({
    queryKey: ['admin-reservas', ownerId, params],
    queryFn: () => apiClient<AdminReservasPagina>(`admin/reservas${toQuery(params)}`),
    enabled: Boolean(ownerId),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useAdminReserva(bookingId?: string, ownerId?: string) {
  return useQuery({
    queryKey: ['admin-reserva', ownerId, bookingId],
    queryFn: () => apiClient<AdminReservaDetalle>(`admin/reservas/${bookingId}`),
    enabled: Boolean(bookingId && ownerId),
    retry: false,
  });
}

function useRefreshReservas() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['admin-reservas'] }),
      qc.invalidateQueries({ queryKey: ['admin-reserva'] }),
      qc.invalidateQueries({ queryKey: ['admin-ordenes'] }),
    ]);
}

export function useCheckInMostrador() {
  const refresh = useRefreshReservas();
  return useMutation({
    mutationFn: (bookingId: string) => apiClient<CheckInResultado>(`admin/reservas/${bookingId}/check-in`, { method: 'POST' }),
    onSuccess: refresh,
  });
}

/** A read, but triggered on demand by the operator: modelled as a mutation so it never runs by itself. */
export function useCotizarCancelacion() {
  return useMutation({
    mutationFn: (bookingId: string) => apiClient<CotizacionCancelacion>(`admin/reservas/${bookingId}/cotizacion-cancelacion`),
  });
}

export function useCancelarReserva() {
  const refresh = useRefreshReservas();
  return useMutation({
    mutationFn: ({ bookingId, quoteId, reasonCode = 'CUSTOMER_REQUEST' }: { bookingId: string; quoteId?: string; reasonCode?: string }) =>
      apiClient<CancelacionResultado>(`admin/reservas/${bookingId}/cancelar`, {
        method: 'POST',
        body: JSON.stringify({ ...(quoteId ? { quoteId } : {}), reasonCode }),
        // A new key per attempt: a retry after an error is a new decision of the operator.
        idempotencyKey: generateUUID(),
      }),
    onSuccess: refresh,
  });
}

export const ESTADOS_VUELO = ['SCHEDULED', 'BOARDING', 'DEPARTED', 'DELAYED', 'ARRIVED', 'CANCELLED', 'DIVERTED'] as const;
export type EstadoVuelo = (typeof ESTADOS_VUELO)[number];

export interface CambiarEstadoVueloInput {
  status: EstadoVuelo;
  estimatedDepartureAt?: string;
  estimatedArrivalAt?: string;
  departureGate?: string;
  reason?: string;
}

export interface CambioEstadoVueloResultado {
  previousStatus: string;
  affectedBookings: number;
  eventId: string;
  flight: unknown;
}

export function useCambiarEstadoVuelo() {
  const refresh = useRefreshVuelos();
  return useMutation({
    mutationFn: ({ vueloId, cambio }: { vueloId: string; cambio: CambiarEstadoVueloInput }) =>
      apiClient<CambioEstadoVueloResultado>(`admin/vuelos/${vueloId}/estado`, { method: 'PATCH', body: JSON.stringify(cambio) }),
    onSuccess: refresh,
  });
}

// ---------------------------------------------------------------------------------------------
// Webhooks (ADMIN): subscriptions of every owner and every delivery. Types mirror `webhooks-admin.service.ts`.
// ---------------------------------------------------------------------------------------------

export const ESTADOS_ENTREGA = ['PENDING', 'DELIVERED', 'DEAD'] as const;
export type EstadoEntrega = (typeof ESTADOS_ENTREGA)[number];

export interface WebhookSuscripcion {
  suscripcionId: string;
  owner: string;
  url: string;
  eventos: string[];
  activa: boolean;
  apiVersion: number;
  creadaEn: string | null;
  entregas: { pendientes: number; entregadas: number; muertas: number };
}

export interface WebhookEntrega {
  deliveryId: string;
  suscripcionId: string;
  owner: string | null;
  url: string | null;
  eventId: string;
  tipo: string;
  estado: EstadoEntrega;
  intentos: number;
  proximoIntento: string | null;
  ultimoCodigo: number | null;
  ultimoError: string | null;
  creadaEn: string | null;
  entregadaEn: string | null;
  bookingId: string | null;
  pnr: string | null;
  partnerOrderId: string | null;
}

export interface WebhookEntregasPagina {
  items: WebhookEntrega[];
  total: number;
  pagina: number;
  limite: number;
}

export interface WebhookEntregasFilters {
  estado?: EstadoEntrega | '';
  tipo?: string;
  owner?: string;
  suscripcionId?: string;
  pagina?: number;
  limite?: number;
}

export interface ReintentoEntrega {
  deliveryId: string;
  estado: 'PENDING';
  mensaje: string;
}

/** The dispatcher sends every 15 s: the console refreshes at the same pace. */
export const WEBHOOKS_REFRESH_MS = 15_000;

export function useAdminWebhookSuscripciones(ownerId?: string) {
  return useQuery({
    queryKey: ['admin-webhook-suscripciones', ownerId],
    queryFn: () => apiClient<{ items: WebhookSuscripcion[] }>('admin/webhooks/suscripciones'),
    enabled: Boolean(ownerId),
    refetchInterval: WEBHOOKS_REFRESH_MS,
    refetchIntervalInBackground: false,
    retry: false,
  });
}

export function useAdminWebhookEntregas(filters: WebhookEntregasFilters, ownerId?: string) {
  const params = { ...filters, limite: filters.limite ?? 20, pagina: filters.pagina ?? 1 };
  return useQuery({
    queryKey: ['admin-webhook-entregas', ownerId, params],
    queryFn: () => apiClient<WebhookEntregasPagina>(`admin/webhooks/entregas${toQuery(params)}`),
    enabled: Boolean(ownerId),
    placeholderData: keepPreviousData,
    refetchInterval: WEBHOOKS_REFRESH_MS,
    refetchIntervalInBackground: false,
    retry: false,
  });
}

/** POST /admin/webhooks/entregas/{id}/reintentar: puts a DEAD or PENDING delivery back in the queue (409 if delivered). */
export function useReintentarEntrega() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deliveryId: string) => apiClient<ReintentoEntrega>(`admin/webhooks/entregas/${deliveryId}/reintentar`, { method: 'POST' }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-webhook-entregas'] }),
        qc.invalidateQueries({ queryKey: ['admin-webhook-suscripciones'] }),
        qc.invalidateQueries({ queryKey: ['admin-dashboard'] }),
      ]),
  });
}
