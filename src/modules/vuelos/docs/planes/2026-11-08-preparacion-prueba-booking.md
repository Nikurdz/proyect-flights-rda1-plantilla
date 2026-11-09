# Plan de implementación: preparación de la prueba de punta a punta con Booking

- **Fecha:** 2026-11-08
- **Agente:** Claude Code Desktop (backend/BD); Antigravity (frontend)
- **Área:** backend/BD, frontend, despliegue
- **Rama:** `vuelos`

## Objetivo
Dejar la aerolínea lista para la última prueba con Booking: disponibilidad, compras desde Booking y desde la web, hold, rechazo, check-in, cancelaciones, estado de vuelo, webhooks y cuadre final. Para eso hay que cerrar lo que falta en la política de reembolso, la visibilidad de webhooks, los datos que recibe Booking y el reporte de montos.

## Alcance
- Incluye:
  - Penalidad 0 en la tarifa reembolsable, solo por configuración.
  - Campos nuevos en el CloudEvent `booking.cancelled`.
  - Endpoints admin y pantalla de webhooks: suscripciones, entregas y reintento.
  - Estado del push de stock en observabilidad.
  - Desglose de montos y export CSV en el mostrador.
  - Runbook de la prueba y checklist de variables de despliegue.
- No incluye:
  - Tarifas por aerolínea o elección de familias al crear un vuelo: hoy son globales (`BASIC`/`LIGHT` no reembolsables, `FULL` reembolsable).
  - Stock por tarifa.
  - Facturar las reservas v2.
  - Liquidación o comisión de Booking.
  - Push inmediato al crear un vuelo: llega en ≤30 s por la red de seguridad de `StockPushService`.

## Contexto y referencias
Hallazgos de la revisión del código (2026-11-08):
- Cancelación: `common/postsale-rules.ts:37-51`. La reembolsable devuelve el total menos `POSTSALE_CANCEL_PENALTY_PERCENT` (10 % por defecto, `common/vuelos-config.ts:137`). La no reembolsable devuelve los impuestos. Booking espera el total en la reembolsable.
- CloudEvent `booking.cancelled` (`common/cloud-events.ts:74-75`): solo lleva `reasonCode`, `refundId`, `refundAmount` y `seatsReleased`. No lleva `paymentReference`, `currency` ni penalidad, aunque el evento de dominio sí los trae (`services/cancellation.service.ts:146-160`).
- Webhooks: el dashboard solo tiene contadores (`dashboard.service.ts`, `AdminDashboardPage.tsx:221-233`). No hay endpoint ni pantalla admin de suscripciones o entregas.
- Cuadre: la reserva v2 guarda `totalMinor` (impuestos incluidos) y el hold `lockedTaxesMinor`. No existe un reporte por `partnerOrderId`. La factura al cliente la emite Booking (nuestro precio más su cargo).
- Push de stock: su estado solo aparece en los logs (`v2/stock-push.service.ts`).
- Despliegue: `BOOKING_WEBHOOK_URL`/`SECRET` están comentadas en `deploy/azure/.env.azure.example`. `CHECKIN_CLOSES_HOURS` vale 1 por defecto (v2 necesita 0). Con `MIN_REPLICAS` en 0, mientras el contenedor duerme no corren los jobs.

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `.env.example`, `deploy/azure/.env.azure.example`, `deploy/azure/README.md` | `POSTSALE_CANCEL_PENALTY_PERCENT=0`, `CHECKIN_CLOSES_HOURS=0`, variables de Booking y `MIN_REPLICAS=1` documentadas |
| `common/cloud-events.ts` | `booking.cancelled` añade `paymentReference`, `currency`, `penaltyAmount` y `reason` |
| `ecommerce/admin/admin.service.ts` | Al cancelar un vuelo, `reasonCode: 'FLIGHT_CANCELLED'` en el payload |
| `contracts/overlay/vuelos-v2-ram-alliance.overlay.yaml` | Campos opcionales nuevos en los datos del evento de cancelación |
| `ecommerce/admin/webhooks-admin.*` (nuevo) | `GET /admin/webhooks/suscripciones`, `GET /admin/webhooks/entregas`, `POST /admin/webhooks/entregas/:id/reintentar` |
| `v2/stock-push.service.ts`, `ecommerce/admin/observabilidad.service.ts` | `estado()` del push de stock y de la suscripción de Booking en `/admin/observabilidad/runtime` |
| `ecommerce/admin/reservas-admin.*` | Desglose base/impuestos/total/reembolso/penalidad y `GET /admin/reservas/export.csv` |
| `frontend/` (Antigravity) | Página de webhooks, desglose y botón CSV en el mostrador, tarjeta de stock en observabilidad |
| `docs/RDA2-docs/GUIA-PRUEBA-BOOKING.md` (nuevo), `docs/GUIA-DEFENSA-SWAGGER.md` | Runbook de las 12 pruebas y corrección de la referencia a webhooks |

## Impacto en la API / contrato
- Rutas admin nuevas (v1): suscripciones y entregas de webhooks, reintento de una entrega, export CSV del mostrador. Requieren regenerar `contracts/vuelos-ecommerce-openapi.yaml` (`npm run contract:export`).
- v2: campos opcionales nuevos en los datos de `booking.cancelled`. Es compatible (`npm run contract:v2:build`, `npm run contract:events:check`).
- `contracts/vuelos-openapi.yaml` (v1 GDS) no cambia.

## Pasos
1. Configuración y documentación de variables (penalidad 0, check-in 0, Booking, réplicas).
2. CloudEvent `booking.cancelled` y overlay del contrato v2.
3. Endpoints admin de webhooks con su spec de integración (401/403/200, listar, filtrar, reintentar).
4. Estado del push de stock en observabilidad.
5. Desglose y CSV en el mostrador.
6. Frontend (Antigravity) sobre las rutas nuevas.
7. Regenerar contratos, escribir el runbook, y pasar lint, build y tests.

## Riesgos y decisiones abiertas
- La penalidad 0 aplica a todas las reembolsables, también a las de la web. Fue una decisión del equipo para esta fase.
- Un rechazo por datos inválidos no libera el hold. Los asientos quedan retenidos hasta que Booking lo libera o lo barre el sweeper (5 min). Queda documentado en el runbook.
- El estado del push de stock es local al proceso y se reinicia en cada arranque.

## Verificación
- `npm run lint`, `npm run build`, `npm test` con `TEST_DATABASE_URL`: `booking-plan`, `v2`, `contract-v2-build`, `contract` y el spec nuevo de webhooks admin.
- Cancelación con penalidad 0: `FULL` devuelve el 100 %, `BASIC` solo los impuestos, y el CloudEvent lleva `paymentReference`, `currency` y `penaltyAmount`.
- Manual en local: crear un vuelo, comprar como socio (OAuth2), ver la reserva en el mostrador y la entrega en la página de webhooks, cancelar, revisar el CSV y ver el estado del stock.
- Ensayo propio contra producción de las pruebas 1-3 y 7-9 antes de la sesión.
