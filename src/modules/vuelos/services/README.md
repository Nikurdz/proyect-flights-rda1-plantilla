# services — lógica del núcleo GDS

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `search.service.ts` | Búsqueda de vuelos (día de Ecuador o del aeropuerto de origen) |
| `offers.service.ts` | Ofertas y holds; `createHoldWithin` corre dentro de la transacción del llamante |
| `inventory.service.ts` | Único escritor de `Vuelo.asientosDisponibles` (UPDATE condicional) |
| `bookings.service.ts` | Reservas y tickets; `createBookingWithin` bloquea y consume el hold |
| `booking-context.service.ts` | Carga/bloqueo/propiedad compartida de la reserva (`asAdmin`) |
| `baggage`, `date-change`, `cancellation`, `check-in` (`.service.ts`) | Posventa y check-in |
| `flight-status.service.ts` | Estado de vuelo |
| `holds-sweeper.service.ts` | Barrido de holds vencidos |
| `idempotency.service.ts` | `execute` (una transacción) y `executeSaga` (pasos con efectos externos) |
| `webhooks.service.ts`, `webhook-dispatcher.service.ts` | Suscripciones y entrega firmada con reintentos (job de 15 s) |

## Cómo se conecta

- Los exporta `../vuelos-core.module.ts`; los usan `../vuelos.controller.ts`, `../v2/` y `../ecommerce/` (la saga de compra).
- Reglas puras en `../common/` (`postsale-rules.ts`, `seat-rules.ts`, `business-rules.ts`). Errores: `ProblemDetailsException`.

## Más a fondo

- [common](../common/README.md) · [Arquitectura de eventos](../docs/ARQUITECTURA-EVENTOS.md) · [Plan posventa](../docs/planes/2026-10-07-posventa-checkin-webhooks.md)

← Volver a [vuelos](../README.md)
