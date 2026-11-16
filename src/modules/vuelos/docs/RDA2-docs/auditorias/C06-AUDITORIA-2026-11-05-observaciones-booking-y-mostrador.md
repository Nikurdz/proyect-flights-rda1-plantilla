# Auditoría Observaciones de Booking y mostrador — 2026-11-05
**Plan:** 2026-11-05-observaciones-booking (más mostrador-ui y mostrador-frontend) · **Commits:** 22ee288, 41ce5c1, a5bee7f · **Archivos clave:** src/modules/vuelos/ecommerce/admin/reservas-admin.service.ts, src/modules/vuelos/ecommerce/admin/reservas-admin.controller.ts, src/modules/vuelos/services/webhooks.service.ts, src/modules/vuelos/migrations/1793932853618-PassengerTravellers.ts

## 1. Resumen ejecutivo
Se atendieron las observaciones de Booking, se añadió el mostrador (reservas, check-in, cancelación) y el pasajero único por índice ciego. La barrera de propiedad y el rol ADMIN funcionan; quedan defectos menores. Críticos: 0 · Altos: 0 · Medios: 1 · Bajos: 3

## 2. Hallazgos críticos, altos, medios y bajos
| ID | Severidad | Hallazgo |
|---|---|---|
| M-1 | Medio | El CSV de reservas se corta en 5000 filas sin avisar al usuario. |
| B-1 | Bajo | La auditoría del check-in y la cancelación se escribe después de la acción, fuera de su transacción. |
| B-2 | Bajo | El filtro LIKE de suscripciones de socio no escapa `_` ni `%` del clientId. |
| B-3 | Bajo | La migración PassengerTravellers lee todos los pasajeros de una vez, sin paginar. |

## 3. Evidencia concreta (archivo y elemento afectado)
| ID | Archivo | Elemento afectado |
|---|---|---|
| M-1 | src/modules/vuelos/ecommerce/admin/reservas-admin.service.ts | `exportCsv`, `take(CSV_EXPORT_MAX)` (línea 81), sin campo de truncado |
| B-1 | src/modules/vuelos/ecommerce/admin/reservas-admin.service.ts | `checkIn` y `cancel`: `this.auditar(...)` tras la acción (líneas 146-158) |
| B-2 | src/modules/vuelos/services/webhooks.service.ts | `ownedBy`: `Like` con `${account}:%` (línea 120) |
| B-3 | src/modules/vuelos/migrations/1793932853618-PassengerTravellers.ts | `SELECT ... FROM "vuelos_passengers"` sin LIMIT (líneas 55-57) |

## 4. Recomendación de corrección
| ID | Recomendación |
|---|---|
| M-1 | Devolver una cabecera o columna `truncado` cuando se alcance el tope, como hace la vista de conciliación. |
| B-1 | Guardar la auditoría dentro de la misma transacción que la acción del mostrador. |
| B-2 | Escapar `%` y `_` del clientId o validar su formato al crear el cliente OAuth2. |
| B-3 | Leer los pasajeros por lotes con cursor en la migración. |

## 5. Pruebas que deberían repetirse después de corregir
- `npx jest src/modules/vuelos/common/business-rules.spec.ts src/modules/vuelos/testing/contract-v2-build.spec.ts`
- `npx jest src/modules/vuelos/testing/admin-reservas.integration.spec.ts src/modules/vuelos/testing/booking-plan.integration.spec.ts` (requiere TEST_DATABASE_URL)
- `npm run migration:check:vuelos` y `npm run lint`

Verificado en código el 2026-11-15 sobre el commit 3c9d4b4.
