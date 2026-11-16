# Auditoría — Fecha local del aeropuerto de origen, asientos apartados (HELD) por el hold y vuelos nacionales — 2026-11-10

> Estado: **por transcribir**. Archivo preparado con datos de git y comprobaciones sugeridas; los hallazgos están vacíos a propósito.

- **Plan:** [`2026-11-10-fecha-local-y-asientos-held.md`](../../planes/2026-11-10-fecha-local-y-asientos-held.md) — Plan principal
- **Fecha del plan:** 2026-11-10
- **Objetivo del plan:** Que la búsqueda v2 lea departureDate como día local del aeropuerto de origen y que un hold pueda apartar asientos (HELD para Booking y la web); incluye vuelos nacionales de Ecuador hasta 180 días y seed incremental.
- **Commits auditados:** 3 (fecha y hora del autor en git, hora local -05:00; estadísticas de `git show --shortstat`).

  | Commit | Fecha | Asunto | Archivos | Inserciones | Borrados |
  |---|---|---|---|---|---|
  | `7323ebe` | 2026-11-10 20:09 | Add domestic Ecuador flights up to 180 days ahead and make the seed incremental | 8 | 154 | 10 |
  | `eb3288d` | 2026-11-10 20:15 | Fix a time-dependent registration test: use the Ecuador day like the schema | 1 | 4 | 2 |
  | `1f4d2e9` | 2026-11-10 22:05 | Read v2 search dates as the origin airport's local day and set seats aside with a hold | 43 | 1378 | 99 |

- **Archivos principales tocados** (reales de git, agrupados; recortados si hay muchos):

- **Backend** (23): `src/modules/vuelos/seed/flights.seed.ts`, `src/modules/vuelos/seed/seed.ts`, `src/modules/vuelos/common/airport-zones.ts`, `src/modules/vuelos/common/business-rules.ts`, `src/modules/vuelos/common/date.util.ts`, `src/modules/vuelos/common/held-seats.ts`, `src/modules/vuelos/common/seat-rules.ts`, `src/modules/vuelos/dto/hold.dto.ts`, `src/modules/vuelos/ecommerce/admin/vuelos-admin.service.ts`, `src/modules/vuelos/ecommerce/ofertas/dto/ofertas.dto.ts`, `src/modules/vuelos/ecommerce/ofertas/ofertas.service.ts`, `src/modules/vuelos/entities/flight-hold-seat.entity.ts`, `src/modules/vuelos/migrations/1794355200000-FlightHoldSeats.ts`, `src/modules/vuelos/services/bookings.service.ts` … y 9 más
- **Frontend** (3): `frontend/src/api/types.ts`, `frontend/src/features/checkout/SeatMap.tsx`, `frontend/src/features/results/DateNavigator.tsx`
- **Pruebas** (14): `src/modules/vuelos/seed/flights.seed.spec.ts`, `src/modules/vuelos/testing/admin-reservas.integration.spec.ts`, `src/modules/vuelos/testing/ecommerce.integration.spec.ts`, `src/modules/vuelos/testing/nacionales.integration.spec.ts`, `src/modules/vuelos/testing/stock-grpc.integration.spec.ts`, `frontend/tests/unit/registration.test.ts`, `src/modules/vuelos/common/business-rules.spec.ts`, `src/modules/vuelos/common/date.util.spec.ts`, `src/modules/vuelos/common/held-seats.spec.ts`, `src/modules/vuelos/common/seat-rules.spec.ts`, `src/modules/vuelos/services/bookings.service.spec.ts`, `src/modules/vuelos/services/search.service.spec.ts`, `src/modules/vuelos/testing/ecuador-time.integration.spec.ts`, `src/modules/vuelos/testing/v2.integration.spec.ts`
- **Docs** (6): `CLAUDE.md`, `src/modules/vuelos/README.md`, `src/modules/vuelos/docs/ARQUITECTURA-EVENTOS.md`, `src/modules/vuelos/docs/MODELO-DE-DATOS.md`, `src/modules/vuelos/docs/RDA2-docs/COMPARACION-CONTRATOS-V1-V2.md`, `src/modules/vuelos/docs/planes/2026-11-10-fecha-local-y-asientos-held.md`
- **Contratos** (3): `contracts/overlay/vuelos-v2-ram-alliance.overlay.yaml`, `contracts/vuelos-ecommerce-openapi.yaml`, `contracts/vuelos-openapi-v2-ram-alliance.yaml`
- **Infraestructura y configuración** (2): `.env.example`, `scripts/export-modelo-datos.ts`

- **Alcance:**
  - **Incluye:** zonedDayRange/todayInZone, AirportZones, assignedSeats en el hold, tabla vuelos_flight_hold_seats y held-seats.ts, mapa de asientos con estado «apartado», vuelos nacionales a 180 días y seed incremental, arreglo de un test dependiente de la hora.
  - **No incluye:** Check-in ni cancelación desde la web de Booking; stock, feed y estado de vuelo siguen en UTC.
- **Método:** pendiente de transcribir. Marcas de la leyenda:
  - **[V]** releído en el código por quien audita.
  - **[E]** procede de una exploración y no se releyó.
  - **[observado]** visto al ejecutar o usar el sistema.
  - **[confirmado en producción]** comprobado contra el despliegue real.
- **No cubierto:** pruebas de penetración, carga, accesibilidad completa, configuración real de los servicios externos (Azure, Aiven, Netlify, GHCR), contenido de `.env` y `.env.azure`.
- **Por verificar** (dudas o contradicciones que los informes dejaron abiertas; no son hechos):
  - Si Azure ejecutaba `1f4d2e9` el 2026-11-11: AUDITORIA-2026-11-11 (línea 4) dice que sí; el plan 2026-11-12-booking-velocidad-y-holds (línea 16) dice que la búsqueda por día local «aún no está desplegada». Contradicción sin resolver.
  - Que `frontend/tests/unit/seats.test.ts` cubra el estado HELD (no verificado).
  - Migración `1794355200000-FlightHoldSeats.ts`: existe en el repositorio; no se contrastó con la entidad ni se ejecutó `migration:check:vuelos`.

## 1. Resumen ejecutivo

_Por completar tras transcribir la auditoría._

<!-- Valoración en 3 líneas: 1) qué está bien construido; 2) el hallazgo principal; 3) los temas que agrupan el resto. -->

| Severidad | Cantidad |
|---|---|
| Crítica | 0 _(por completar)_ |
| Alta | 0 _(por completar)_ |
| Media | 0 _(por completar)_ |
| Baja | 0 _(por completar)_ |

## 2. Hallazgos críticos, altos, medios y bajos

_Hallazgos: ninguno transcrito todavía. Cada tabla trae una fila de ejemplo vacía; copiarla por cada hallazgo. Columna opcional «Impacto» si hace falta._

### 2.1 Críticos

| ID | Hallazgo | Estado |
|---|---|---|
| C-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Crítico**

- [E] Orden de locks: `createHoldWithin` toma primero `lockSeats` (advisory, `services/offers.service.ts:264`) y luego el hold (`findHold` con lock, `:266`); `createBookingWithin` toma primero el hold (`services/bookings.service.ts:148`) y después `lockSeats` (`:197`). ¿Un re-hold y una reserva del mismo hold podrían bloquearse en cruz? ¿Postgres lo resuelve como deadlock (40P01) y qué HTTP devuelve?
- [E] `replaceHoldSeatsWithin` (`offers.service.ts:322` lock del hold, luego `claimHoldSeats` → `lockSeats`) sigue el orden contrario al de `createHoldWithin`: ¿es el mismo riesgo?

### 2.2 Altos

| ID | Hallazgo | Estado |
|---|---|---|
| A-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Alto**

- [E] El re-hold de la web no publica `hold.released`: `ecommerce/ofertas/ofertas.service.ts:182` llama `createHoldWithin` sin el array `released` y `offers.service.ts:268` hace `released?.push`. ¿Stock y webhooks se enteran tarde? `StockPushService` escucha `hold.released` (`v2/stock-push.service.ts:21`).
- [E] `replaceHoldSeatsWithin` retorna en silencio si el hold venció (`offers.service.ts:324`) (B-9 de AUDITORIA-2026-11-11): ¿el llamante sabe que no apartó nada?

### 2.3 Medios

| ID | Hallazgo | Estado |
|---|---|---|
| M-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Medio**

- [E] `AirportZones.preload` traga el error (`common/airport-zones.ts:30-32`, `catch` sin log): si el catálogo falla, GPS/SCY quedan en `America/Guayaquil` sin rastro.
- [E] El seed incremental usa `MAX(fechaSalida)` por código (`seed/flights.seed.ts:250-251`): si un admin borra el último vuelo de un código, la siguiente ejecución lo regenera, lo que contradice el comentario de `:249` («una edición o borrado no se restaura»).
- [E] `claimHoldSeats` borra filas de otros holds sin lock del hold (`common/held-seats.ts:87-92`): ¿hay carrera con `transition`?
- [E] `transition` borra `FlightHoldSeat` sin `lockSeats` (`offers.service.ts:429`, `held-seats.ts:109-111`).
- [E] La caché de familias de tarifa dura 60 s por proceso (`services/search.service.ts:33,173-178`) y no se invalida al cambiar un `priceMultiplier` en el admin: ¿se puede vender a un precio viejo durante 60 s?
- [E] El cambio de fecha v1 también pasa a día local del origen (`services/date-change.service.ts:245-246`, plan riesgo): ¿es un cambio de comportamiento de v1 que Booking espera?
- [E] `ecuador-time.integration.spec.ts:13,20-22` usa el reloj real (`Date.now`, `nextUtc`): ¿falla cerca de la medianoche? El comentario de la línea 25 dice que hay un helper que fija `Date`: ¿se usa en todos los casos? (M-10 de la auditoría previa).

### 2.4 Bajos

| ID | Hallazgo | Estado |
|---|---|---|
| B-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Bajo**

- [E] `seed/flights.seed.ts:257` calcula la salida con `utcDateAtHour(day, hour, now)`, que depende de la hora de ejecución: ¿se generan duplicados en arranques distintos? (no se leyó `utcDateAtHour`).
- [E] `frontend/src/features/checkout/CheckoutPage.tsx:68-72,216-221`: volver a resultados no libera el hold; ¿se conservan los datos de pasajeros al volver?

### 2.5 Revisado y sin hallazgo

<!-- Lista de lo comprobado que está bien, con la marca de cómo se comprobó. -->

## 3. Evidencia concreta (archivo y elemento afectado)

_Por cada hallazgo indicar ruta del archivo y el elemento (función, endpoint, columna, variable, línea)._

| ID | Archivo | Elemento afectado | Evidencia |
|---|---|---|---|
| C-1 | <ruta/del/archivo.ts> | <función, endpoint, columna, variable o línea> | <ruta:línea y qué se observa> |
| A-1 | <ruta/del/archivo.ts> | <función, endpoint, columna, variable o línea> | <ruta:línea y qué se observa> |
| M-1 | <ruta/del/archivo.ts> | <función, endpoint, columna, variable o línea> | <ruta:línea y qué se observa> |
| B-1 | <ruta/del/archivo.ts> | <función, endpoint, columna, variable o línea> | <ruta:línea y qué se observa> |

## 4. Recomendación de corrección

| ID | Recomendación | Responsable (backend/BD, frontend, infra) |
|---|---|---|
| C-1 | <cambio propuesto> | <backend/BD, frontend o infra> |
| A-1 | <cambio propuesto> | <backend/BD, frontend o infra> |
| M-1 | <cambio propuesto> | <backend/BD, frontend o infra> |
| B-1 | <cambio propuesto> | <backend/BD, frontend o infra> |

## 5. Pruebas que deberían repetirse después de corregir

### 5.1 Pruebas existentes que cubren el plan

- `src/modules/vuelos/common/date.util.spec.ts`
- `src/modules/vuelos/common/business-rules.spec.ts`
- `src/modules/vuelos/common/zoned-time.spec.ts`
- `src/modules/vuelos/common/held-seats.spec.ts`
- `src/modules/vuelos/common/seat-rules.spec.ts`
- `src/modules/vuelos/testing/ecuador-time.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/testing/v2.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/testing/hold-reholding.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/testing/nacionales.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/seed/flights.seed.spec.ts`
- `frontend/tests/unit/seats.test.ts`
- `frontend/tests/unit/registration.test.ts`

### 5.2 Pruebas a repetir (sugeridas)

```bash
npx jest src/modules/vuelos/common/date.util.spec.ts src/modules/vuelos/common/business-rules.spec.ts src/modules/vuelos/common/zoned-time.spec.ts src/modules/vuelos/common/held-seats.spec.ts src/modules/vuelos/common/seat-rules.spec.ts src/modules/vuelos/seed/flights.seed.spec.ts
# requiere TEST_DATABASE_URL apuntando a una base desechable (p. ej. booking_test)
npx jest src/modules/vuelos/testing/ecuador-time.integration.spec.ts src/modules/vuelos/testing/v2.integration.spec.ts src/modules/vuelos/testing/hold-reholding.integration.spec.ts src/modules/vuelos/testing/nacionales.integration.spec.ts
cd frontend && npx vitest run tests/unit/seats.test.ts tests/unit/registration.test.ts
npm run migration:check:vuelos  (migración FlightHoldSeats)
npm run contract:v2:build
npm run lint
npm run build
```

_Ejecutar solo cuando se corrijan los hallazgos que se transcriban; añadir aquí una prueba por hallazgo corregido._
