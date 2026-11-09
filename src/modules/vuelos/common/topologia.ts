/**
 * Map of the components that talk to each other, used by the traceability flow (nodes and arrows). It is the single place
 * where an event type, a saga step or an outgoing call is tied to "who sends it and who receives it": the flow is drawn
 * from what was really recorded, so nothing is drawn by hand. A test fails when an event type or a saga step exists
 * without an entry here, which is what keeps the diagram up to date with every change.
 */
export type ComponenteId =
  | 'web'
  | 'admin'
  | 'booking'
  | 'api'
  | 'identidad'
  | 'catalogo'
  | 'inventario'
  | 'ordenes'
  | 'pagos'
  | 'facturacion'
  | 'notificaciones'
  | 'webhooks'
  | 'auditoria';

export interface Componente {
  id: ComponenteId;
  etiqueta: string;
  /** Where the node sits in the diagram: clients on the left, the platform in the middle, outside partners on the right. */
  tipo: 'cliente' | 'servicio' | 'externo';
}

export const COMPONENTES: readonly Componente[] = [
  { id: 'web', etiqueta: 'Cliente web', tipo: 'cliente' },
  { id: 'admin', etiqueta: 'Consola admin', tipo: 'cliente' },
  { id: 'booking', etiqueta: 'Booking (socio)', tipo: 'externo' },
  { id: 'api', etiqueta: 'API Vuelos', tipo: 'servicio' },
  { id: 'identidad', etiqueta: 'Identidad', tipo: 'servicio' },
  { id: 'catalogo', etiqueta: 'Catálogo y ofertas', tipo: 'servicio' },
  { id: 'inventario', etiqueta: 'Inventario', tipo: 'servicio' },
  { id: 'ordenes', etiqueta: 'Órdenes (saga)', tipo: 'servicio' },
  { id: 'pagos', etiqueta: 'Pagos', tipo: 'servicio' },
  { id: 'facturacion', etiqueta: 'Facturación', tipo: 'servicio' },
  { id: 'notificaciones', etiqueta: 'Notificaciones', tipo: 'servicio' },
  { id: 'webhooks', etiqueta: 'Webhooks', tipo: 'servicio' },
  { id: 'auditoria', etiqueta: 'Auditoría', tipo: 'servicio' },
];

export interface Enlace {
  origen: ComponenteId;
  destino: ComponenteId;
}

/** Domain events: who announces it and who mainly reacts to it. */
export const EVENTOS: Readonly<Record<string, Enlace>> = {
  ClienteRegistrado: { origen: 'identidad', destino: 'notificaciones' },
  ConsentimientoActualizado: { origen: 'identidad', destino: 'auditoria' },
  CuentaBloqueada: { origen: 'identidad', destino: 'notificaciones' },
  ConfiguracionMercadoPublicada: { origen: 'admin', destino: 'catalogo' },
  OfertaCreada: { origen: 'catalogo', destino: 'inventario' },
  OfertaVencida: { origen: 'catalogo', destino: 'inventario' },
  OrdenEmitida: { origen: 'ordenes', destino: 'notificaciones' },
  OrdenFallidaCompensada: { origen: 'ordenes', destino: 'notificaciones' },
  PagoAutorizado: { origen: 'pagos', destino: 'ordenes' },
  PagoRechazado: { origen: 'pagos', destino: 'ordenes' },
  PagoAnulado: { origen: 'pagos', destino: 'ordenes' },
  PagoReembolsado: { origen: 'pagos', destino: 'ordenes' },
  'hold.created': { origen: 'catalogo', destino: 'inventario' },
  'hold.expired': { origen: 'inventario', destino: 'catalogo' },
  'hold.released': { origen: 'inventario', destino: 'catalogo' },
  'booking.confirmed': { origen: 'api', destino: 'webhooks' },
  'booking.failed': { origen: 'api', destino: 'webhooks' },
  'booking.ticket_issuing': { origen: 'api', destino: 'webhooks' },
  'booking.ticket_issued': { origen: 'api', destino: 'webhooks' },
  'booking.ticket_failed': { origen: 'api', destino: 'webhooks' },
  'booking.checked_in': { origen: 'api', destino: 'webhooks' },
  'booking.seat_changed': { origen: 'api', destino: 'webhooks' },
  'booking.baggage_added': { origen: 'api', destino: 'webhooks' },
  'booking.changed': { origen: 'api', destino: 'ordenes' },
  'booking.cancelled': { origen: 'api', destino: 'pagos' },
  'flight.cancelled': { origen: 'admin', destino: 'webhooks' },
  'flight.schedule_changed': { origen: 'admin', destino: 'webhooks' },
  'flight.status_changed': { origen: 'inventario', destino: 'webhooks' },
  'pagos.payment.confirmed': { origen: 'booking', destino: 'api' },
  'pagos.payment.failed': { origen: 'booking', destino: 'api' },
  'paquetes.package.cancelled': { origen: 'booking', destino: 'api' },
};

/** Steps of the purchase saga (`auditoria_saga_pasos.nombre`). */
export const PASOS_SAGA: Readonly<Record<string, Enlace>> = {
  REVALIDAR_PRECIO: { origen: 'ordenes', destino: 'catalogo' },
  AUTORIZAR_PAGO: { origen: 'ordenes', destino: 'pagos' },
  EMITIR_ORDEN: { origen: 'ordenes', destino: 'inventario' },
  CAPTURAR_PAGO: { origen: 'ordenes', destino: 'pagos' },
  ANUNCIAR_EMISION: { origen: 'ordenes', destino: 'notificaciones' },
  ANULAR_PAGO: { origen: 'ordenes', destino: 'pagos' },
  REGISTRAR_ORDEN_FALLIDA: { origen: 'ordenes', destino: 'ordenes' },
  INTERRUMPIDA: { origen: 'ordenes', destino: 'ordenes' },
};

/** Outgoing calls that are not domain events (recorded as `llamada.*` in the trail). */
export const LLAMADAS: Readonly<Record<string, Enlace>> = {
  'llamada.stock_push': { origen: 'api', destino: 'booking' },
  'llamada.webhook': { origen: 'webhooks', destino: 'booking' },
};

/** Actions that are not domain events (sign-ins, tokens, subscriptions). */
export const ACCIONES: Readonly<Record<string, Enlace>> = {
  'acceso.login': { origen: 'web', destino: 'identidad' },
  'acceso.login_fallido': { origen: 'web', destino: 'identidad' },
  'acceso.invitado': { origen: 'web', destino: 'identidad' },
  'oauth2.token': { origen: 'booking', destino: 'identidad' },
  'oauth2.token_fallido': { origen: 'booking', destino: 'identidad' },
  'webhook.suscrito': { origen: 'booking', destino: 'webhooks' },
  'webhook.eliminado': { origen: 'booking', destino: 'webhooks' },
};

/** What an administrator did: from the console to the module that owns the entity. */
export const ENTIDADES_ADMIN: Readonly<Record<string, ComponenteId>> = {
  usuario: 'identidad',
  mercado: 'catalogo',
  vuelo: 'inventario',
  aeropuerto: 'catalogo',
  reserva: 'api',
  webhook_entrega: 'webhooks',
  webhook: 'webhooks',
  autenticacion: 'identidad',
  oauth2: 'identidad',
};

/** Events, sagas and entities of the partner-provider feature: not part of the traceability of Vuelos. */
export function esRuidoDeProveedor(tipo: string, entidad?: string | null): boolean {
  return tipo.startsWith('proveedor.') || tipo.startsWith('ReservaExterna') || tipo === 'RESERVA_EXTERNA' || entidad === 'proveedor' || entidad === 'reserva_externa';
}

/** The component an actor kind enters through. */
export function entradaDe(actorTipo: string | null | undefined): ComponenteId {
  if (actorTipo === 'PARTNER') return 'booking';
  if (actorTipo === 'ADMIN') return 'admin';
  return 'web';
}

export function enlaceDeEvento(tipo: string): Enlace | undefined {
  return EVENTOS[tipo] ?? LLAMADAS[tipo] ?? ACCIONES[tipo];
}
