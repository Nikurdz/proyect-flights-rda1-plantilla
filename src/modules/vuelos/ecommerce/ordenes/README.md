# ecommerce/ordenes/ — Saga de compra, órdenes y reconciliación

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `compras.service.ts` | Saga: bloquear oferta → revalidar → autorizar pago → orden+reserva+billetes+hold en UNA transacción → capturar; compensa si falla |
| `ordenes.service.ts` | Consulta, vista, transiciones (reembolso, modificación) |
| `reconciliacion.service.ts` | Cada 60 s: captura/anula pagos pendientes, reanuncia órdenes sin aviso |
| `ordenes.controller.ts` | Rutas de compra y órdenes |
| `dto/ordenes.dto.ts` | DTO |
| `entities/orden.entity.ts`, `orden-historial.entity.ts` | `ecom_ordenes`, `ecom_orden_historial` |
| `ordenes.module.ts` | Módulo Nest |

## Endpoints (`/api/v1`)
`POST ofertas/:id/compra` (Idempotency-Key) · `GET ordenes`, `GET ordenes/:numero` · `GET tickets/verificar` (QR público) · `POST|GET clientes/:id/ordenes`.

## Eventos
Publica `OrdenEmitida`, `OrdenFallidaCompensada`; sigue `booking.cancelled`, `booking.changed` y `PagoReembolsado`.

## Cómo se conecta
Un reintento reanuda por estado (no cobra ni emite dos veces); las precondiciones lanzan, los resultados de negocio se guardan y se repiten. Usa [../pagos/](../pagos/README.md), [../facturacion/](../facturacion/README.md) y [../ofertas/](../ofertas/README.md); registra pasos en [../observabilidad/](../observabilidad/README.md).

## Cuaderno y auditorías
Auditoría C13: [índice](../../docs/RDA2-docs/auditorias/README.md).

## Más a fondo
[ecommerce](../README.md) · [módulo vuelos](../../README.md) · [Arquitectura de eventos](../../docs/ARQUITECTURA-EVENTOS.md)

← Volver a [../README.md](../README.md)
