# ecommerce/ — E-commerce R1 («Compra de vuelo») dentro del módulo Vuelos

Vive *dentro* de `VuelosModule` y vende desde el inventario del núcleo GDS en proceso. Especificación: `../docs/SRS_Plataforma_Ecommerce_LATAM.md`.

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `ecommerce.module.ts` | Agrega los 11 submódulos Nest (`imports: [...]`); no tiene lógica propia |
| [`mercados/`](mercados/README.md) | Mercado, reglas y medios de pago (solo `ec`, USD) |
| [`identidad/`](identidad/README.md) | Registro, login, invitado, roles |
| [`catalogo/`](catalogo/README.md) | Aeropuertos, disponibilidad y tarifas |
| [`ofertas/`](ofertas/README.md) | Oferta, checkout, pasajeros, asientos |
| [`pagos/`](pagos/README.md) | Pasarela simulada y antifraude |
| [`ordenes/`](ordenes/README.md) | Saga de compra, órdenes, reconciliación |
| [`facturacion/`](facturacion/README.md) | Facturas e IVA |
| [`notificaciones/`](notificaciones/README.md) | Correos simulados y plantillas |
| [`observabilidad/`](observabilidad/README.md) | Auditoría de eventos, sagas, peticiones HTTP |
| [`integracion/`](integracion/README.md) | Proveedores socios, experiencias, ACL |
| [`admin/`](admin/README.md) | Back office (mostrador, usuarios, vuelos, trazabilidad…) |
| [`bff/`](bff/README.md) | Vistas por cliente (móvil, web, expediente admin) |
| [`common/`](common/README.md) | Rate limit y utilidades compartidas |
| [`seed/`](seed/README.md) | Datos iniciales idempotentes |

`facturacion/` no está en `imports` de `ecommerce.module.ts`: lo importa `ordenes.module.ts`.

## Cómo se conecta
Cada submódulo importa `VuelosCoreModule` (nunca `VuelosModule`: sería circular). `../vuelos.module.ts` = núcleo + `EcommerceModule` + `VuelosController`. Los controladores usan `ProblemController(ruta, etiqueta)` y devuelven `application/problem+json`. Dinero en unidades menores enteras; esquema 3FN.

## Cuaderno y auditorías
Semanas 7-11: [`RETO-2-INTEGRACION-MI-SISTEMA.md`](../docs/RDA2-docs/auditorias/RETO-2-CUADERNO/RETO-2-INTEGRACION-MI-SISTEMA.md) (corto: `RETO-2-CORTO.md`). Auditorías C01-C14: [`auditorias/README.md`](../docs/RDA2-docs/auditorias/README.md).

## Más a fondo
[README del módulo vuelos](../README.md) · [README raíz](../../../../README.md) · [docs/README.md](../docs/README.md) · [Modelo de datos](../docs/MODELO-DE-DATOS.md) · [Arquitectura por capas](../docs/ARQUITECTURA-CAPAS.md)

← Volver a [../README.md](../README.md)
