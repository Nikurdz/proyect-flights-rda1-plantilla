# Entrega para Antigravity: pantallas del mostrador (back office)

- **Fecha:** 2026-11-05
- **De:** Claude Code Desktop (backend) **a:** Antigravity (frontend)
- **Rama:** `vuelos`

Booking hará pruebas manuales con una persona en su web y otra en la nuestra (P-02…P-08). Hacen falta dos pantallas de administración (rol ADMIN) conectadas a estos endpoints, ya implementados (`/api/v1/admin/...`, Bearer del administrador, errores `application/problem+json`). El OpenAPI completo está en `contracts/vuelos-ecommerce-openapi.yaml`.

## Pantalla «Reservas» (P-02, P-03, P-05, P-06, P-07)
Buscador + lista + detalle.

| Acción | Llamada |
|---|---|
| Listar / buscar | `GET /admin/reservas?pnr=&partnerOrderId=&paymentReference=&canal=SOCIO\|DIRECTO&documento=&tipoDocumento=NATIONAL_ID\|PASSPORT&nacionalidad=EC&pagina=1&limite=20` |
| Detalle | `GET /admin/reservas/{bookingId}` |
| Check-in de mostrador | `POST /admin/reservas/{bookingId}/check-in` (sin cuerpo; 409 fuera de la ventana de 48 h antes de la salida) |
| Cotizar cancelación | `GET /admin/reservas/{bookingId}/cotizacion-cancelacion` |
| Cancelar | `POST /admin/reservas/{bookingId}/cancelar` con cabecera `Idempotency-Key` (UUID) y cuerpo `{ "quoteId": "...", "reasonCode": "CUSTOMER_REQUEST" }` (ambos opcionales) |

Cada elemento de la lista trae: `bookingId`, `pnr`, `status`, `canal` (`SOCIO` = vendida por Booking, `DIRECTO` = nuestra web), `socio.partnerOrderId` (ORD-BKP-…), `paymentReference` (PAY-BKP-…), `paymentProvider`, `total`, `creadaEn`, `vuelos[]` (vueloId, codigoVuelo, origen, destino, salida, estado), `pasajeros[]` (nombre, tipoDocumento, `documento` enmascarado, `travellerId`, `asientos[]`, `checkIn`) y `billetes`.

- «El pasajero existe una sola vez con las dos reservas» (P-04): buscar por `documento` devuelve todas sus reservas, y todas comparten el mismo `travellerId`.
- Mostrar el canal, la orden del socio, el monto cobrado, la referencia de pago y los asientos (P-02), y un aviso si `canal = SOCIO` («esta reserva se ve en Booking en unos segundos»).
- Tras el check-in o la cancelación, refrescar la fila.

## Pantalla «Estado del vuelo» (P-08)
En la tabla de vuelos de administración, una acción «Estado»:

`PATCH /admin/vuelos/{vueloId}/estado` con `{ "status": "DELAYED", "estimatedDepartureAt": "2026-11-06T13:30:00Z", "departureGate": "B12", "reason": "..." }`.

- `status`: `SCHEDULED | BOARDING | DEPARTED | DELAYED | ARRIVED | CANCELLED | DIVERTED`; `DELAYED` exige `estimatedDepartureAt` (400 si falta); una transición no válida responde 409 (`INVALID_STATUS_TRANSITION`).
- Booking lo ve al consultar el estado del vuelo.

## Crear un vuelo para la prueba (P-01)
Ya existe: `POST /admin/vuelos` (UIO → GYE, fecha de mañana, capacidad pequeña) y su formulario. Un vuelo creado a mano aparece en la búsqueda de Booking.
