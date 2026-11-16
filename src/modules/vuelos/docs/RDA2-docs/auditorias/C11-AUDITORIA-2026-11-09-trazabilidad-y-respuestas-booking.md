# Auditoría Trazabilidad unificada y respuestas a Booking — 2026-11-09
**Plan:** 2026-11-09-trazabilidad-frontend · **Commits:** 3c8f85c, 1a1a2e6 · **Archivos clave:** `src/modules/vuelos/ecommerce/admin/trazabilidad.service.ts`, `src/modules/vuelos/ecommerce/admin/trazabilidad.controller.ts`, `src/modules/vuelos/v2/auth/partner-auth.service.ts`, `frontend/src/features/admin/TraceFlowGraph.tsx`

## 1. Resumen ejecutivo
Se creó la línea de tiempo admin con CSV, flujo y mapa. El acceso está bien protegido (ADMIN por clase, CSV neutraliza fórmulas). Quedan defectos de paginación y de datos no confiables en la traza. Críticos: 0 · Altos: 0 · Medios: 2 · Bajos: 2

## 2. Hallazgos críticos, altos, medios y bajos
| ID | Severidad | Hallazgo |
|---|---|---|
| M-1 | Medio | El cursor `antes` usa `<` estricto: se pierden filas con la misma marca de tiempo entre páginas. |
| M-2 | Medio | Un PNR con más de 50 correlaciones se corta en silencio: la historia sale incompleta sin aviso. |
| B-1 | Bajo | El `estado` ERROR se deduce de `resumen.startsWith('estado=ERROR')`: cambiar el texto cambia el color sin aviso. |
| B-2 | Bajo | `oauth2.token_fallido` guarda el `clientId` enviado por un anónimo (60 caracteres) en la traza admin. |

## 3. Evidencia concreta (archivo y elemento afectado)
| ID | Archivo | Elemento afectado |
|---|---|---|
| M-1 | src/modules/vuelos/ecommerce/admin/trazabilidad.service.ts | `aplicarTiempo` (`campo < :antes`) y `listar` (`siguiente` = `en` de la última fila) |
| M-2 | src/modules/vuelos/ecommerce/admin/trazabilidad.service.ts | `correlacionesDe` (`.limit(50)` sin indicador) |
| B-1 | src/modules/vuelos/ecommerce/admin/trazabilidad.service.ts | mapeo de eventos (`startsWith('estado=ERROR')`) |
| B-2 | src/modules/vuelos/v2/auth/partner-auth.service.ts | `registrarAccion({ agregadoId: clientId.slice(0, 60) })` |

## 4. Recomendación de corrección
| ID | Recomendación |
|---|---|
| M-1 | Paginar con cursor compuesto (fecha + id) en vez de comparar solo la fecha. |
| M-2 | Devolver un aviso `truncado: true` o quitar el límite fijo de 50. |
| B-1 | Guardar el estado en una columna propia en vez de leerlo del texto. |
| B-2 | Guardar `desconocido` cuando el cliente no existe, en vez del texto recibido. |

## 5. Pruebas que deberían repetirse después de corregir
- `npx jest src/modules/vuelos/common/topologia.spec.ts src/modules/vuelos/common/db-errors.spec.ts`
- `npx jest src/modules/vuelos/testing/trazabilidad.integration.spec.ts` (requiere `TEST_DATABASE_URL`)
- `cd frontend && npx vitest run tests/unit/admin-audit-page.test.tsx`
- `npm run lint`

Verificado en código el 2026-11-15 sobre el commit 3c9d4b4.
