# Auditoría Facturación Booking, edades y jóvenes (yth) — 2026-11-09
**Plan:** 2026-11-09-facturacion-booking-y-edades (más UI y frontend de facturación y edades) · **Commits:** bee820a, 9bffe5a, 9456d84 · **Archivos clave:** src/modules/vuelos/ecommerce/admin/booking-conciliacion.service.ts, src/modules/vuelos/common/business-rules.ts, frontend/src/lib/passenger-rules.ts, src/modules/vuelos/ecommerce/ofertas/ofertas.service.ts

## 1. Resumen ejecutivo
Se añadió la conciliación de facturas de Booking (solo lectura), la regla de edad en primer y último vuelo y el contador de jóvenes. Las rutas web y GDS pasan el último vuelo a la regla de edad. Quedan fallos de zona horaria y un CSV que trunca. Críticos: 0 · Altos: 0 · Medios: 2 · Bajos: 2

## 2. Hallazgos críticos, altos, medios y bajos
| ID | Severidad | Hallazgo |
|---|---|---|
| M-1 | Medio | El CSV de conciliación trunca a 5000 filas sin indicador; la vista resumen sí lo tiene. |
| M-2 | Medio | La edad se mide contra el día UTC del vuelo, no el de Ecuador: puede errar la banda en el borde. |
| B-1 | Bajo | «Fecha en el futuro» usa hoy en UTC en backend y hoy en Ecuador en frontend. |
| B-2 | Bajo | La tolerancia del IVA (`pax*legs` centavos) puede ocultar diferencias reales pequeñas. |

## 3. Evidencia concreta (archivo y elemento afectado)
| ID | Archivo | Elemento afectado |
|---|---|---|
| M-1 | src/modules/vuelos/ecommerce/admin/booking-conciliacion.service.ts | `exportCsv`, `take(CAP)` (línea 89); `truncado` solo en el resumen (línea 67) |
| M-2 | src/modules/vuelos/common/business-rules.ts | `ageAt` con campos UTC; en frontend/src/lib/passenger-rules.ts, `flightDay` |
| B-1 | src/modules/vuelos/common/business-rules.ts | `assertPassengerTypeMatchesAge`: `birthDate > todayUtc()` (línea 130) |
| B-2 | src/modules/vuelos/ecommerce/admin/booking-conciliacion.service.ts | `lineas`: `Math.max(1, pax * legs)` (línea 138) |

## 4. Recomendación de corrección
| ID | Recomendación |
|---|---|
| M-1 | Exponer `truncado` también en el CSV o paginar la exportación. |
| M-2 | Calcular el día del vuelo en hora de Ecuador en backend y frontend a la vez. |
| B-1 | Usar `todayEcuador()` en backend para la fecha de nacimiento futura. |
| B-2 | Documentar el criterio de redondeo o comparar por línea de precio. |

## 5. Pruebas que deberían repetirse después de corregir
- `npx jest src/modules/vuelos/common/business-rules.spec.ts src/modules/vuelos/common/date.util.spec.ts`
- `npx jest src/modules/vuelos/testing/admin-facturacion-booking.integration.spec.ts` (requiere TEST_DATABASE_URL)
- `cd frontend && npx vitest run` y `npm run lint`

Verificado en código el 2026-11-15 sobre el commit 3c9d4b4.
