# Auditoría 6-oct-2026 — Backend

**Estado:** el mejor hasta ahora. 0 críticos abiertos; ningún 501 en el contrato.
**Hallazgos:** 6 altos · 9 medios · 8 bajos.
Riesgo que queda: dinero y entregabilidad en los bordes.

## Ya corregido (histórico)
- Stubs reales en postventa, check-in y webhooks
- Reserva atómica (UPDATE condicional + lock + UNIQUE de asiento)
- Idempotencia con hash de cuerpo (422 / 409)
- PII cifrada AES-256-GCM
- Compensación de la saga siempre registrada

## Altos
- A1 Cotización de cancelación reprorratea impuestos con el precio vivo
- A2 Seatmap ignora holds vivos (el 409 llega tarde)
- A3 Dedup del simulador en memoria
- A4 `compensar()` puede fallar si el mercado desapareció
- A5 Rate-limit en memoria (fijar `TRUST_PROXY=1`)
- A6 Sin outbox (aceptado en RDA1; lo cubre el reconciliador)

## Medios
- M1 Cada búsqueda de cambio de fecha deja hasta 5 filas basura
- M2 Cada cotización de cancelación deja una fila `OPEN`
- M3 BASIC reserva asiento gratis
- M4 Falta `Retry-After`
- M5 Marca de tarjeta incoherente da 402, no 422
- M6 `restore` recorta con `LEAST()` sin avisar
- M7 Ofertas vencidas sin purga
- M8 Cronología compara días, no instantes
- M9 Duplicados de pasajero mal normalizados

## Bajos
- B1 Entrada 501 muerta en el filtro de errores
- B2 `toMinorUnits` opera sobre float
- B3 Ventana de embarque de 30 min fija en el código
- B4 `quantity @Max(5)` en el DTO vs tope real de 2
- B5 Enum de check-in con estados que nunca se emiten
- B6 DTO de webhook exige https aunque local acepte http
- B7 Eventos `flight.*` sin productor en el núcleo
- B8 Claves de jobs en distinto idioma

## Qué hacer
* Guardar el desglose de impuestos congelado 
* purgar filas viejas del sweeper 
* `Retry-After` 
* validar marca vs token antes del pago 
* outbox o broker en RDA2.

## Pruebas
- Cambiar `precioBase` tras el hold: el reembolso no cambia
- Dos holds sobre el mismo asiento: el perdedor da 409 en la reserva
- Mercado borrado durante la compensación
- `CAPTURA_PENDIENTE` y `REEMBOLSO_PENDIENTE` resueltos por el job de 60 s
- SQL sin PII en claro

**Cierre:** pruebas de dinero e inventario en cada PR; seguridad antes de declarar RDA2.
