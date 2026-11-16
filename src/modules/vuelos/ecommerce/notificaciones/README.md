# ecommerce/notificaciones/ — Correos transaccionales (canal simulado)

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `notificaciones.service.ts` | Se suscribe a eventos y arma/envía el aviso |
| `notificaciones.controller.ts` | Consulta admin |
| `ports/mensajeria.port.ts` | Puerto del canal de correo (adaptador simulado) |
| `entities/notificacion.entity.ts` | `ecom_notificaciones` (cuerpo cifrado) |
| `entities/plantilla.entity.ts` | `ecom_plantillas_notificacion` |
| `notificaciones.module.ts` | Módulo Nest |

## Endpoints
`GET /api/v1/admin/notificaciones` (ADMIN).

## Eventos que consume
`ClienteRegistrado`, `CuentaBloqueada`, `OrdenEmitida`, `OrdenFallidaCompensada`, `PagoReembolsado`, `booking.cancelled`, `booking.changed`. Los correos usan hora de Ecuador.

## Cómo se conecta
El reconciliador de [../ordenes/](../ordenes/README.md) vuelve a anunciar órdenes sin confirmación. Bus: `DomainEventBus` del núcleo ([../../services/](../../services/README.md)). Plantillas: [../seed/](../seed/README.md).

## Más a fondo
[ecommerce](../README.md) · [módulo vuelos](../../README.md)

← Volver a [../README.md](../README.md)
