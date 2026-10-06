# Plan de implementación: posventa, check-in, pases de abordar y webhooks (contrato completo)

- **Fecha:** 2026-10-07
- **Agente:** Claude Code Desktop
- **Área:** backend/BD (+ documentación del Swagger)
- **Rama:** `vuelos`

## Objetivo
Los 11 endpoints del contrato que respondían `501` (equipaje, cambio de fecha, cancelación con reembolso, check-in, pases de abordar y webhooks) funcionan de verdad: no queda nada del contrato inactivo.

## Alcance
- Incluye: los 11 endpoints; `extraBaggage` al crear la reserva; reembolso en la pasarela simulada y sincronía con la orden del e-commerce; acciones de admin que generan `flight.cancelled` y `flight.schedule_changed`; entregas de webhook firmadas con reintentos y defensa SSRF; Swagger sin secciones "No implementado"; pruebas y documentación.
- No incluye: interfaz web de estas funciones (queda para otra entrega); cabinas distintas de economía; vuelos con escalas; pagos reales.

## Contexto y referencias
- `contracts/vuelos-openapi.yaml` (operaciones y esquemas de baggage, date-change, cancellation, check-in, boarding-passes, webhooks); SRS R2 (RF-PSV-004/005, RF-CKI-001..011, RF-ANC-002/006).
- El contrato y el SRS no fijan montos, ventanas ni penalidades: son decisiones del equipo y se dejan en configuración (`vuelos-config.ts`, variables `POSTSALE_*`, `CHECKIN_*`, `WEBHOOKS_*`).

## Reglas de negocio (por defecto)
| Tema | Regla |
|------|-------|
| Equipaje extra | 40 USD por maleta y tramo; máx. 2 extra por pasajero y tramo; hasta 3 h antes de la salida; reserva CONFIRMED; sin bebés en brazos. |
| Cambio de fecha | Solo tarifas `changeable` (FULL); mismo origen y destino, vuelo directo con cupo; cargo fijo 30 USD + diferencia de tarifa e impuestos (si es negativa no se devuelve); oferta válida 15 min; hasta 3 h antes. |
| Cancelación | FULL: reembolso = total − 10 %; BASIC/LIGHT: solo impuestos; cotización válida 15 min; no si el vuelo ya salió ni a menos de 3 h; devuelve los cupos. |
| Check-in | Abre 48 h y cierra 1 h antes; asiento elegido o el primero libre; bebés en brazos sin asiento; grupo de embarque por familia (FULL=A, LIGHT=B, BASIC=C). |
| Pase de abordar | Solo tras check-in; QR firmado `bp1.<billete>.<PNR>.<tramo>.<asiento>.<firma>`, sin datos personales. |
| Pagos posventa | Referencia de pago opaca y única (como en la reserva); si existe un `Pago` con esa referencia, el reembolso se ejecuta en la pasarela. |

## Cambios previstos
Entidades nuevas (`BaggagePurchase`, `DateChangeOffer`, `CancellationQuote`, `CheckIn`, `WebhookSubscription`, `WebhookDelivery`), `Vuelo.estado`, `Booking.changes`; un servicio de núcleo por operación; `common/safe-http.ts` (SSRF) y el despachador de webhooks; `PasarelaPago.reembolsar`; suscriptores en `OrdenesService` y `PagosService`; rutas de admin para cancelar y reprogramar vuelos; Swagger renumerado.

## Impacto en la API / contrato
El contrato no cambia: se implementan sus operaciones tal como están (respuestas síncronas `200`; los `202` no se usan). Rutas nuevas fuera del contrato del núcleo: `POST /admin/vuelos/{id}/cancelar` y `/reprogramar`; la orden del propietario expone `bookingId`.

## Pasos
1. Configuración y entidades + migración. 2. Equipaje. 3. Cancelación y reembolso. 4. Cambio de fecha. 5. Check-in y pases. 6. Webhooks. 7. Acciones de admin. 8. Swagger y documentación. 9. Pruebas y recorrido real.

## Riesgos y decisiones abiertas
- Entrega grande: se avanza por bloques con las pruebas en verde.
- El despachador de webhooks es por proceso (como el reconciliador); es seguro con varias instancias por `FOR UPDATE SKIP LOCKED`.
- `WEBHOOKS_ALLOW_PRIVATE_HOSTS` solo para desarrollo y pruebas; el arranque falla si se activa en producción.

## Verificación
`npm test` con `TEST_DATABASE_URL`, `npm run build`, migración desde cero con `migration:check:vuelos` en 0, y un recorrido real (compra → equipaje → cambio → check-in → pases → cancelación → webhook a un receptor local).
