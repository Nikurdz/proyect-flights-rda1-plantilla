# ecommerce/catalogo/ — Aeropuertos, disponibilidad y tarifas de búsqueda

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `catalogo.controller.ts` | Rutas de búsqueda |
| `catalogo.service.ts` | Localidades y disponibilidad (día calendario de Ecuador) |
| `precios.service.ts` | Precios y desglose por tipo de pasajero |
| `dto/catalogo.dto.ts` | Parámetros (`adt`, `chd`, `yth`, `inf`) |
| `entities/localidad.entity.ts` | Tabla `ecom_localidades` (aeropuertos) |
| `catalogo.module.ts` | Módulo Nest |

## Endpoints (`/api/v1`)
`GET localidades` (sin texto: catálogo completo; con texto: prefijo, máx. 10) · `GET disponibilidad` · `GET itinerarios/:id/tarifas`.

## Cómo se conecta
Busca con `SearchService` del núcleo ([../../services/](../../services/README.md)). Los aeropuertos se siembran en [../seed/](../seed/README.md); el admin los crea en [../admin/](../admin/README.md). El joven (`yth`) paga tarifa adulta.

## Cuaderno y auditorías
Auditorías C09 (aeropuertos y hora Ecuador), C10 (edades), C12 (fecha local): [índice](../../docs/RDA2-docs/auditorias/README.md).

## Más a fondo
[ecommerce](../README.md) · [módulo vuelos](../../README.md) · [Modelo de datos](../../docs/MODELO-DE-DATOS.md)

← Volver a [../README.md](../README.md)
