# .github/workflows/ — integración continua y publicación de la imagen

## Qué hay aquí

| Archivo | Cuándo corre | Qué hace |
|---|---|---|
| `ci.yml` | Push a `vuelos` y pull requests | Job `backend` (Postgres 16 de servicio): `npm ci` → `lint` → `contract:events:check` contra el commit base → `npm test` (con `TEST_DATABASE_URL`, incluye integración) → `build`. Job `frontend`: `npm ci` → `lint` → `test` → `build` |
| `container.yml` | Push a `vuelos` o manual | Construye el `Dockerfile` raíz y lo publica en GHCR como `:<sha>` y `:latest`. Sin secretos de Azure |

## Cómo se conecta

- Tras `container.yml`, el despliegue a Azure es manual: `deploy/azure/desplegar.sh` (usa el sha, no `latest`).
- Los esquemas de eventos se comparan con `scripts/check-schema-compat.ts` (`contracts/eventos/`).
- Las pruebas de integración están en `src/modules/vuelos/testing/`.

## Cuaderno y auditorías

- Semana 9 · pruebas → [RETO-2-CORTO.md](../../src/modules/vuelos/docs/RDA2-docs/auditorias/RETO-2-CUADERNO/RETO-2-CORTO.md)
- C05 Azure Container Apps → [C05](../../src/modules/vuelos/docs/RDA2-docs/auditorias/C05-AUDITORIA-2026-11-05-azure-container-apps.md)

## Más a fondo

- [deploy/azure](../../deploy/azure/README.md) · [testing](../../src/modules/vuelos/testing/README.md) · [scripts](../../scripts/README.md)

← Volver a [README principal](../../README.md)
