# Auditoría Velocidad v2, offsets de hora, holds y /health — 2026-11-12
**Plan:** 2026-11-12-booking-velocidad-y-holds · **Commits:** dc25c37 · **Archivos clave:** `src/modules/vuelos/v2/outbox-v2.service.ts`, `src/modules/vuelos/v2/vuelos-v2.controller.ts`, `src/modules/vuelos/v2/health-v2.service.ts`, `src/modules/vuelos/common/cloud-events.ts`

## 1. Resumen ejecutivo
Se aceleró la búsqueda y el mapa, se añadió el offset real y un /health con snapshot. El feed `/eventos` sigue sin filtrar por dueño y el /health puede colgarse con la base caída. Críticos: 0 · Altos: 1 · Medios: 1 · Bajos: 1

## 2. Hallazgos críticos, altos, medios y bajos
| ID | Severidad | Hallazgo |
|---|---|---|
| A-1 | Alto | `/eventos` devuelve eventos de todos los dueños (`ownerId`, `pnr`, `partnerOrderId`, incluidos clientes web) a cualquier token con `flights:read`. |
| M-1 | Medio | `/health` ejecuta `refresh()` en la petición si el snapshot tiene más de 120 s; `SELECT 1` no tiene timeout y puede colgarse. |
| B-1 | Bajo | `vuelos_programados_hoy` usa el día UTC: tras las 19:00 de Ecuador cuenta los vuelos de mañana. |

## 3. Evidencia concreta (archivo y elemento afectado)
| ID | Archivo | Elemento afectado |
|---|---|---|
| A-1 | src/modules/vuelos/v2/vuelos-v2.controller.ts | `listOutboxEvents` (`@RequiresScope('flights:read')`, no pasa el dueño) |
| A-1 | src/modules/vuelos/v2/outbox-v2.service.ts | `list(query)`: sin filtro por dueño; el payload lleva `ownerId` y `pnr` (`bookingData` en cloud-events.ts) |
| M-1 | src/modules/vuelos/v2/health-v2.service.ts | `check()` y `measure()` (`dataSource.query('SELECT 1')`); el comentario dice «A request never queries the database» |
| B-1 | src/modules/vuelos/v2/health-v2.service.ts | `measure()` (`utcDayRange(todayUtc())`) |

## 4. Recomendación de corrección
| ID | Recomendación |
|---|---|
| A-1 | Filtrar el feed por el dueño del token (`partner:<client>`) guardando el dueño en `vuelos_outbox`. |
| M-1 | Poner timeout a `measure()` y devolver el último snapshot o DOWN si vence. |
| B-1 | Usar el día de Ecuador (`ecuadorDayRange`) o documentar que es UTC a propósito. |

## 5. Pruebas que deberían repetirse después de corregir
- `npx jest src/modules/vuelos/testing/contract-v2-build.spec.ts src/modules/vuelos/common/zoned-time.spec.ts`
- `npx jest src/modules/vuelos/testing/v2-rendimiento.integration.spec.ts src/modules/vuelos/testing/v2-offset.integration.spec.ts` (requiere `TEST_DATABASE_URL`)
- `npx jest src/modules/vuelos/testing/booking-plan.integration.spec.ts` (requiere `TEST_DATABASE_URL`)
- `npm run lint`

Verificado en código el 2026-11-15 sobre el commit 3c9d4b4.
