# ecommerce/pagos/ — Pagos con pasarela y antifraude SIMULADOS (sin tarjeta real)

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `pagos.service.ts` | Autorizar, capturar, anular y reembolsar |
| `ports/pagos.ports.ts` | Puertos de pasarela y motor antifraude |
| `ports/simulated-adapters.ts` | Adaptadores simulados de ambos puertos |
| `entities/pago.entity.ts` | `ecom_pagos` (de una oferta/orden **o** reserva externa) |
| `entities/pago-antifraude-motivo.entity.ts` | `ecom_pago_antifraude_motivos` |
| `pagos.module.ts` | Módulo Nest |

## Eventos
`PagoAutorizado`, `PagoRechazado`, `PagoAnulado`, `PagoReembolsado`. Estados pendientes que reintenta el reconciliador: `CAPTURA_PENDIENTE`, `ANULACION_PENDIENTE`, `REEMBOLSO_PENDIENTE`.

## Cómo se conecta
Lo orquesta [../ordenes/](../ordenes/README.md) (compra) y [../integracion/](../integracion/README.md) (reservas externas). Reembolsa al oír `booking.cancelled`. No se captura tarjeta real.

## Más a fondo
[ecommerce](../README.md) · [módulo vuelos](../../README.md) · [Arquitectura por capas](../../docs/ARQUITECTURA-CAPAS.md)

← Volver a [../README.md](../README.md)
