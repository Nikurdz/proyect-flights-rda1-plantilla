# Auditoría Aeropuertos de Ecuador y hora UTC-5 — 2026-11-08
**Plan:** 2026-11-08-aeropuertos-ecuador (más hora-ecuador, aeropuertos-ui y aeropuertos-frontend) · **Commits:** 90f98f9, a952ac7 · **Archivos clave:** src/modules/vuelos/ecommerce/admin/aeropuertos-admin.service.ts, src/modules/vuelos/ecommerce/seed/ecommerce.seed.ts, src/modules/vuelos/common/date.util.ts, src/modules/vuelos/ecommerce/admin/reservas-admin.service.ts

## 1. Resumen ejecutivo
Se cargaron los aeropuertos ecuatorianos con Loja, el alta admin con confirmación y la lectura de fechas en hora de Ecuador. El alta valida IANA, 3 letras y duplicados (409 también por carrera). Quedan defectos menores de datos y filtros. Críticos: 0 · Altos: 0 · Medios: 1 · Bajos: 2

## 2. Hallazgos críticos, altos, medios y bajos
| ID | Severidad | Hallazgo |
|---|---|---|
| M-1 | Medio | Los aeropuertos marcados «cerrado» (MCH, PVO) se siembran como activos; solo el nombre avisa. |
| B-1 | Bajo | El alta no comprueba que la zona horaria corresponda al país; `paisNombre` es texto libre. |
| B-2 | Bajo | El filtro «Creadas desde/hasta» de Reservas usa UTC mientras la pantalla muestra hora de Ecuador. |

## 3. Evidencia concreta (archivo y elemento afectado)
| ID | Archivo | Elemento afectado |
|---|---|---|
| M-1 | src/modules/vuelos/ecommerce/seed/ecommerce.seed.ts | filas `MCH` y `PVO` (líneas 71 y 73); `Localidad` no tiene campo de estado |
| B-1 | src/modules/vuelos/ecommerce/admin/aeropuertos-admin.service.ts | método de alta: solo `isTimeZone(zonaHoraria)` y texto no vacío |
| B-2 | src/modules/vuelos/ecommerce/admin/reservas-admin.service.ts | `filtered`: `b.createdAt >= CAST(:desde AS timestamp)` (línea 116) |

## 4. Recomendación de corrección
| ID | Recomendación |
|---|---|
| M-1 | Añadir columna `activo` a `ecom_localidades` y excluir los cerrados del catálogo y del alta de vuelos. |
| B-1 | Validar la zona contra una lista de zonas del país indicado. |
| B-2 | Interpretar `desde`/`hasta` como día de Ecuador con `ecuadorDayRange`. |

## 5. Pruebas que deberían repetirse después de corregir
- `npx jest src/modules/vuelos/common/date.util.spec.ts`
- `npx jest src/modules/vuelos/testing/admin-aeropuertos.integration.spec.ts src/modules/vuelos/testing/admin-reservas.integration.spec.ts` (requiere TEST_DATABASE_URL)
- `npm run lint`

Verificado en código el 2026-11-15 sobre el commit 3c9d4b4.
