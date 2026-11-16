# deploy/gateway/ — Kong, el gateway de borde (solo local y demo)

Kong **DB-less** (config declarativa, sin base de datos). **No se despliega**: producción no lo usa.

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `kong.yml` | Kong en `:8000` delante de la API que corre en el host (`host.docker.internal:3000`) |
| `kong.microservicios.yml` | Igual, pero hacia los contenedores de la demo (`vuelos-api`, `/svc/<satélite>/health`) |

## Reglas de borde (`kong.yml`)

| Regla | Detalle |
|---|---|
| JWT | HS256, `iss=vuelos-identity`, `exp`; solo en `/api/v1/admin`, `/movil`, `/web` (no `/clientes` ni `/ordenes`, que son públicas) |
| Límite | 300 req/min por IP (igual que `GLOBAL_RATE_LIMIT_MAX` de la API) |
| Tamaño | 1 MB |
| Tipo | `application/json` (se admiten CloudEvents `+json` y el form de OAuth2) → 415 si no |
| `Idempotency-Key` | Debe ser UUID → 400 si no |
| `X-Correlation-Id` | Se conserva o se genera |
| Salud | `/api/v1/health`, `/api/v2/vuelos/health` exentas |

La API sigue verificando cada token y es dueña de propiedad, penalidades y reproducción idempotente.

## Secreto `__JWT_SECRET__`

El YAML lleva el marcador `__JWT_SECRET__`, nunca el secreto real. Al arrancar, el contenedor (ver `docker-compose.yml`) lo sustituye con `sed` por `JWT_SECRET` del `.env`; sin él, Kong no arranca.

## Cómo se usa

```bash
docker compose --profile gateway up -d kong     # API en el host con TRUST_PROXY=1
npm run gateway:smoke                           # gasta la cuota por IP durante un minuto
```

Un `docker compose up -d` normal solo levanta Postgres. La demo completa: `npm run micro:up`.

## Cuaderno y auditorías

- Semana 8 · gateway → [RETO-2-CORTO.md](../../src/modules/vuelos/docs/RDA2-docs/auditorias/RETO-2-CUADERNO/RETO-2-CORTO.md)
- C07 → [C07](../../src/modules/vuelos/docs/RDA2-docs/auditorias/C07-AUDITORIA-2026-11-08-bff-clientes-y-gateway.md)

## Más a fondo

- [Gateway GraphQL de la API](../../src/modules/vuelos/gateway/README.md) · [scripts/README](../../scripts/README.md)

← Volver a [deploy/README](../README.md)
