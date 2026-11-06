# Plan de implementación: observaciones de Booking (plan de pruebas del 04-nov)

- **Fecha:** 2026-11-05
- **Agente:** Claude Code Desktop
- **Área:** backend / base de datos / contrato v2
- **Rama:** `vuelos`

## Objetivo
Booking probó la API v2 de RAM Alliance de punta a punta y dejó observaciones y un plan de pruebas (A-01…A-16 automáticas, P-01…P-08 manuales) para la defensa. Se atienden todas.

## Alcance
- Incluye: desglose de precio, cursor del feed, `partnerOrderId` en eventos, 404 para reserva ajena, webhooks del socio, validación de la cédula, pasajero único por documento, mostrador en el back office (API), estado del vuelo desde el back office, suite propia A-01…A-16.
- No incluye: las pantallas del frontend (las hace Antigravity, ver `2026-11-05-mostrador-frontend.md`) ni el diagnóstico en producción de los webhooks (requiere autorización para consultar la base de Aiven).

## Decisiones
- `lockedPrice` (hold) y `grandTotal` (reserva) llevan `baseFare` e `taxes` cuando el hold los guardó (`moneyAmount` en `common/money.util.ts`); `payment.amount` acepta que el socio reenvíe el `lockedPrice` completo.
- `metadata.next_after` del feed es el `id` del último evento; `after` sigue aceptando el formato antiguo `evt-vue-N`.
- Los eventos `booking.*` llevan `partnerOrderId` (campo opcional nuevo en sus JSON Schemas, compatible). El evento de check-in usa el dueño de la reserva, no el de quien llama (así llega al socio aunque lo haga el mostrador).
- v2: la reserva de otro usuario responde 404 (v1 sigue en 403).
- Webhooks de un socio pertenecen a `partner:<id>` aunque llegue `X-User-Id`; se listan, borran y escuchan igual desde cualquier usuario, y las suscripciones antiguas hechas por usuario siguen oyendo los eventos del socio. Sondeo del despachador: 15 s por defecto.
- Cédula: módulo 10 solo para `NATIONAL_ID` con nacionalidad `EC` (reservas v2/v1 y pasajeros de la web), después de la regla de pasaporte internacional. La cédula de **facturación** no se valida (la observación era del pasajero y los datos de demo usan números de prueba).
- Pasajero único: tabla `vuelos_travellers` con un índice ciego (HMAC-SHA256 de `tipo|nacionalidad|número normalizado`, clave derivada por HKDF de la clave de cifrado) y `vuelos_passengers.travellerId`. No guarda datos legibles. La migración rellena los pasajeros existentes descifrando sus documentos con la clave de la app.
- Mostrador (ADMIN): `GET /admin/reservas`, `GET /admin/reservas/:id`, `POST /admin/reservas/:id/check-in`, `GET /admin/reservas/:id/cotizacion-cancelacion`, `POST /admin/reservas/:id/cancelar` (Idempotency-Key), y `PATCH /admin/vuelos/:id/estado`. Actúan con `asAdmin` sobre `BookingContextService`, `CheckInService` y `CancellationService`; cada acción queda en `auditoria_administrativa`.
- Un vuelo `DELAYED` sigue en la búsqueda (antes desaparecía); solo `CANCELLED` o ya salido lo cierran.
- `payment.provider` se guarda (`paymentProvider`) y se añade un índice por `channelPartnerOrderId`.

## Cambios
| Archivo / módulo | Cambio |
|---|---|
| `common/money.util.ts`, `services/offers.service.ts`, `v2/booking-view-v2.service.ts`, `dto/booking.dto.ts` | Desglose de precio |
| `v2/outbox-v2.service.ts` | `next_after` = id del último evento |
| `services/{bookings,cancellation,check-in,baggage,date-change}.service.ts`, `contracts/eventos/booking.*.json` | `partnerOrderId` en eventos |
| `services/booking-context.service.ts` | 404 en v2 y opción `asAdmin` |
| `services/webhooks.service.ts`, `services/webhook-dispatcher.service.ts` | Webhooks del socio |
| `common/business-rules.ts`, `bookings.service.ts`, `ofertas.service.ts` | Cédula |
| `entities/traveller.entity.ts`, `common/travellers.ts`, `common/cifrado.ts`, migración `PassengerTravellers` | Pasajero único |
| `ecommerce/admin/reservas-admin.*`, `v2/admin-estado-vuelo.controller.ts`, `services/search.service.ts` | Mostrador y estado del vuelo |
| `contracts/overlay/…`, contrato v2 y OpenAPI exportados | Documentación del contrato |

## Impacto en la API / contrato
Contrato v2: campos opcionales nuevos (desglose, `partnerOrderId`), `nationality` con patrón, 404 de reserva ajena. API v1: solo campos opcionales nuevos y el nuevo orden de validación; las rutas `/admin/*` nuevas están en el OpenAPI exportado.

## Verificación
`npm run lint`, `npm run build`, `npm test` (incluye `booking-plan.integration.spec.ts` con A-01…A-16 y `admin-reservas.integration.spec.ts`), `npm run contract:events:check`, `npm run contract:v2:build`, `migration:check:vuelos` en 0 y la migración probada con pasajeros del esquema anterior (dos pasaportes escritos distinto quedan como una sola persona).

## Despliegue
Antes de desplegar: copia de seguridad de Aiven y `DATA_ENCRYPTION_KEY` presente en Azure. La migración descifra los pasajeros existentes para construir el índice.
