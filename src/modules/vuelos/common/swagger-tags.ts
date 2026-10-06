/**
 * The Swagger sections of the Vuelos module, in the order a person walks through a purchase.
 * The number in each name is what keeps them in that order; controllers refer to these constants
 * so a name can never drift between the controller and the document that declares it.
 */
export const SWAGGER_TAGS = {
  acceso: '1 · Acceso (empieza aquí)',
  buscar: '2 · Buscar vuelos',
  oferta: '3 · Oferta y checkout',
  pagar: '4 · Pagar y emitir',
  viajes: '5 · Mis viajes y billetes (QR)',
  gestionar: '6 · Gestionar la reserva (equipaje, cambio y cancelación)',
  checkin: '7 · Check-in y pases de abordar',
  webhooks: '8 · Webhooks (avisos de eventos)',
  admin: '9 · Administración (solo ADMIN)',
  nucleoBusqueda: '10 · Núcleo GDS · Búsqueda y asientos',
  nucleoHold: '10 · Núcleo GDS · Bloqueo de cupos (hold)',
  nucleoReservas: '10 · Núcleo GDS · Reservas y tickets',
  nucleoEstado: '10 · Núcleo GDS · Estado de vuelos',
  sistema: '11 · Sistema',
} as const;

/** Name and description of every tag, in display order. */
export const SWAGGER_TAG_LIST: { name: string; description: string }[] = [
  { name: SWAGGER_TAGS.acceso, description: 'Primero: obtén un token. Como **invitado** (compra sin cuenta), con una **cuenta nueva** o iniciando sesión (el admin entra aquí). Luego pulsa **Authorize**.' },
  { name: SWAGGER_TAGS.buscar, description: 'Ciudades y aeropuertos, vuelos disponibles (ida o ida y vuelta), tarifas BASIC/LIGHT/FULL de un itinerario y la configuración del mercado `ec` (USD).' },
  { name: SWAGGER_TAGS.oferta, description: 'Convierte la selección en una **oferta** que retiene los asientos 15 minutos: pasajeros (con asiento opcional), facturación y condiciones. Necesita `Idempotency-Key` al crear.' },
  { name: SWAGGER_TAGS.pagar, description: 'Paga y emite en una sola operación (simulada): autoriza el cobro, crea la orden, la reserva y un billete por pasajero, y captura. Necesita `Idempotency-Key`.' },
  { name: SWAGGER_TAGS.viajes, description: 'Lo que pasa después de comprar: recuperar un viaje con código y apellido, historial de la cuenta, vincular un viaje de invitado y **verificar el QR** de un billete.' },
  { name: SWAGGER_TAGS.gestionar, description: 'Sobre una reserva ya emitida (usa su `bookingId`, que sale en la orden): **equipaje extra**, **cambio de fecha** (solo tarifas cambiables) y **cancelación** con cotización y reembolso. Los pasos que escriben necesitan `Idempotency-Key`.' },
  { name: SWAGGER_TAGS.checkin, description: 'Check-in (abre 48 h y cierra 1 h antes de la salida) y los **pases de abordar** con su código QR firmado. Antes del check-in no hay pases.' },
  { name: SWAGGER_TAGS.webhooks, description: 'Suscripciones para que tu sistema reciba avisos firmados (HMAC-SHA256) de las reservas: confirmada, cambiada, cancelada, equipaje, check-in, billetes... Solo URLs https públicas; se reintenta con espera creciente.' },
  { name: SWAGGER_TAGS.admin, description: 'Solo con el token de ADMIN: órdenes de todos los clientes (con QR), vuelos y asientos reservados, **cancelar o reprogramar un vuelo**, observabilidad, mercados, auditoría y mensajes enviados.' },
  { name: SWAGGER_TAGS.nucleoBusqueda, description: 'API del **contrato de vuelos** (GDS) que usa el e-commerce por dentro: búsqueda multidestino y mapa de asientos de una oferta del núcleo. No hace falta para el recorrido de compra.' },
  { name: SWAGGER_TAGS.nucleoHold, description: 'Contrato GDS: bloquear, consultar y liberar el inventario. El e-commerce lo hace por ti al armar la oferta.' },
  { name: SWAGGER_TAGS.nucleoReservas, description: 'Contrato GDS: crear la reserva y consultar reservas y tickets (cada ticket trae `qrPayload`). El e-commerce lo hace por ti al pagar.' },
  { name: SWAGGER_TAGS.nucleoEstado, description: 'Contrato GDS: estado de un vuelo por número (programado, cancelado...).' },
  { name: SWAGGER_TAGS.sistema, description: 'Comprobación de que la API alcanza su base de datos (`/health`).' },
];
