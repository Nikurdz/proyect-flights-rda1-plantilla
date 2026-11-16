# entities — tablas del núcleo (TypeORM)

Esquema normalizado (3FN, llaves foráneas reales). Las tablas del e-commerce están en cada subdominio de `ecommerce/`.

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `vuelo.entity.ts`, `aerolinea.entity.ts`, `fare-family.entity.ts` | Vuelos, aerolíneas, familias tarifarias |
| `flight-offer*.entity.ts` | Oferta de búsqueda e itinerarios |
| `flight-hold*.entity.ts` | Hold, sus ítems y los **asientos apartados** (`flight-hold-seat`) |
| `booking.entity.ts`, `booking-cambio.entity.ts`, `passenger.entity.ts`, `traveller.entity.ts` | Reserva (PNR), cambios, pasajeros y documento de viaje (índice ciego) |
| `ticket.entity.ts`, `seat-assignment.entity.ts`, `check-in.entity.ts` | Billetes, asientos vendidos, check-in |
| `baggage-purchase`, `date-change-offer`, `cancellation-quote` (`.entity.ts`) | Posventa |
| `idempotency-record.entity.ts` | Claves de idempotencia |
| `webhook-subscription`, `webhook-delivery`, `outbox-event` (`.entity.ts`) | Webhooks y feed de eventos |
| `partner-client.entity.ts`, `promocion-contrato.entity.ts` | Clientes OAuth2 de socios; promociones v2 |

## Cómo se conecta

- Las columnas hijas (pasajeros de oferta, inventario del hold…) se leen con los loaders de `../common/hold-loader.ts`.
- Dinero en `*Minor` (bigint, `common/bigint.transformer.ts`). Los cambios de esquema exigen migración en `../migrations/`.

## Más a fondo

- [Modelo de datos (generado)](../docs/MODELO-DE-DATOS.md) · [Migraciones](../migrations/README.md)

← Volver a [vuelos](../README.md)
