/**
 * The Swagger sections of the flight contract (the operations of contracts/vuelos-openapi.yaml). The e-commerce
 * controllers name their own sections ('E-commerce · …'). Controllers use these constants so a name never drifts.
 */
export const SWAGGER_TAGS = {
  gestionar: 'Postventa (Maletas, Fechas y Cancelaciones)',
  checkin: 'Check-in y Boarding Pass',
  webhooks: 'Webhooks',
  nucleoBusqueda: 'Búsqueda y Catálogo',
  nucleoHold: 'Bloqueo de Cupos (Hold)',
  nucleoReservas: 'Reservas y Emisión',
  nucleoEstado: 'Estado de Vuelos',
} as const;
