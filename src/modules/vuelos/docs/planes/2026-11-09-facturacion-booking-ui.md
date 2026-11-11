# Plan de implementación: pestaña «Booking» de conciliación en Facturación

- **Fecha:** 2026-11-09
- **Agente:** Antigravity
- **Área:** frontend
- **Rama:** `vuelos`

## Objetivo
Dar al administrador una vista de solo lectura para verificar las ventas de Booking como líneas de factura (nota de crédito, IVA propio vs. el de Booking, alertas, resumen diario y CSV), según `2026-11-09-facturacion-booking-frontend.md`.

## Alcance
- Incluye: hooks y tipos en `api/endpoints/facturacion-booking.ts`; página `AdminBookingBillingPage`; pestañas «Facturas» / «Booking» dentro de Facturación; ruta `/admin/facturacion-booking`; pruebas unitarias.
- No incluye: backend, contratos, emisión de facturas, validaciones de edad (otro agente).

## Contexto y referencias
Endpoints `GET /api/v1/admin/facturacion-booking`, `/resumen`, `/export.csv` (ADMIN, `application/problem+json`). Patrones: `AdminReservationsPage`, `facturas.ts`, `useExportarReservasCsv`.

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `frontend/src/api/endpoints/facturacion-booking.ts` | Tipos a mano y hooks `useConciliacionBooking`, `useResumenConciliacionBooking`, `useExportarConciliacionCsv` |
| `frontend/src/features/admin/AdminBookingBillingPage.tsx` | Filtros, tarjetas, tabla por día, tabla de ventas, alerta IVA, aviso fijo, truncado, CSV |
| `frontend/src/features/admin/BillingTabs.tsx` | Pestañas Facturas / Booking |
| `AdminInvoicesPage.tsx`, `routes/index.tsx`, `AdminLayout.tsx` | Pestañas, ruta nueva, la pestaña Facturación queda activa en ambas rutas |
| `frontend/src/features/admin/admin-errors.ts` | Contexto `exportar-conciliacion` |
| `frontend/tests/unit/admin-booking-billing-page.test.tsx` | Pruebas |

## Impacto en la API / contrato
Ninguno.

## Pasos
1. Hooks y tipos. 2. Página y pestañas. 3. Ruta y enlace. 4. Pruebas. 5. lint, tsc, build, test.

## Riesgos y decisiones abiertas
- `desde`/`hasta` son días de Ecuador: por defecto el mes en curso con `getTodayDateString()`.
- Importes `null` en ventas antiguas se muestran «—».

## Verificación
`npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm test` en `frontend/` en 0 errores; prueba manual contra el API en ejecución.
