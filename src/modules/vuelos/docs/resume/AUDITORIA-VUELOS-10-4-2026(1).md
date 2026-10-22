# Auditoría 4-oct-2026 (2.ª emisión)

**Estado:** núcleo GDS + e-commerce. Sólido: JWT, reserva atómica, idempotencia con hash, dinero en enteros, stubs con 501.
**Hallazgos:** 6 críticos · 10 altos · 10 medios · 5 bajos.
Los riesgos están en datos personales, dinero y entrega de correos.

## Críticos
- C1 Datos personales de pasajeros GDS en claro
- C2 Saga no registra la compensación si `anular()` falla
- C3 Dedup de la pasarela solo en memoria
- C4 Venta `EMITIDA` con captura pendiente, sin reconciliador
- C5 `OrdenEmitida` sin outbox: orden sin correo si cae el servidor
- C6 Scopes solo documentados: un invitado puede reservar

## Altos
- A1 Cabina BUSINESS/FIRST cobra precio economy
- A2 `extraBaggage` se valida y se descarta
- A3 Seatmap ignora holds e inventario
- A4 Reserva y tickets devuelven menos campos que el contrato
- A5 Datos de `Cliente` en claro; logs con PII
- A6 `totalAceptado` comparado como texto (`1234.5` ≠ `1234.50`)
- A7 `paymentReference` solo de formato, sin verificar
- A8 Hold previo al despegue aún se confirma después
- A9 Stub 501 pide `Idempotency-Key` antes: da 400
- A10 Rate-limit en memoria y parcial

## Medios
- M1 BASIC puede elegir asiento gratis
- M2 Falta `Retry-After` en 409 y 429
- M3 Factores por edad provisionales; redondeo ±1¢
- M4 Un solo reintento ante `SEAT_TAKEN`
- M5 Antifraude cuenta solo por oferta; `REVISAR` se declina
- M6 Marca de tarjeta incoherente da 402, no 422
- M7 `restore` de inventario recorta en silencio
- M8 Ofertas vencidas nunca se purgan
- M9 Cronología compara días, no instantes
- M10 Duplicados de pasajero mal normalizados

## Bajos
- B1 `buildCombinations` calcula todo antes de truncar
- B2 JWT sin `audience`; llave derivada de `JWT_SECRET`
- B3 `GET hold` escribe (expira) sin avisarlo
- B4 `Ticket.passengerId` expone el UUID interno
- B5 Seed no actualiza precios; migración única mezcla GDS y e-commerce

## Qué hacer
Cifrar todo PII · compensar siempre · reconciliador + outbox · scopes reales · persistir y cobrar equipaje · validar el pago en el GDS.

## Pruebas
- SQL sin PII en claro
- `anular()` que falla: orden `FALLIDA_COMPENSADA`
- Reinicio en medio de la captura
- Invitado intentando reservar (403)
- Ráfaga de intentos de login y compra (429)

**Cierre:** críticos y altos antes de RDA2; los medios de contrato y precio antes de tráfico real.
