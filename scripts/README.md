# scripts/ — utilidades de contratos, documentación y pruebas de humo

## Qué hay aquí

| Archivo | Comando | Qué hace |
|---|---|---|
| `build-contract-v2.js` | `npm run contract:v2:build` | Genera `contracts/vuelos-openapi-v2-ram-alliance.yaml` (plantilla + overlay). `--stdout` lo imprime |
| `export-openapi.js` | `npm run contract:export` | Escribe `contracts/vuelos-ecommerce-openapi.yaml` desde la API en marcha (`OPENAPI_URL=…/api/docs-json`) |
| `check-schema-compat.ts` | `npm run contract:events:check [-- <ref>]` | Falla si un esquema de `contracts/eventos` cambió de forma incompatible respecto a un ref de git |
| `export-modelo-datos.ts` | `npm run docs:modelo` | Regenera `docs/MODELO-DE-DATOS.md` desde las entidades (necesita `DATABASE_URL` solo para los metadatos) |
| `gateway-smoke.js` | `npm run gateway:smoke` | Prueba el Kong local (`GATEWAY_URL`, por defecto `:8000`); crea una cuenta desechable |
| `micro-smoke.js` | `npm run micro:smoke` | Prueba de punta a punta de la demo de microservicios: salud, búsqueda, compra y trazas de otros contenedores |

## Cómo se conecta

- Entradas: `contracts/`, `contracts/overlay/`, entidades de `src/modules/vuelos/entities/`.
- `check-schema-compat.ts` reutiliza `src/modules/vuelos/common/schema-compat.ts` y corre en CI (`.github/workflows/ci.yml`).
- Los smoke tests son locales: ver [deploy/gateway](../deploy/gateway/README.md) y [docker](../docker/README.md).

## Cuaderno y auditorías

- Semana 7 · contratos → [RETO-2-CORTO.md](../src/modules/vuelos/docs/RDA2-docs/auditorias/RETO-2-CUADERNO/RETO-2-CORTO.md)

## Más a fondo

- [contracts/README](../contracts/README.md) · [overlay](../contracts/overlay/README.md) · [eventos](../contracts/eventos/README.md)

← Volver a [README principal](../README.md)
