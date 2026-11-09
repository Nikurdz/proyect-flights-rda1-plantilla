# Entrega para Antigravity: pestaña «Booking» en Facturación (conciliación)

- **Fecha:** 2026-11-09
- **De:** Claude Code Desktop (backend) **a:** Antigravity (frontend)
- **Rama:** `vuelos`

El administrador quiere ver y verificar en el panel las facturas de Booking. Booking factura por su lado (asume IVA 15 % **incluido**) y nosotros no emitimos facturas por sus ventas, así que se construye una **vista de conciliación de solo lectura**: cada venta como línea de factura, la nota de crédito derivada de una cancelación, nuestro IVA junto al que calcularía Booking, una alerta si el IVA no cuadra y el resumen por día. El backend ya está implementado y probado (`/api/v1/admin/facturacion-booking`, Bearer ADMIN, `application/problem+json`).

## API
| Acción | Llamada |
|---|---|
| Resumen | `GET /admin/facturacion-booking/resumen?desde=&hasta=&partnerId=` → `{ periodo, moneda, total, dias[], truncado }`; `total` y cada día: `ventas, base, iva, total, cancelaciones, reembolsos, penalidades, equipaje, cambiosFecha, neto, alertasIva` (importes como texto `"12.34"`) |
| Lista | `GET /admin/facturacion-booking?desde=&hasta=&partnerId=&estado=&soloAlertas=true&pagina=1&limite=25` → `{ items, total, pagina, limite }` |
| CSV | `GET /admin/facturacion-booking/export.csv` con los mismos filtros (descarga; ver `useExportarReservasCsv`, `apiBlob`, `saveBlob`) |

Cada `item`: `bookingId, pnr, fecha (día de Ecuador), partnerOrderId, paymentReference, estado, moneda, base, iva, ivaEsperado, ivaSegunBooking, diferenciaConBooking, ivaAlerta, total, notaCredito { numero, reembolso, penalidad } | null, equipaje, cambiosFecha { diferencias, cargo }`. `base`, `iva`, `ivaEsperado` y `diferenciaConBooking` son `null` en ventas antiguas sin impuestos guardados (no hay alerta en ese caso).

`desde` y `hasta` son **días de Ecuador** (`YYYY-MM-DD`, inclusive). `partnerId` es el client id del socio (`booking-prototipo`).

## Pantalla
1. Dentro de Facturación: dos pestañas, «Facturas» (la actual, `AdminInvoicesPage`) y **«Booking»** (nueva, ruta `/admin/facturacion-booking`, dentro de `RequireAdmin`; enlace en `AdminLayout.tsx`).
2. Filtros: desde, hasta (por defecto el mes en curso, en día de Ecuador con `getTodayDateString()`), socio (campo de texto, por defecto vacío), estado y casilla «Solo con IVA descuadrado».
3. Tarjetas del periodo: ventas, base, IVA, total cobrado, reembolsos, penalidades, equipaje + cambios de fecha, **neto** y número de alertas de IVA.
4. Tabla por día (`dias`) y tabla de ventas con columnas: fecha, PNR, orden del socio, pago, estado, base, IVA, IVA según Booking, total y **Nota de crédito** (`NC-…`, con reembolso y penalidad) para las canceladas. Una **insignia de alerta** («IVA no cuadra») cuando `ivaAlerta`, con el detalle: «Nuestro IVA X · 15 % de la base Y · Booking (incluido) Z». Paginación y estados de carga, vacío y error como `AdminReservationsPage.tsx`.
5. Botón «Exportar CSV» (mismos filtros).
6. Aviso fijo en pantalla: «Vista de conciliación: no es un documento fiscal. Las facturas las emite Booking (IVA 15 % incluido); aquí se comparan sus importes con los nuestros.»
7. Si `truncado` es `true`, avisar de que el resumen se calculó con las primeras 5000 ventas del periodo y conviene acotar las fechas.

## Convenciones
Hora de Ecuador en todo (`formatAdminDateTime`, `SYSTEM_TIME_ZONE`), importes con `MoneyText`, tipos a mano en `api/endpoints/` (hooks `useConciliacionBooking`, `useResumenConciliacionBooking`, `useExportarConciliacionCsv`; patrón de `facturas.ts` y de los hooks de reservas). Sin librerías nuevas.

## Pruebas
Siguiendo `tests/unit/admin-reservations-page.test.tsx` y `reservas.test.ts`: filtros → query, importes y alerta, columna de nota de crédito, exportación, y errores. `npm run lint`, `npx tsc --noEmit`, `npm run build` y `npm test` en `frontend/` en 0 errores.
