# ecommerce/ofertas/ — Oferta de compra: checkout, pasajeros, asientos, condiciones

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `ofertas.controller.ts` | Rutas del checkout |
| `ofertas.service.ts` | Crear oferta (con hold), revalidar precio, pasajeros, asientos, vencimiento |
| `oferta-loader.ts` | Carga los hijos de la oferta (necesario para los getters) |
| `dto/ofertas.dto.ts` | DTO de entrada |
| `entities/oferta.entity.ts` | `ecom_ofertas` |
| `entities/oferta-trayecto*.entity.ts` | `ecom_oferta_trayectos`, `ecom_oferta_trayecto_precios` |
| `entities/oferta-pasajero.entity.ts` | `ecom_oferta_pasajeros` (+ `_necesidades`, `_asientos`) |
| `entities/aceptacion-condiciones.entity.ts` | `ecom_aceptaciones_condiciones` |
| `ofertas.module.ts` | Módulo Nest |

## Endpoints (`/api/v1/ofertas`)
`POST /` · `GET :id` · `GET :id/asientos` · `DELETE :id` · `POST :id/revalidacion` · `POST :id/aceptacion-precio` · `PUT :id/pasajeros` · `PUT :id/facturacion` · `POST :id/condiciones` · `GET :id/medios-pago`.

## Eventos
`OfertaCreada`, `OfertaVencida`.

## Cómo se conecta
Crea el hold con `OffersService.createHoldWithin` del núcleo. Los asientos se apartan con el hold (`replaceHoldSeatsWithin`; `409 SEAT_TAKEN`). Se compra en [../ordenes/](../ordenes/README.md) (`POST ofertas/:id/compra`).

## Cuaderno y auditorías
Auditorías C12 (asientos) y C13 (holds): [índice](../../docs/RDA2-docs/auditorias/README.md).

## Más a fondo
[ecommerce](../README.md) · [módulo vuelos](../../README.md) · [Modelo de datos](../../docs/MODELO-DE-DATOS.md)

← Volver a [../README.md](../README.md)
