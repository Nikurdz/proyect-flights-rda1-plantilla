# Auditoría Preparación de la prueba con Booking — 2026-11-08
**Plan:** 2026-11-08-preparacion-prueba-booking · **Commits:** b737d23, bb252fe · **Archivos clave:** src/modules/vuelos/ecommerce/admin/reservas-admin.service.ts, src/modules/vuelos/ecommerce/admin/webhooks-admin.service.ts, src/modules/vuelos/v2/stock-push.service.ts, src/modules/vuelos/common/cloud-events.ts

## 1. Resumen ejecutivo
Se preparó la sesión con Booking: penalidad configurable, campos de `booking.cancelled`, administración de webhooks y estado del stock. Los eventos sí llevan `reason` y el secreto del webhook no se expone. Quedan tres defectos menores. Críticos: 0 · Altos: 0 · Medios: 1 · Bajos: 2

## 2. Hallazgos críticos, altos, medios y bajos
| ID | Severidad | Hallazgo |
|---|---|---|
| M-1 | Medio | El CSV de reservas trunca a 5000 filas sin avisar; el cuadre final podría omitir ventas. |
| B-1 | Bajo | `reintentar` solo bloquea DELIVERED: una entrega PENDING reinicia sus intentos y puede enviarse dos veces. |
| B-2 | Bajo | El estado del push de stock (`ultimaRonda`) vive en memoria y se pierde al reiniciar. |

## 3. Evidencia concreta (archivo y elemento afectado)
| ID | Archivo | Elemento afectado |
|---|---|---|
| M-1 | src/modules/vuelos/ecommerce/admin/reservas-admin.service.ts | `exportCsv`, `take(CSV_EXPORT_MAX)` (línea 81) |
| B-1 | src/modules/vuelos/ecommerce/admin/webhooks-admin.service.ts | `reintentar`: solo comprueba `status === 'DELIVERED'` |
| B-2 | src/modules/vuelos/v2/stock-push.service.ts | campo `ultimaRonda` (línea 295) y `lastFull` (línea 77) |

## 4. Recomendación de corrección
| ID | Recomendación |
|---|---|
| M-1 | Añadir indicador de truncado al CSV o paginar la exportación. |
| B-1 | Rechazar el reintento si la entrega está PENDING y aún no venció. |
| B-2 | Documentar que el estado se reinicia o guardarlo en base de datos. |

## 5. Pruebas que deberían repetirse después de corregir
- `npx jest src/modules/vuelos/testing/booking-prueba.integration.spec.ts` (requiere TEST_DATABASE_URL)
- `npx jest src/modules/vuelos/common/event-schemas.spec.ts`
- `npm run contract:events:check` y `npm run lint`

Verificado en código el 2026-11-15 sobre el commit 3c9d4b4.
