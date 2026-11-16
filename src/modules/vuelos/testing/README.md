# testing — pruebas de integración y de contrato

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `integration-app.ts` | Levanta el `VuelosModule` real; limpia variables que cambian el comportamiento y aplica solo lo que la suite pasa |
| `vuelos`, `ecommerce`, `postventa`, `hold-reholding`, `jovenes`, `nacionales`, `ecuador-time`, `demo-scenarios` (`.integration.spec.ts`) | Flujos del núcleo y del e-commerce |
| `v2`, `contract-v2`, `v2-offset`, `v2-rendimiento`, `stock-http`, `stock-grpc`, `booking-plan`, `booking-prueba` (`.integration.spec.ts`) | API v2 y Booking |
| `admin-*`, `bff`, `gateway`, `integracion`, `trazabilidad`, `service-role` (`.integration.spec.ts`) | Back office, BFF, GraphQL, proveedores, trazabilidad, roles de servicio |
| `contract.integration.spec.ts`, `contract-v2-build.spec.ts` | Contrato OpenAPI: falla si el YAML generado quedó viejo |
| `contract-v2-validator.ts`, `partner-falso.ts` | Ayudantes: valida respuestas v2; socio falso |

## Tipos y cómo correrlas

- **Unitarias** (`*.spec.ts` junto al código, también en `common/`): `npm test`.
- **Integración** (`*.integration.spec.ts`): Postgres real, **un schema por suite**, borrado al final. Se omiten sin `TEST_DATABASE_URL` (base desechable, p. ej. `booking_test`, nunca la de desarrollo).
- Una: `npx jest src/modules/vuelos/testing/vuelos.integration.spec.ts`. En Windows, abrir Docker Desktop (`docker start booking_db_container`) si da `ECONNREFUSED`.
- Si cambia hold, reserva o pago, córralas: cubren concurrencia, idempotencia y la saga.

## Más a fondo

- [Guía de prueba con Booking](../docs/RDA2-docs/GUIA-PRUEBA-BOOKING.md) · [contracts/](../../../../contracts/README.md)

← Volver a [vuelos](../README.md)
