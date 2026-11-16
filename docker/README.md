# docker/ — imágenes de la demo de microservicios (solo local)

Un Dockerfile por servicio. **Producción no las usa**: Azure ejecuta la imagen única del `Dockerfile` de la raíz.

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `vuelos-api/Dockerfile` | Núcleo (`SERVICE_ROLE=api`): migra, siembra en segundo plano y arranca, puerto 3000 |
| `auditoria/Dockerfile` | Satélite de auditoría (`SERVICE_ROLE=auditoria`, puerto 3001) |
| `notificaciones/Dockerfile` | Satélite de notificaciones (puerto 3002) |
| `webhooks/Dockerfile` | Satélite de webhooks (puerto 3003) |
| `frontend/Dockerfile` + `nginx.conf` | React compilado y servido por nginx (`VITE_API_URL` se incrusta al compilar) |
| `.env.microservicios.example` | Plantilla de variables de la demo; copia a `.env.microservicios` |

Los cuatro backends comparten las etapas de compilación (la caché de BuildKit se reutiliza). El contexto de build es la raíz del repo; el del frontend es `frontend/`.

## Cómo se conecta

- Los orquesta `docker-compose.microservicios.yml` (raíz): Postgres 5434, RabbitMQ 5673/15673, Kong 8000, frontend 8080.
- Kong usa `deploy/gateway/kong.microservicios.yml`; el código de los satélites está en `src/servicios/`.
- Comandos: `npm run micro:build`, `micro:up`, `micro:smoke`, `micro:logs`, `micro:down`.

## Más a fondo

- [Contenedores por microservicio](../src/modules/vuelos/docs/RDA2-docs/CONTENEDORES-POR-MICROSERVICIO.md) · [Descomposición](../src/modules/vuelos/docs/RDA2-docs/DESCOMPOSICION-MICROSERVICIOS.md)
- [C14 microservicios y rediseño](../src/modules/vuelos/docs/RDA2-docs/auditorias/C14-AUDITORIA-2026-11-13-microservicios-y-rediseno-frontend.md)
- [deploy/gateway](../deploy/gateway/README.md) · [src/servicios](../src/servicios/README.md)

← Volver a [README principal](../README.md)
