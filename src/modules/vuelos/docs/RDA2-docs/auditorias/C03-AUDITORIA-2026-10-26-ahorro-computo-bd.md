# Auditoría Ahorro de cómputo de la base de datos y traslado a Aiven — 2026-10-26
**Plan:** 2026-10-26-ahorro-computo-bd · **Commits:** 05da7f0, 8525c80, 34d93f4, 740697e · **Archivos clave:** common/activity-gate.ts, src/common/typeorm-config.ts, common/db-ssl.ts, ecommerce/common/global-rate-limit.middleware.ts, ecommerce/ordenes/reconciliacion.service.ts

## 1. Resumen ejecutivo
La puerta de actividad deja dormir la base y `/health/live` no la consulta. TLS con CA propia funciona. Quedan huecos: no se exige TLS en producción, un endpoint público consulta la BD sin límite y los trabajos críticos callan mientras duerme. Críticos: 0 · Altos: 0 · Medios: 3 · Bajos: 2

## 2. Hallazgos críticos, altos, medios y bajos
| ID | Severidad | Hallazgo |
|---|---|---|
| M-1 | Medio | Nada exige TLS hacia la BD en producción: sin `DB_SSL_CA` ni `sslmode` la conexión puede ir en claro. |
| M-2 | Medio | `GET /api/v1/health` es público, consulta la BD y está exento del límite global: cualquiera puede mantenerla despierta. |
| M-3 | Medio | La reconciliación y el barrido de holds no corren mientras la app duerme: capturas y anulaciones pendientes esperan a la próxima visita. |
| B-1 | Bajo | `/api/v1/health/live` (sonda de Azure) no está en `EXEMPT_PATHS` y cuenta contra el límite por IP. |
| B-2 | Bajo | `synchronize` se activa si falta `NODE_ENV`; Azure lo fija, otro despliegue no está protegido. |

## 3. Evidencia concreta (archivo y elemento afectado)
| ID | Archivo | Elemento afectado |
|---|---|---|
| M-1 | src/common/typeorm-config.ts | `ssl: dbSsl(...)` devuelve `undefined` sin CA; `common/vuelos-config.ts` no valida TLS |
| M-2 | src/modules/vuelos/ecommerce/admin/observabilidad.controller.ts | `salud()` (`GET /health`) sin guard; `EXEMPT_PATHS` en el middleware |
| M-3 | src/modules/vuelos/ecommerce/ordenes/reconciliacion.service.ts | `onModuleInit()`: `activityGate.isActive() && reconciliar()` |
| M-3 | src/modules/vuelos/services/holds-sweeper.service.ts | `onModuleInit()`: mismo filtro con `sweep()` |
| B-1 | src/modules/vuelos/ecommerce/common/global-rate-limit.middleware.ts | `EXEMPT_PATHS` solo `/api/v1/health` y `/api/v2/vuelos/health` |
| B-2 | src/common/typeorm-config.ts | `synchronize: … !== 'production'` |

## 4. Recomendación de corrección
| ID | Recomendación |
|---|---|
| M-1 | En `vuelos-config.ts`, exigir `DB_SSL_CA` o `sslmode=require` cuando `NODE_ENV=production`. |
| M-2 | Limitar `GET /health` por IP o usar solo `/health/live` y quitar la exención. |
| M-3 | Documentar la espera o usar `MIN_REPLICAS=1` en ventanas de operación. |
| B-1 | Añadir `/api/v1/health/live` a `EXEMPT_PATHS`. |
| B-2 | Activar `synchronize` solo con `NODE_ENV=development` explícito. |

## 5. Pruebas que deberían repetirse después de corregir
- `npx jest src/modules/vuelos/common/activity-gate.spec.ts src/modules/vuelos/common/db-ssl.spec.ts`
- `npx jest src/modules/vuelos/ecommerce/common/global-rate-limit.middleware.spec.ts`
- `npm run lint`
- `npm run build`

Verificado en código el 2026-11-15 sobre el commit 3c9d4b4.
