# Plan de implementación: backend en Azure Container Apps (coste mínimo)

- **Fecha:** 2026-11-05
- **Agente:** Claude Code Desktop
- **Área:** despliegue / infraestructura
- **Rama:** `vuelos`

## Objetivo
La prueba de Railway se acaba. Se prepara el backend para correr en Azure Container Apps con la cuenta de estudiante (100 USD) al menor coste posible. La base sigue en Aiven y el frontend en Netlify.

## Alcance
- Incluye: `Dockerfile`, workflow que publica la imagen en GHCR, scripts `az` y generador de la definición de la app, documentación.
- No incluye: cambios de lógica, crear los recursos en la cuenta del usuario, mover datos, tocar Railway.

## Decisiones
- Container Apps, plan de consumo, sin Log Analytics (logs en vivo con `az containerapp logs show --follow`).
- 0,25 vCPU / 0,5 GiB, `maxReplicas: 1` (jobs y estado en memoria), `minReplicas: 0` por defecto (coste ≈ 0); `MIN_REPLICAS=1` la deja siempre encendida.
- Imagen en GitHub Container Registry pública (repo público): sin ACR ni credenciales de descarga. El despliegue lo lanza el usuario con `az` (las cuentas de estudiante suelen no poder crear service principals).
- La imagen incluye `contracts/` (la app lee esquemas de eventos y el YAML v2 en ejecución) y `dist/proto`. `LOG_TO_FILES=false`, `TRUST_PROXY=1`.
- Sondas a `/api/v1/health/live` (no usa la base); startup con margen de 5 minutos.

## Cambios previstos
| Archivo | Cambio |
|---|---|
| `Dockerfile`, `.dockerignore` | Imagen multi-etapa `node:20-alpine`, arranque con `npm run start:render` |
| `.github/workflows/container.yml` | Construye y publica `ghcr.io/<repo>:{sha,latest}` |
| `deploy/azure/*` | `generar-app.js`, `crear.sh`, `desplegar.sh`, `.env.azure.example`, README |
| `CLAUDE.md`, `.gitignore` | Documentación y exclusión de `.env.azure` |

## Riesgos
- Escalar a cero detiene el envío de stock, la reconciliación y los webhooks mientras duerme; cada despertar reenvía todo el stock (~1.400 POST). Cold start de ~15–30 s.
- Aiven puede filtrar por IP: permitir las IP salientes del entorno.

## Impacto en la API / contrato
Ninguno.

## Verificación
`docker build`/`run` en local (health, `/api/v2/vuelos/health`, `/api/docs-v2`), `bash -n` de los scripts, generador probado con un `.env.azure` de ejemplo, y tras el despliegue: health, token OAuth2, búsqueda v2 y `Stock push round` en los logs.
