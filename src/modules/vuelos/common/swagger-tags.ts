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
  admin: '6 · Administración (solo ADMIN)',
  nucleoBusqueda: '7 · Núcleo GDS · Búsqueda y asientos',
  nucleoHold: '7 · Núcleo GDS · Bloqueo de cupos (hold)',
  nucleoReservas: '7 · Núcleo GDS · Reservas y tickets',
  nucleoEstado: '7 · Núcleo GDS · Estado de vuelos',
  sistema: '8 · Sistema',
  postventa: '⛔ No implementado · Postventa',
  checkin: '⛔ No implementado · Check-in y pase de abordar',
  webhooks: '⛔ No implementado · Webhooks',
} as const;

/** Name and description of every tag, in display order. */
export const SWAGGER_TAG_LIST: { name: string; description: string }[] = [
  { name: SWAGGER_TAGS.acceso, description: 'Primero: obtén un token. Como **invitado** (compra sin cuenta), con una **cuenta nueva** o iniciando sesión (el admin entra aquí). Luego pulsa **Authorize**.' },
  { name: SWAGGER_TAGS.buscar, description: 'Ciudades y aeropuertos, vuelos disponibles (ida o ida y vuelta), tarifas BASIC/LIGHT/FULL de un itinerario y la configuración del mercado `ec` (USD).' },
  { name: SWAGGER_TAGS.oferta, description: 'Convierte la selección en una **oferta** que retiene los asientos 15 minutos: pasajeros (con asiento opcional), facturación y condiciones. Necesita `Idempotency-Key` al crear.' },
  { name: SWAGGER_TAGS.pagar, description: 'Paga y emite en una sola operación (simulada): autoriza el cobro, crea la orden, la reserva y un billete por pasajero, y captura. Necesita `Idempotency-Key`.' },
  { name: SWAGGER_TAGS.viajes, description: 'Lo que pasa después de comprar: recuperar un viaje con código y apellido, historial de la cuenta, vincular un viaje de invitado y **verificar el QR** de un billete.' },
  { name: SWAGGER_TAGS.admin, description: 'Solo con el token de ADMIN: órdenes de todos los clientes (con QR), vuelos y asientos reservados, observabilidad, mercados, auditoría y mensajes enviados.' },
  { name: SWAGGER_TAGS.nucleoBusqueda, description: 'API del **contrato de vuelos** (GDS) que usa el e-commerce por dentro: búsqueda multidestino y mapa de asientos de una oferta del núcleo. No hace falta para el recorrido de compra.' },
  { name: SWAGGER_TAGS.nucleoHold, description: 'Contrato GDS: bloquear, consultar y liberar el inventario. El e-commerce lo hace por ti al armar la oferta.' },
  { name: SWAGGER_TAGS.nucleoReservas, description: 'Contrato GDS: crear la reserva y consultar reservas y tickets (cada ticket trae `qrPayload`). El e-commerce lo hace por ti al pagar.' },
  { name: SWAGGER_TAGS.nucleoEstado, description: 'Contrato GDS: estado de un vuelo por número.' },
  { name: SWAGGER_TAGS.sistema, description: 'Comprobación de que la API alcanza su base de datos (`/health`).' },
  { name: SWAGGER_TAGS.postventa, description: 'En el contrato pero **sin implementar en esta fase**: equipaje extra, cambio de fecha y cancelación. Responden `501 NOT_IMPLEMENTED`, nunca un 200 vacío.' },
  { name: SWAGGER_TAGS.checkin, description: 'En el contrato pero **sin implementar en esta fase**: check-in y pases de abordar. Responden `501`.' },
  { name: SWAGGER_TAGS.webhooks, description: 'En el contrato pero **sin implementar en esta fase**: suscripciones a eventos. Responden `501`.' },
];
