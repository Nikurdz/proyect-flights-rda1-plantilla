# Plan de implementación: envío de stock a Booking por HTTP

- **Fecha:** 2026-11-03
- **Agente:** Claude Code Desktop
- **Área:** backend / integración
- **Rama:** `vuelos`

## Objetivo
Booking publicó en Azure su endpoint de stock (`POST https://booking-core-api.azurewebsites.net/api/v2/inventory/stock`, JSON `{service_id, item_id, date, time_slot, available_units}`, responde `"success": true`). Nuestro envío de stock solo hablaba gRPC; se añade el transporte HTTP y se envía desde Railway.

## Alcance
- Incluye: transporte HTTP en `StockPushService`, horizonte y frecuencia configurables, manejo de rechazos y caídas, prueba de integración con un servidor HTTP local, contrato y documentación.
- No incluye: los webhooks de Booking (`/api/v2/webhooks/vuelos`), que se activan después.

## Decisiones
- `service_id` = `NODE_VUE_RAM_ALLIANCE` (variable `NODE_ID`): fijo, único y con el estilo del ejemplo de la guía (`NODE_VUE_<equipo>`).
- Un `POST` por vuelo con el valor absoluto, 8 en paralelo; completo al arrancar y cada 60 min, entre medio solo lo que cambió; horizonte de 14 días.
- Rechazo (4xx o `success:false`) → ese vuelo espera 1 h; error de red/5xx → se reintenta en la siguiente sincronización, 5 seguidos cortan la ronda.
- La URL pasa por `resolveSafeTarget` (https y IP pública en producción).

## Cambios previstos
| Archivo / módulo | Cambio |
|---|---|
| `common/vuelos-config.ts` | `BOOKING_STOCK_URL`, `STOCK_PUSH_HORIZON_DAYS`, `STOCK_PUSH_FULL_RESYNC_MINUTES` |
| `v2/stock-push.service.ts` | Transporte HTTP (gana sobre gRPC), `flush()` |
| `testing/stock-http.integration.spec.ts` | Servidor HTTP local: cuerpo exacto, horizonte, reenvío tras un hold, rechazo y caída |
| `contracts/overlay/…`, contrato generado, `.env.example`, `CLAUDE.md`, `RDA2-docs` | Documentación (`x-stock-push`) |

## Impacto en la API / contrato
Ninguna operación cambia. El contrato describe el envío de stock en `x-stock-push`.

## Verificación
`npm run lint`, `npm test`, `npm run build`, `npm run contract:v2:build` sin diferencias, y un `POST` real de un vuelo contra Azure esperando `"success": true`. En Railway: `BOOKING_STOCK_URL` y `NODE_ID`.
