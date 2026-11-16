# v2 — capa del contrato v2 para Booking (`/api/v2`)

Capa fina sobre los mismos servicios de `../services/`. Contrato: `contracts/vuelos-openapi-v2-ram-alliance.yaml` (generado), docs en `/api/docs-v2`.

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `vuelos-v2.controller.ts` | Las 30 operaciones `/api/v2/vuelos/*` |
| `auth/` | `oauth2.controller.ts` (`POST /api/v2/oauth2/token`), `partner-auth.guard.ts`/`.service.ts`, `scopes.ts` (`flights:read`…`flights:admin`) |
| `booking-inbound-v2.controller.ts` | Webhook de Booking (CloudEvents, HMAC con `BOOKING_WEBHOOK_SECRET`) |
| `booking-bootstrap-v2.service.ts` | Registra a Booking como suscriptor al arrancar |
| `inbound-events-v2.service.ts` | Consume `pagos.*`/`paquetes.*` de `q.vuelos.entrantes` |
| `outbox-v2.service.ts` | Feed `vuelos_outbox` y eventos CloudEvents (`GET /eventos`) |
| `stock-push.service.ts` | Empuja `asientosDisponibles` a Booking por HTTP (`BOOKING_STOCK_URL`) o gRPC (`GRPC_STOCK_URL`) |
| `health-v2.service.ts` | Salud v2 |
| `booking-view-v2`, `tickets-v2`, `seat-change-v2`, `flight-ops-v2`, `promotions-v2` (`.service.ts`) | Vistas y operaciones v2 |
| `admin-estado-vuelo.controller.ts` | `PATCH /admin/vuelos/:id/estado` |
| `problem-details-v2.filter.ts`, `v2-headers.interceptor.ts`, `zoned-time.interceptor.ts`, `v2-links.ts`, `dto-v2.ts`, `v2.module.ts` | Errores v2, cabeceras, hora, enlaces, DTO, módulo |

## Cómo se conecta

- El dueño de una reserva de socio es `partner:<client>:user:<X-User-Id>`; v1 no cambia.
- Stock push: `service_id` = `NODE_ID`; fechas v2 en UTC salvo la búsqueda (día del aeropuerto de origen).
- Pruebas: `../testing/v2.integration.spec.ts`, `contract-v2.integration.spec.ts`.

## Más a fondo

- [Comparación v1/v2](../docs/RDA2-docs/COMPARACION-CONTRATOS-V1-V2.md) · [Guía de prueba con Booking](../docs/RDA2-docs/GUIA-PRUEBA-BOOKING.md) · [contracts/](../../../../contracts/README.md)

← Volver a [vuelos](../README.md)
