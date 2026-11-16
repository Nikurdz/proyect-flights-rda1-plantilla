# Auditoría Backend en Azure Container Apps (coste mínimo) — 2026-11-05
**Plan:** 2026-11-05-azure-container-apps · **Commits:** bb47941, cffa9bb, d99ceb6, ed3992e · **Archivos clave:** deploy/azure/generar-app.js, .github/workflows/container.yml, package.json, deploy/azure/crear.sh, src/main.ts

## 1. Resumen ejecutivo
Se preparó el despliegue en Azure Container Apps con imagen en GHCR, usuario no root y secretos de Azure para las credenciales conocidas. El estado es funcional. Los riesgos son operativos: imagen sin pasar CI, secretos por lista fija, escala a cero y seed sin supervisión. Críticos: 0 · Altos: 0 · Medios: 4 · Bajos: 1

## 2. Hallazgos críticos, altos, medios y bajos
| ID | Severidad | Hallazgo |
|---|---|---|
| M-1 | Medio | `container.yml` publica `:latest` y `:sha` en cada push sin depender de que `ci.yml` pase. |
| M-2 | Medio | Solo las variables de una lista fija son secretos; cualquier otra credencial (p. ej. `MIGRATIONS_DATABASE_URL`) va en claro. |
| M-3 | Medio | `minReplicas` por defecto es 0: dormida no hay reconciliación de pagos, webhooks ni stock. |
| M-4 | Medio | El seed corre en segundo plano sin supervisión; si falla solo queda en logs. |
| B-1 | Bajo | `/api/docs` y `/api/docs-v2` están públicos en producción. |

## 3. Evidencia concreta (archivo y elemento afectado)
| ID | Archivo | Elemento afectado |
|---|---|---|
| M-1 | .github/workflows/container.yml | `on: push: branches: [vuelos]`; paso `docker/build-push-action` |
| M-2 | deploy/azure/generar-app.js | `SECRETS` (Set fijo) y rama `else env.push({ name, value })` |
| M-3 | deploy/azure/generar-app.js | `scale.minReplicas: Number(process.env.MIN_REPLICAS ?? 0)` |
| M-4 | package.json | script `start:container`: `(node dist/modules/vuelos/seed/seed.js &)` |
| B-1 | src/main.ts | `SwaggerModule.setup('api/docs', …)` y `'api/docs-v2'` sin condición |

## 4. Recomendación de corrección
| ID | Recomendación |
|---|---|
| M-1 | Hacer que el workflow de imagen dependa de CI (`workflow_run` o `needs`). |
| M-2 | Tratar como secreto toda variable con `URL`, `KEY`, `SECRET`, `PASSWORD` o `TOKEN` en el nombre. |
| M-3 | Fijar `MIN_REPLICAS=1` en producción real o documentar la pausa de jobs. |
| M-4 | Registrar el resultado del seed y alertar si termina con error. |
| B-1 | Proteger Swagger en producción con una variable o credencial. |

## 5. Pruebas que deberían repetirse después de corregir
- `node deploy/azure/generar-app.js ghcr.io/x/y:test westus /env` (con `.env.azure` de prueba; comprobar `secrets`)
- `npm run build`
- `npm test -- --ci`
- `npm run lint`

Verificado en código el 2026-11-15 sobre el commit 3c9d4b4.
