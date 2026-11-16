# Auditoría Contratos de eventos y división en microservicios — 2026-10-26
**Plan:** 2026-10-26-eventos-contratos-microservicios · **Commits:** 704956f · **Archivos clave:** common/domain-event-bus.ts, common/event-schemas.ts, common/schema-compat.ts, .github/workflows/ci.yml

## 1. Resumen ejecutivo
Se añadieron esquemas JSON por evento, validación con ajv, AsyncAPI y un chequeo de compatibilidad en CI. Todos los esquemas están en el AsyncAPI. El punto débil es que en producción la validación solo avisa y el chequeo de compatibilidad es parcial. Críticos: 0 · Altos: 1 · Medios: 3 · Bajos: 0

## 2. Hallazgos críticos, altos, medios y bajos
| ID | Severidad | Hallazgo |
|---|---|---|
| A-1 | Alto | En producción (modo `warn`) un evento entrante de Booking con payload inválido llega igual a los handlers que cancelan reservas. |
| M-1 | Medio | `EVENT_SCHEMA_MODE` no se fija en Azure: producción queda siempre en `warn`. |
| M-2 | Medio | El chequeo de compatibilidad ignora `pattern`, `minLength`, `maximum`, `format`, `const`, `$ref` y `oneOf`. |
| M-3 | Medio | CI omite el chequeo de contratos si no hay commit base (primer push o push forzado). |

## 3. Evidencia concreta (archivo y elemento afectado)
| ID | Archivo | Elemento afectado |
|---|---|---|
| A-1 | src/modules/vuelos/common/domain-event-bus.ts | `despachar()`: solo corta si `eventSchemaMode() === 'strict'`; luego ejecuta handlers |
| A-1 | src/modules/vuelos/v2/inbound-events-v2.service.ts | `paymentFailed()` y `packageCancelled()` llaman a `cancel()` |
| M-1 | src/modules/vuelos/common/event-schemas.ts | `eventSchemaMode()`: `production` da `warn`; `deploy/azure/generar-app.js` no define la variable |
| M-2 | src/modules/vuelos/common/schema-compat.ts | `compareSchemas()`: solo type, required, properties, items, enum, additionalProperties |
| M-3 | .github/workflows/ci.yml | paso «Event contracts stay backward compatible»: rama `echo "No base commit…"` |

## 4. Recomendación de corrección
| ID | Recomendación |
|---|---|
| A-1 | Rechazar en `despachar()` los eventos entrantes inválidos también en `warn`, al menos los que cancelan. |
| M-1 | Fijar `EVENT_SCHEMA_MODE` explícitamente en `generar-app.js` y `.env.azure.example`. |
| M-2 | Comparar también las restricciones de valor (`pattern`, `min*`, `max*`, `format`, `const`) en `compareSchemas()`. |
| M-3 | Usar `git merge-base` o `HEAD~1` como respaldo cuando `BASE_SHA` esté vacío o sea ceros. |

## 5. Pruebas que deberían repetirse después de corregir
- `npx jest src/modules/vuelos/common/schema-compat.spec.ts src/modules/vuelos/common/event-schemas.spec.ts`
- `npx jest src/modules/vuelos/esb/rabbitmq.transport.spec.ts src/modules/vuelos/common/topologia.spec.ts`
- `npm run contract:events:check`
- `npm run lint`

Verificado en código el 2026-11-15 sobre el commit 3c9d4b4.
