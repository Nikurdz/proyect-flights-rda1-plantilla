# ecommerce/bff/ — Vistas de órdenes por cliente (solo lectura)

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `bff.controller.ts` | Tres controladores: móvil, web y expediente admin |
| `bff-ordenes.service.ts` | Arma cada vista reusando `OrdenesService` |
| `acciones.ts` | Acciones posibles (lee reglas puras de posventa; no ejecuta) |
| `mapeos.ts` | Transformaciones a cada formato |
| `dto/bff.dto.ts` | Formas de respuesta |
| `bff.module.ts` | Módulo Nest |

## Endpoints (`/api/v1`)
- `GET movil/ordenes[/:numero]`: compacto, `acciones` como códigos.
- `GET web/ordenes/:numero`: vista del dueño + importes, factura, estado de vuelo por tramo, `acciones` con `href`.
- `GET admin/ordenes/:numero/expediente` (ADMIN): pago, factura, transiciones, sagas y hasta 50 eventos; contacto siempre enmascarado.

## Cómo se conecta
Reusa `ordenPropia` (orden ajena = 404) de [../ordenes/](../ordenes/README.md). No escribe ni publica eventos. La web actual sigue usando `/ordenes`.

## Cuaderno y auditorías
Semana 8 (gateway/BFF): [cuaderno](../../docs/RDA2-docs/auditorias/RETO-2-CUADERNO/README.md). Auditoría C07: [índice](../../docs/RDA2-docs/auditorias/README.md).

## Más a fondo
[ecommerce](../README.md) · [módulo vuelos](../../README.md) · [Arquitectura por capas](../../docs/ARQUITECTURA-CAPAS.md) · [gateway](../../gateway/README.md)

← Volver a [../README.md](../README.md)
