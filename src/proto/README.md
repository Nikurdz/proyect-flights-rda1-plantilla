# src/proto — contrato gRPC de stock

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `inventory.proto` | Servicio `InventoryStockService`: `PushStockUpdate` (un vuelo, `available_units`) y `StreamInventoryChanges` (flujo de cambios). Mensajes `StockUpdateMessage`, `StockUpdateAck`, `StockChangeEvent`, `StreamSummary` |

## Cómo se conecta

- Lo usa `modules/vuelos/v2/stock-push.service.ts` solo si hay `GRPC_STOCK_URL` (`GRPC_STOCK_TLS` para TLS). Si también hay `BOOKING_STOCK_URL`, gana HTTP.
- `nest-cli.json` copia este archivo a `dist/proto` al compilar.
- Solo se **empuja** stock a Booking; nunca se escribe `asientosDisponibles` desde ahí.

## Más a fondo

- [v2: stock push](../modules/vuelos/v2/README.md)
- [Plan stock por HTTP](../modules/vuelos/docs/planes/2026-11-03-stock-http.md)

← Volver a [src/README.md](../README.md)
