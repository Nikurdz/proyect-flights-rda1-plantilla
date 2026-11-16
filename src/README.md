# src — código del backend NestJS (API de Vuelos)

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `main.ts` | Arranque de la API: prefijo `api`, versionado URI, Swagger (`/api/docs`, `/api/docs-v2`), CORS, `rawBody`, escucha en `0.0.0.0:3000` |
| `app.module.ts` | Módulo raíz: `.env`, TypeORM y `VuelosModule` (el único módulo habilitado) |
| `common/` | Ayudantes genéricos: config de TypeORM, guard de `Idempotency-Key`, DTO base, transformer numérico |
| `proto/` | `inventory.proto`: contrato gRPC del stock hacia Booking |
| `servicios/` | Satélites auditoría / notificaciones / webhooks (solo demo local con contenedores) |
| `modules/vuelos/` | Todo el dominio: núcleo GDS, e-commerce, API v2, GraphQL, ESB, migraciones, seed, pruebas |

## Cómo se conecta

- `main.ts` → `app.module.ts` → `modules/vuelos/vuelos.module.ts`.
- Producción (Azure Container Apps) corre un único proceso con `main.ts`; `servicios/` solo se usa en `docker-compose.microservicios.yml`.
- La base de datos se configura en `common/typeorm-config.ts` (TLS con `DB_SSL_CA`, pool `DB_POOL_MAX`).

## Más a fondo

- [common/](common/README.md) · [proto/](proto/README.md) · [servicios/](servicios/README.md)
- [modules/vuelos/](modules/vuelos/README.md): el dominio completo
- [README principal](../README.md)

← Volver a [README principal](../README.md)
