# ecommerce/facturacion/ — Facturas de órdenes y reservas externas (IVA)

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `facturacion.service.ts` | `emitir`: escribe factura + detalles dentro de la transacción de emisión (una línea por tramo y tipo de pasajero) |
| `facturacion-admin.controller.ts` | Consulta admin |
| `entities/factura.entity.ts` | `ecom_facturas` |
| `entities/factura-detalle.entity.ts` | `ecom_factura_detalles` |
| `entities/datos-facturacion.entity.ts` | `ecom_datos_facturacion` (identidad de facturación compartida) |
| `facturacion.module.ts` | Módulo Nest |

## Endpoints
`GET /api/v1/admin/facturas` · `GET /api/v1/admin/facturas/:numero` (ADMIN).

## Cómo se conecta
IVA = componente de impuesto de la cotización; subtotal + IVA = lo cobrado, si no, no se emite. La factura pertenece a una orden **o** a una reserva externa. La llama [../ordenes/](../ordenes/README.md) (y la saga de [../integracion/](../integracion/README.md)). La conciliación con Booking está en [../admin/](../admin/README.md).

## Cuaderno y auditorías
Auditoría C10 (facturación Booking y edades): [índice](../../docs/RDA2-docs/auditorias/README.md).

## Más a fondo
[ecommerce](../README.md) · [módulo vuelos](../../README.md) · [Modelo de datos](../../docs/MODELO-DE-DATOS.md)

← Volver a [../README.md](../README.md)
