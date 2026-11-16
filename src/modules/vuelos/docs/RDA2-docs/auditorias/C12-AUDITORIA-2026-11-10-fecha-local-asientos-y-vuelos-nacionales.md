# Auditoría Fecha local, asientos HELD y vuelos nacionales — 2026-11-10
**Plan:** 2026-11-10-fecha-local-y-asientos-held · **Commits:** 7323ebe, eb3288d, 1f4d2e9 · **Archivos clave:** `src/modules/vuelos/services/offers.service.ts`, `src/modules/vuelos/services/bookings.service.ts`, `src/modules/vuelos/common/held-seats.ts`, `src/modules/vuelos/seed/flights.seed.ts`

## 1. Resumen ejecutivo
La búsqueda v2 usa el día local del origen y los holds apartan asientos con índice único como garantía final. Hay un orden de bloqueos inconsistente y un seed que contradice su propio comentario. Críticos: 0 · Altos: 0 · Medios: 2 · Bajos: 2

## 2. Hallazgos críticos, altos, medios y bajos
| ID | Severidad | Hallazgo |
|---|---|---|
| M-1 | Medio | Orden de bloqueos opuesto: re-hold toma asientos y luego el hold; la reserva toma hold y luego asientos. Un deadlock (40P01) no está mapeado y sale como 500. |
| M-2 | Medio | El seed incremental usa `MAX(fechaSalida)` por código: un vuelo borrado por el admin, si era el último, se regenera. |
| B-1 | Bajo | `replaceHoldSeatsWithin` retorna en silencio si el hold venció: el llamante cree que apartó los asientos. |
| B-2 | Bajo | `AirportZones.preload` traga el error sin log: Galápagos queda en zona de Guayaquil sin rastro. |

## 3. Evidencia concreta (archivo y elemento afectado)
| ID | Archivo | Elemento afectado |
|---|---|---|
| M-1 | src/modules/vuelos/services/offers.service.ts | `createHoldWithin` (`lockSeats`, luego `findHold` con lock) y `replaceHoldSeatsWithin` (lock del hold, luego `claimHoldSeats`) |
| M-1 | src/modules/vuelos/services/bookings.service.ts | `createBookingWithin` (`findHold` con lock, luego `lockSeats`) |
| M-2 | src/modules/vuelos/seed/flights.seed.ts | `lastByCode` / `MAX(v.fechaSalida)` y el comentario «is not brought back» |
| B-1 | src/modules/vuelos/services/offers.service.ts | `replaceHoldSeatsWithin` (`return` si el hold no está `HELD`) |
| B-2 | src/modules/vuelos/common/airport-zones.ts | `preload` (`.catch` que solo reinicia `preloading`) |

## 4. Recomendación de corrección
| ID | Recomendación |
|---|---|
| M-1 | Unificar el orden (hold primero, asientos después) y mapear 40P01 a un 409 reintentable. |
| M-2 | Registrar los vuelos borrados o fijar la fecha inicial del seed en vez de usar `MAX`. |
| B-1 | Lanzar un error o devolver cuántos asientos se apartaron. |
| B-2 | Añadir `logger.warn` en el `catch`. |

## 5. Pruebas que deberían repetirse después de corregir
- `npx jest src/modules/vuelos/common/held-seats.spec.ts src/modules/vuelos/seed/flights.seed.spec.ts`
- `npx jest src/modules/vuelos/testing/hold-reholding.integration.spec.ts` (requiere `TEST_DATABASE_URL`)
- `npx jest src/modules/vuelos/testing/nacionales.integration.spec.ts` (requiere `TEST_DATABASE_URL`)
- `npm run lint`

Verificado en código el 2026-11-15 sobre el commit 3c9d4b4.
