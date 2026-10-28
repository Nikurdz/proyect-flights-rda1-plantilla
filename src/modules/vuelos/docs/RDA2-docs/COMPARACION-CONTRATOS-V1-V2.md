# Contrato v1.5 → v2 (`contracts/vuelos-openapi-v2.yaml`)

Comparación hecha con un diff estructural de los dos YAML (22 operaciones de v1, 30 de v2, 39 → 79 esquemas) antes de programar, para no repetir lo que ya cubría v1. **v1 no cambió** (`/api/v1`, frontend y sus pruebas siguen iguales); v2 vive en `/api/v2/vuelos` sobre los mismos servicios. Documentación navegable del v2: `/api/docs-v2`.

## Qué era igual y se reutilizó
Las 22 operaciones de v1 existen en v2 con el mismo verbo y ruta relativa. 14 esquemas solo cambian en descripciones o ejemplos (búsqueda, ofertas, equipaje, cambio de fecha, cotización). La lógica de negocio (búsqueda, hold, reserva, postventa, check-in, webhooks) es la misma: v2 solo cambia la entrada y el formato.

## Qué cambió y cómo quedó
| Área | v2 pide | Estado |
|---|---|---|
| Ruta | `/api/v2/vuelos/<ruta>`, conviviendo con `/api/v1` | Hecho: `setGlobalPrefix('api')` + versionado URI (`defaultVersion: '1'`) |
| Seguridad | `PartnerOAuth2` `client_credentials`, scopes, `X-User-Id`/`X-User-Roles` | Hecho: `POST /api/v2/oauth2/token` (form, JSON o Basic), tabla `vuelos_partner_clients` (secreto con scrypt), `PartnerAuthGuard` + `@RequiresScope`. El usuario de Booking es `partner:<cliente>:user:<id>`; un webhook del socio oye a todos sus usuarios. Un JWT de la plataforma sirve como la alternativa `BearerAuth` (ADMIN = todos los scopes) |
| Errores | `ProblemDetails` + `instance`, `correlation_id`, `timestamp`; 11 códigos nuevos | Hecho: `VuelosProblemDetailsV2Filter`; el servicio declara el código v2 con `ProblemDetailsException.forV2()` (HOLD_EXPIRED, HOLD_ALREADY_CONSUMED, IDEMPOTENCY_KEY_REUSED 409, FLIGHT_CANCELLED, INFANT_WITHOUT_ADULT, PASSENGER_COUNT_MISMATCH, DOCUMENT_EXPIRED, PASSPORT_REQUIRED_INTERNATIONAL, BOOKING_NOT_CANCELLABLE, INVALID_STATUS_TRANSITION, PROMOTION_DISCOUNT_OUT_OF_RANGE) |
| Cabeceras | `X-Request-Id`, `Idempotent-Replayed`, replay = 200, correlación también en 401/403 | Hecho (`V2HeadersInterceptor`) |
| `health`, `eventos` | semáforo del nodo; feed de CloudEvents con cursor | Hecho (`HealthV2Service`, tabla `vuelos_outbox`) |
| `promociones/contrato` | GET/PUT del acuerdo B2B | Hecho (tablas `vuelos_promocion_*`); una venta con `promotionApplied` se valida contra él |
| `PATCH flights/{n}/status` | transiciones, demora, puerta, cancelación | Hecho: `Vuelo.estado` con los 7 estados + `retrasoMinutos`, `salidaEstimada`, `llegadaEstimada`, `puertaSalida`; CANCELLED reutiliza la cancelación administrativa (reembolsos) |
| `operaciones/vuelos` | ocupación por cabina, holds, alertas | Hecho (`FlightOpsV2Service`) |
| `POST bookings/{id}/tickets` | emisión idempotente | Hecho: ya emitidos → `issued: 0` |
| `PUT bookings/{id}/seats` | cambio atómico de asientos | Hecho (`SeatChangeV2Service`); los asientos no cuestan en esta fase |
| Esquemas | `ttlMinutes` 5–30, `_links`, `salesChannel`, `payment.amount/provider` (`AMOUNT_MISMATCH`), detalle con `holdId`/`paymentReference`, asiento con `status`, boletos con segmentos, `gate`, cancelación sin `quoteId` y con reembolso/inventario | Hecho |
| Eventos | CloudEvents v1.0, firma HMAC del cuerpo, 15 tipos, outbox | Hecho: la versión de firma va por suscripción (`apiVersion`): v1 conserva `timestamp.body` |
| Eventos entrantes | `pagos.payment.confirmed/failed`, `paquetes.package.cancelled` | Hecho por RabbitMQ (`q.vuelos.entrantes`); idempotentes |
| Stock gRPC | `inventory.proto`: `PushStockUpdate` + `StreamInventoryChanges` | Hecho: `StockPushService`, activo con `GRPC_STOCK_URL` |

## Diferencias que conviene saber
- **Check-in**: v2 lo cierra a la hora de salida; el valor por defecto sigue en 1 h (`CHECKIN_CLOSES_HOURS=1`, como v1). Para v2 pon `CHECKIN_CLOSES_HOURS=0`.
- **Emisión**: la reserva se emite en la misma transacción, así que `POST /bookings` responde siempre 201 (nunca 202 `TICKET_ISSUING`).
- **Asientos**: un hold no fija asientos concretos, así que el mapa solo distingue `AVAILABLE`, `BOOKED`/`TICKETED`, `CHECKED_IN` y `BOARDED` (HELD solo cuenta en la ocupación del panel).
- **`ticketId`**: es un UUID (acepta también el prefijo `TKT-`).
- **`BookingDetail`** no incluye `itineraries` ni `passengers` (son opcionales en el contrato; evita exponer datos personales).
- **Stock**: `time_slot` va en UTC; la cabina es siempre ECONOMY.
- **Outbox**: se escribe al anunciar el evento (después del commit), no dentro de la transacción; sin RabbitMQ los eventos entrantes no llegan (las operaciones equivalentes siguen disponibles por REST).
- **Pasaporte**: se exige solo en v2 (v1 no lo comprobaba); se decide con el país de las localidades de origen y destino.

## Pruebas
`testing/v2.integration.spec.ts` (flujo completo con token de socio, errores v2, replay, asientos, cancelación, promociones, operaciones, eventos, webhooks CloudEvents, eventos entrantes), `testing/contract-v2.integration.spec.ts` (las 30 operaciones del YAML existen y exigen el scope que el contrato nombra) y `testing/stock-grpc.integration.spec.ts` (servidor gRPC en proceso).

## Configuración nueva
`PARTNER_CLIENT_ID` / `PARTNER_CLIENT_SECRET` (≥ 24 caracteres; el seed crea el cliente), `GRPC_STOCK_URL` (+ `GRPC_STOCK_TLS=true`), `NODE_ID`, `NODE_SOURCE`, `EVENT_SCHEMA_MODE`. Migración: `ContractV2` (aditiva, con `down`).

## Nuestro contrato para Booking (`contracts/vuelos-openapi-v2-ram-alliance.yaml`)
La plantilla de Booking (`vuelos-openapi-v2.yaml`) no se toca. Nuestro contrato se **genera** con `npm run contract:v2:build` a partir de la plantilla, el parche `contracts/overlay/vuelos-v2-ram-alliance.overlay.yaml` y `scripts/build-contract-v2.js`: ids UUID con ejemplos válidos, sin 202, 403/429 en cada operación, el endpoint `POST /oauth2/token`, servidores (Tailscale), callbacks de webhooks con firma y cabeceras, los 15 CloudEvents, eventos entrantes (`x-asyncapi-inbound`), gRPC (`x-grpc-stock`) y una nota de implementación por operación. Se valida como OpenAPI 3.0.3, se comprueba que está al día y las respuestas reales de la API se validan contra sus esquemas (`testing/contract-v2-*.ts`). Se sirve en `/api/docs-v2`.
