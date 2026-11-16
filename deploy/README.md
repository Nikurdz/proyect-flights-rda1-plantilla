# deploy/ — despliegue en Azure (producción) y gateway Kong (solo local)

## Qué hay aquí

| Archivo o subcarpeta | Qué hace | Estado |
|---|---|---|
| `azure/` | Scripts para crear y publicar el backend en Azure Container Apps ([README](azure/README.md)) | Producción |
| `gateway/kong.yml` | Kong DB-less delante de la API en el host ([README](gateway/README.md)) | Solo local |
| `gateway/kong.microservicios.yml` | Kong para la demo de microservicios | Demo |

## Cómo se conecta

- Producción: `.github/workflows/container.yml` publica la imagen en GHCR → `azure/desplegar.sh <sha>` crea la revisión. Imagen del `Dockerfile` raíz.
- Kong local sale de `docker-compose.yml` (perfil `gateway`); el de la demo, de `docker-compose.microservicios.yml`.
- Nada de `gateway/` se despliega.

## Cuaderno y auditorías

- Semana 8 · gateway → [RETO-2-CORTO.md](../src/modules/vuelos/docs/RDA2-docs/auditorias/RETO-2-CUADERNO/RETO-2-CORTO.md)
- C05 Azure Container Apps → [C05](../src/modules/vuelos/docs/RDA2-docs/auditorias/C05-AUDITORIA-2026-11-05-azure-container-apps.md)
- C07 BFF y gateway → [C07](../src/modules/vuelos/docs/RDA2-docs/auditorias/C07-AUDITORIA-2026-11-08-bff-clientes-y-gateway.md)

## Más a fondo

- [Capas y arquitectura](../src/modules/vuelos/docs/ARQUITECTURA-CAPAS.md)
- [Contenedores por microservicio](../src/modules/vuelos/docs/RDA2-docs/CONTENEDORES-POR-MICROSERVICIO.md)

← Volver a [README principal](../README.md)
