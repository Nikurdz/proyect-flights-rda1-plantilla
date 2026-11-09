# Plan de implementación: conciliación de las facturas de Booking y validaciones de edad

- **Fecha:** 2026-11-09
- **Agente:** Claude Code Desktop (backend) y Antigravity (pantallas)
- **Área:** backend / admin / frontend
- **Rama:** `vuelos`

## Objetivo
1. El administrador quiere verificar en el panel las facturas de Booking. No emitimos facturas por sus ventas (Booking factura con IVA 15 % incluido y no nos envía datos fiscales del cliente), así que se construye una **vista de conciliación de solo lectura**.
2. Validar las edades de los pasajeros (frontend y ajustes pequeños de backend).

## Decisiones
- Conciliación derivada de las reservas de socio, sin cambio de esquema: cada venta como línea de factura, **nota de crédito derivada** de una cancelación (`NC-<pnr>`), nuestro IVA junto al que calcularía Booking, alerta si no cuadra (tolerancia de un centavo por pasajero y tramo), equipaje y cambios de fecha, resumen por día de Ecuador y CSV.
- Edades: el backend rechaza la fecha de nacimiento futura, comprueba el tipo también en el último vuelo y nombra el campo en el error (`invalidParams`); el frontend replica la regla y añade el contador de Jóvenes (12-17).

## Cambios
| Archivo | Cambio |
|---|---|
| `ecommerce/admin/booking-conciliacion.{dto,service,controller}.ts`, `admin.module.ts` | `GET /admin/facturacion-booking`, `/resumen`, `/export.csv` |
| `common/business-rules.ts`, `bookings.service.ts`, `ofertas.service.ts` | Regla de edad |
| `testing/admin-facturacion-booking.integration.spec.ts`, `business-rules.spec.ts` | Pruebas |
| `frontend/…` | Pestaña «Booking» y validaciones (ver las dos entregas `2026-11-09-*-frontend.md`) |

## Impacto
Rutas nuevas bajo `/api/v1/admin/facturacion-booking` (OpenAPI regenerado). Reservas v1/v2 y web: un tipo de pasajero que deja de corresponder a la edad antes del último vuelo, o una fecha de nacimiento futura, devuelven 422 con el campo.

## Verificación
Pruebas de backend y de frontend, `lint`, `build`, `contract:export`.
