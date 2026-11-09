# Guía de la prueba de punta a punta con Booking

Runbook de la sesión final con Booking Prototipo: qué dejar listo antes, qué hacer en cada prueba y dónde se ve el resultado de nuestro lado. Las rutas son de `/api/v1` salvo que digan v2. Las pantallas son las del panel **Admin** del frontend.

## Antes de conectarse

1. **Despliegue encendido.** En Azure, `MIN_REPLICAS=1 ./crear.sh`: con la réplica dormida no salen ni el stock ni los webhooks. En Railway no hace falta.
2. **Variables** (Azure `.env.azure` o Railway):

   | Variable | Valor |
   |---|---|
   | `BOOKING_WEBHOOK_URL`, `BOOKING_WEBHOOK_SECRET` | las que dio Booking (secreto ≥ 16) |
   | `BOOKING_STOCK_URL` | ya configurada |
   | `BOOKING_STOCK_API_KEY` | si Booking la exige |
   | `PARTNER_CLIENT_ID` / `PARTNER_CLIENT_SECRET` | `booking-prototipo` / el acordado |
   | `CHECKIN_CLOSES_HOURS` | `0` (v2 cierra a la hora de salida) |
   | `POSTSALE_CANCEL_PENALTY_PERCENT` | `0` (la reembolsable devuelve todo) |
3. **Verificación rápida** en **Admin → Observabilidad → Integración con Booking** (`GET /admin/observabilidad/runtime`, `integrations`):
   - `booking-webhook.estado = SUSCRITO`.
   - `booking-stock.modo = HTTP` y una `ultimaRonda` con `enviados > 0` y sin `ultimoError`.
4. **Tarifas.** Cada vuelo ofrece las tres familias del seed:
   - `FULL`: **reembolsable**.
   - `BASIC` y `LIGHT`: **no reembolsables**.

   No hay que crear nada más.
5. **Pantallas abiertas:** Admin → Reservas (mostrador), Admin → Vuelos (asientos) y Admin → Webhooks.
6. **Vuelo de la prueba.** Créalo en Admin → Vuelos con salida **mañana**:
   - Así el check-in, que abre 48 h antes, queda abierto.
   - Queda dentro de los 14 días que se empujan a Booking.

   Anota el código y la hora en UTC.

## Las pruebas

| # | Prueba | Qué hacemos / qué hace Booking | Dónde mirar y qué esperar |
|---|---|---|---|
| 1 | Disponibilidad | Creamos el vuelo; Booking lo busca | Llega a Booking en ≤ 30 s por la red de seguridad del push. `item_id` = `<código>-ECONOMY`, `date` y `time_slot` en **UTC**. Observabilidad → última ronda `enviados ≥ 1`. El precio de cada familia es la base × multiplicador (+ IVA). |
| 2 | Compra desde Booking | Booking compra 1 asiento (v2 `POST /bookings`) | Mostrador, filtro `canal=SOCIO` o `partnerOrderId=ORD-BKP-…`: PNR, `paymentProvider = BOOKING_PROTOTIPO`, `PAY-BKP-…`, total. Vuelos → asientos: el asiento aparece ocupado y el cupo baja en 1. El stock sale a Booking en ~1 s. Webhooks: `booking.confirmed` en DELIVERED. |
| 3 | Compra en nuestra web | Vendemos un asiento con selección de asiento | Booking ve el cupo bajar en ~1 s. Si compra **ese** asiento recibe `409 SEAT_TAKEN` y no se crea reserva; Booking devuelve el cobro. |
| 4 | Hold y cancelar | Booking congela (`POST /offers/hold`) y libera (`DELETE /offers/hold/{id}`) | El cupo vuelve en el acto y el push sale en ~1 s. Si Booking no libera, el hold vence a los 15 min y el barrido lo devuelve en ≤ 5 min más. |
| 5 | Rechazo | Booking reserva con un dato inválido | 422 con `code` v2 (p. ej. `VALIDATION_FAILED` por cédula inválida, `PASSPORT_REQUIRED_INTERNATIONAL`, `AMOUNT_MISMATCH`). No hay reserva ni factura. **El hold sigue retenido**: Booking debe liberarlo (`DELETE` hold) o esperar el vencimiento. |
| 6 | Check-in desde Booking | Booking hace el check-in (v2) | Mostrador: pasajero con check-in ✓. Webhooks: `booking.checked_in`. |
| 7 | Check-in en nuestra web / mostrador | Mostrador → Check-in de otra reserva de Booking | Webhooks: `booking.checked_in` en DELIVERED en ≤ 15 s; el despachador corre cada 15 s y el primer reintento es a 1 min. Booking lo muestra como "Check-in realizado". |
| 8 | Cancelación desde Booking | Booking cancela una `FULL` y una `BASIC`/`LIGHT` | Mostrador → importes: `FULL` tiene `reembolso = total` y `penalidad = 0.00`; la no reembolsable tiene `reembolso = impuestos` y `penalidad = base`. El evento `booking.cancelled` lleva `refundAmount`, `penaltyAmount`, `currency`, `paymentReference` y `partnerOrderId`. |
| 9 | Cancelación desde nuestro lado | Mostrador → Cotizar y Cancelar, o Vuelos → Cancelar vuelo | Mostrador: misma regla que la 8. Vuelo cancelado: **reembolso total sea cual sea la tarifa** y `reasonCode = FLIGHT_CANCELLED`, más `flight.cancelled`. Booking se entera por webhook y devuelve el dinero. |
| 10 | Estado del vuelo | Vuelos → Estado: `DELAYED` con salida estimada y puerta | Booking lo ve en v2 `GET /flights/{código}/status` y por `flight.status_changed` (con `delayMinutes` y las reservas afectadas). El vuelo sigue a la venta. |
| 11 | Webhooks | Revisión conjunta | Admin → Webhooks → Entregas, filtro `owner = partner:booking-prototipo`: confirmación, check-in, cancelación y vuelo en DELIVERED. Una DEAD (Booking caído) se reenvía con **Reintentar**. |
| 12 | Cuadre final | Comparar montos por compra | Mostrador → **Exportar CSV** (`canal=SOCIO`, rango de fechas). Por `partnerOrderId`: `total` es lo que Booking nos pagó (el `payment.amount` debe igualar el precio retenido, si no sale 422 `AMOUNT_MISMATCH`), con `base + impuestos = total`, y además `reembolso` y `penalidad` si se canceló. La factura al cliente la emite Booking: nuestro `total` + su cargo. Las reservas v2 no generan factura de nuestro lado. |

## Si algo falla

- **El stock no llega.** Revisa `booking-stock.ultimoError` o `ultimoRechazo` en Observabilidad, y el log `Stock push round: …`. Un vuelo que Booking rechaza espera 1 h antes de reenviarse; reiniciar el servicio lo vuelve a enviar.
- **Los webhooks quedan PENDING con error.** Mira `ultimoError` y `ultimoCodigo` en Webhooks. Cuando Booking responda, pulsa **Reintentar**.
- **`booking-webhook.estado = SIN_CONFIGURAR` o `ERROR`.** Falta `BOOKING_WEBHOOK_URL`, o la URL no es https pública. Corrígela y reinicia.
- **El check-in responde 409.** El vuelo está fuera de la ventana: abre 48 h antes y cierra a la salida con `CHECKIN_CLOSES_HOURS=0`.
