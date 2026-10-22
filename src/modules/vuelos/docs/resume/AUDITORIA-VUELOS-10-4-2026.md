# Auditoría 4-oct-2026 (1.ª emisión)

**Estado:** el flujo búsqueda → hold → reserva → ticket ya es real. Postventa, check-in y webhooks seguían como stubs.
**Hallazgos:** 6 críticos · 10 altos · 8 medios · 5 bajos.
El riesgo pasó de "nada funciona" a integridad bajo concurrencia y autorización.

## Críticos
- C1 JWT sin verificar, cae a `dev-owner`; ver reservas ajenas (IDOR)
- C2 Reserva no atómica: doble reserva posible
- C3 El inventario nunca baja: overbooking
- C4 `flight-status` ignora la fecha
- C5 Stubs devuelven 200 `{}` como si fuera éxito
- C6 Idempotencia con carrera y sin ligar al cuerpo

## Altos
- A1 DTOs laxos (enums como string, sin email/UUID/URL)
- A2 Precio solo ADULT, no multiplica por pasajeros
- A3 Seatmap falso, no valida la oferta
- A4 Listado de reservas sin filtros ni cursor
- A5 Postventa sin `Idempotency-Key`
- A6 `paymentReference` sin validar; PNR repetido da 500
- A7 Faltan cabecera y parámetros obligatorios
- A8 `ProblemDetails` incompleto, filtra mensaje interno
- A9 Hold: transiciones de estado mal controladas
- A10 `Vuelo`: fechas como string, sin índices ni unique

## Medios
- M1 Config con `Number()` sin validar: puede dar NaN
- M2 Hold expira solo si alguien lo consulta
- M3 Listado con N+1 y sin cursor
- M4 Búsqueda solo Postgres; combinaciones truncadas en silencio
- M5 Sin logs ni eventos de dominio (RF-095)
- M6 `WebhookSubscription` sin CRUD; secreto en claro
- M7 Seed frágil; `synchronize` sin migraciones
- M8 Tests con mocks: nada de concurrencia ni expiración

## Bajos
- B1 `@ApiTags` repetido; `@Controller()` sin prefijo
- B2 Dinero como string, aritmética con float
- B3 `toISOString()` sobre fechas que pueden venir como string
- B4 Faltan `@HttpCode(201)` y 202 donde aplica
- B5 Sin límites de itinerarios ni tope de grupo (RN-05)

## Qué hacer
* Transacción + bloqueo en la reserva ·
* descontar inventario con UPDATE condicional ·
* JWT verificado y dueño del recurso ·
* idempotencia con hash del cuerpo ·
* 501 honesto en los stubs ·
* enums y formatos en los DTOs.

## Pruebas
- Reservas concurrentes sobre un mismo hold
- IDOR: pedir la reserva de otro usuario
- Replay de idempotencia con cuerpo distinto
- Expiración real del hold
- `flight-status` con `date`

**Cierre:** cerrar críticos y altos antes de RDA2.
