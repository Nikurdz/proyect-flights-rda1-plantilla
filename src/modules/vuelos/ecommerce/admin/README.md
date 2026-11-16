# ecommerce/admin/ — Back office (solo rol ADMIN; único lugar que lee entre clientes)

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `admin.controller.ts` / `admin.service.ts` | Órdenes, vuelos (crear/editar/borrar/cancelar/reprogramar), asientos |
| `vuelos-admin.service.ts` | Alta/edición/borrado de vuelos (`409 FLIGHT_IN_USE`) |
| `reservas-admin.*` | Mostrador: reservas de todos los canales, check-in, cancelación |
| `usuarios.*` | Usuarios y roles (`409 LAST_ADMIN`) |
| `aeropuertos-admin.*` | Listar/crear aeropuertos (`confirmar: true`) |
| `trazabilidad.*` | Línea de tiempo unificada, flujo y mapa (solo lectura) |
| `booking-conciliacion.*` | Ventas de socios como líneas de factura, NC, alerta de IVA |
| `webhooks-admin.*` | Suscripciones y entregas de webhooks |
| `observabilidad.*` | Resumen (BD), runtime (contadores), `health` |
| `dashboard.*` | Panel con métricas |
| `admin.dto.ts`, `admin-*.dto.ts`, `*.dto.ts` | DTO de entrada/salida |
| `admin.module.ts` | Cablea todo lo anterior |

## Endpoints (prefijo `/api/v1`)
`admin/ordenes[/:numero]` · `admin/vuelos` (GET/POST), `admin/vuelos/:id` (PATCH/DELETE), `…/:id/cancelar|reprogramar|asientos` · `admin/reservas[/:id]`, `…/export.csv`, `…/:id/check-in|cotizacion-cancelacion|cancelar` · `admin/usuarios[/:id]`, `PUT …/:id/roles` · `admin/aeropuertos` · `admin/trazabilidad` (`/flujo`, `/mapa`, `/export.csv`) · `admin/facturacion-booking` (`/resumen`, `/export.csv`) · `admin/webhooks/suscripciones|entregas` (+ `entregas/:id/reintentar`) · `admin/observabilidad` (`/resumen`, `/runtime`, `/live`) · `admin/dashboard` · `health`.

## Eventos y tablas
Publica `booking.cancelled`, `booking.changed`, `flight.cancelled`, `flight.schedule_changed`. Cada cambio queda en `auditoria_administrativa`. Lee `auditoria_transacciones` y `auditoria_sagas`.

## Cómo se conecta
Actúa sin ser dueño con `asAdmin` de `BookingContextService` ([../../services/](../../services/README.md)). Fuentes de la trazabilidad: [../observabilidad/](../observabilidad/README.md); mapa de componentes en `../../common/topologia.ts`.

## Cuaderno y auditorías
Semana 10 (trazabilidad/observabilidad) y 11 (usuarios/roles): [cuaderno](../../docs/RDA2-docs/auditorias/RETO-2-CUADERNO/README.md). Auditorías C06, C09, C10, C11: [índice](../../docs/RDA2-docs/auditorias/README.md).

## Más a fondo
[ecommerce](../README.md) · [módulo vuelos](../../README.md) · [Modelo de datos](../../docs/MODELO-DE-DATOS.md)

← Volver a [../README.md](../README.md)
