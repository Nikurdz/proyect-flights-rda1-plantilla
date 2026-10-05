# Auditoría no destructiva — Módulo `src/modules/vuelos`

> **Proyecto:** Proyect-Flights-RDA1 · **Fecha de auditoría:** 2026-10-04
> **Alcance:** carpeta `src/modules/vuelos/` (controller, module, `services/`, `dto/`, `entities/`, `common/`, `seed/`, `README.md`, `docs/`), más contexto mínimo (`src/common/guards/idempotency-key.guard.ts`, `contracts/vuelos-openapi.yaml` v1.5.0.0).
> **Método:** solo lectura. No se modificó ningún archivo existente. Este informe es el único archivo creado.
> **Nota sobre `docs/AUDITORIA.md` (2026-09-28):** ese informe describía una plantilla 100% mock (0% funcional). Quedó desactualizado: el flujo búsqueda → seatmap → hold → reserva → ticket → flight-status hoy **sí tiene lógica real contra Postgres**. Esta auditoría lo reemplaza para el estado actual del código.

---

## 1. Resumen ejecutivo

El módulo Vuelos implementa de forma real el happy path GDS (`POST /search`, `GET /offers/:offerId/seatmap`, `POST/GET/DELETE /offers/hold*`, `POST/GET /bookings*`, `GET .../tickets*`, `GET /flights/:flightNumber/status`) con reglas de negocio RN-01/RN-02/RN-04/RN-06, pricing por fare family + `TAX_RATE` plano, TTL de oferta/hold vía `expiresAt`, e idempotencia con replay por `(key, ruta)` (RN-18). Postventa (equipaje, cambio de fecha, cancelación), check-in/boarding-passes y webhooks **siguen siendo stubs** que devuelven `{}` / `[]` (`vuelos.controller.ts:153-270`), aunque la entidad `WebhookSubscription` ya existe y está registrada en el módulo.

El riesgo ya no es "nada funciona" sino **integridad bajo concurrencia y autorización**: no hay verificación real de JWT (`resolveOwnerId` decodifica sin verificar y cae a `dev-owner`), no hay chequeo de propiedad en lectura de reservas/tickets (IDOR), la creación de booking no es transaccional (hold → booking → pasajeros → tickets → `CONSUMED` son escrituras sueltas), el inventario de asientos nunca se descuenta ni se valida, y `getFlightStatus` ignora el parámetro `date`. Además hay brechas de contrato que romperán a consumidores: seatmap determinista sin validar oferta, `listBookings` que ignora filtros/paginación, pricing solo-ADULT, y validación de DTOs laxa (enums como `string`, email/teléfono/URL sin formato, eventos webhook sin `IsIn`).

**Distribución de esta auditoría:** 6 críticos · 10 altos · 8 medios · 5 bajos. Recomendación: cerrar críticos + altos antes de declarar RDA2; los stubs de postventa/check-in/webhooks deben documentarse como 501 o implementarse antes de exponerlos como exitosos (200/`{}`).

---

## 2. Hallazgos

### 2.1 Críticos (pérdida monetaria, overbooking, acceso cruzado entre usuarios)

| ID | Hallazgo |
|----|----------|
| C1 | Autenticación placeholder: `sub` sin verificar + fallback `dev-owner`, y lectura de reservas/tickets sin chequeo de propiedad (IDOR) |
| C2 | `createBooking` no es atómico: sin transacción entre hold/booking/pasajeros/tickets/`CONSUMED`; doble booking concurrente posible |
| C3 | Inventario nunca se descuenta ni se valida: `asientosDisponibles` no baja en hold/booking; seatmap falso; overbooking garantizado |
| C4 | `getFlightStatus` ignora el parámetro `date` (variable `dayStart/dayEnd` calculada y no usada) y usa hora local |
| C5 | Postventa / check-in / webhooks devuelven `{}` / `[]` con 200 como si fueran éxito, sin persistir nada |
| C6 | Idempotencia sin atomicidad ni amarre al cuerpo: `findReplay` → ejecutar → `record` con `PrimaryColumn(key, route)` puede colisionar en concurrentes y replays de cuerpos distintos devuelven la respuesta ajena |

### 2.2 Altos (incumplimiento de contrato / datos inválidos aceptados)

| ID | Hallazgo |
|----|----------|
| A1 | DTOs con validación laxa: enums como `IsString`, sin `IsEmail/IsPhoneNumber/IsDateString/IsUrl/IsUUID/IsEnum`, `MoneyAmountDto` sin decoradores |
| A2 | Pricing incompleto: solo se cotiza `ADULT`, `lockedTotal`/`grandTotal` no multiplican por Nº pasajeros; con 0 fare families `Math.min(...[]) = Infinity` |
| A3 | `getSeatmap` no valida `offerId` (ni existencia ni expiración) y genera disponibilidad determinista ajena a holds/bookings reales |
| A4 | `listBookings` ignora `createdFrom/createdTo/cursor`, no pagina por cursor, `limit` sin tope y `status` sin validar contra enum |
| A5 | Endpoints transaccionales de postventa documentan `Idempotency-Key` pero no aplican `IdempotencyKeyGuard` (`addBaggage`, `confirmDateChange`, `cancelBooking`) |
| A6 | `paymentReference` opaco nunca validado + PNR/e-ticket con colisión no mapeada a ProblemDetails (500 con fuga de mensaje) |
| A7 | Cabeceras/parámetros de contrato no exigidos: `X-Device-Fingerprint` no chequeado, `segmentId` y `date` opcionales en código pero requeridos en YAML |
| A8 | `ProblemDetails` incompleto: `ProblemDetailsCode` no incluye `SEAT_TAKEN/HOLD_EXPIRED/BAGGAGE_LIMIT_EXCEEDED/...`; el filtro emite `code: VALIDATION_FAILED` con `status: 500` y expone `error.message` |
| A9 | Máquina de estados de hold porosa: `releaseHold` libera holds `CONSUMED/EXPIRED`; `lazilyExpire` solo se aplica en `getHoldStatus`, no en `findHoldOrThrow`/`releaseHold` |
| A10 | Entidad `Vuelo`: `fechaSalida/fechaLlegada` tipadas `string` sobre `@Column(timestamp)`, IATA `varchar(10)` sin check `^[A-Z]{3}$`, sin índices/unique en `(codigoVuelo, fechaSalida)` ni `(origen, destino)` |

### 2.3 Medios (deuda técnica / robustez)

| ID | Hallazgo |
|----|----------|
| M1 | `Number(config.get(...))` sin validación: `TAX_RATE/OFFER_TTL_MINUTES/HOLD_TTL_MINUTES` corruptos producen `NaN` → `expiresAt` inválido / impuestos absurdos |
| M2 | `releaseHold`/`setHoldStatus` sin guardia de transición y sin expiración perezosa; holds expirados quedan `HELD` hasta que alguien llama `getHoldStatus` |
| M3 | `listBookings` con N+1 (`tickets.find` por cada booking) y `take: limit` sin `skip`/cursor → páginas inestables |
| M4 | `findDirectFlights` con `Raw(DATE(alias) = :date)` solo-Postgres, sin normalizar IATA a mayúsculas; `buildCombinations` con cross-product truncado a 5 en silencio |
| M5 | Sin logging/tracing/eventos de dominio (`booking.confirmed`, `ticket_issued`, `hold.expired` del SRS RF-095); sin outbox |
| M6 | `WebhookSubscription` registrada pero sin CRUD real; `secret varchar(200)` en claro, sin hash, y `GET` futuro lo expondría |
| M7 | Seed frágil ante re-ejecución (`fechaSalida` ISO exacta con ms) y `synchronize: true` global sin migraciones |
| M8 | Tests mock-heavy sin cubrir concurrencia, expiración real, colisión de idempotencia ni unicidad de PNR/e-ticket |

### 2.4 Bajos (calidad / convención)

| ID | Hallazgo |
|----|----------|
| B1 | `@ApiTags` repetido por método cuando la clase ya declara tag; `@Controller()` sin prefijo (depende del prefijo global `api/v1`, colisionable con otros dominios) |
| B2 | Dinero como `string` sin `@Matches(/^\d+\.\d{2}$/)` y aritmética float + `toFixed(2)` en lugar de centavos/`Decimal` |
| B3 | `toBookingDetail/toTicketDto` asumen `createdAt/updatedAt/issuedAt: Date` con `.toISOString()` directo; si TypeORM devuelve `string` revienta |
| B4 | `POST /offers/hold` y `POST /webhooks` sin `@HttpCode(201)` explícito; stubs async sin `@HttpCode(202)` donde el contrato prevé flujo GDS asíncrono |
| B5 | `SearchRequest.itineraries` sin `ArrayMinSize(1)/ArrayMaxSize(6)` del contrato; `passengers` sin tope de grupo (RN-05) ni `NoDuplicatePassengers` (RF-068) |

---

## 3. Evidencia concreta (archivo y elemento afectado)

### C1 — Auth sin verificar + IDOR en lecturas

- **Archivo:** `src/modules/vuelos/common/owner.util.ts:8-25` — `resolveOwnerId()` hace `split('.')[1]` + `JSON.parse` sin verificar firma; sin `Bearer` o con token malformado devuelve `DEV_OWNER_ID = 'dev-owner'`.
- **Archivo:** `src/modules/vuelos/services/bookings.service.ts:83` — `createBooking` asigna `ownerId` así inferido a `Booking.ownerId`.
- **Archivo:** `src/modules/vuelos/vuelos.controller.ts:85-96` — `listBookings` sí filtra por `ownerId`, pero…
- **Archivo:** `src/modules/vuelos/services/bookings.service.ts:136-160` — `getBookingDetail`, `getBookingTickets`, `getTicketDetail` llaman a `findBookingOrThrow(bookingId)` **sin comparar `booking.ownerId`**; cualquier UUID adivinable expone reservas/tickets ajenos. El controlador (`vuelos.controller.ts:114-143`) ni siquiera extrae `Authorization` en esas rutas.

### C2 — Booking no atómico

- **Archivo:** `src/modules/vuelos/services/bookings.service.ts:42-133` — secuencia `findHoldOrThrow` → checks → `bookings.save` → `passengers.save` → `tickets.save` → `setHoldStatus(CONSUMED)` sin `QueryRunner`/transacción. Dos `POST /bookings` concurrentes con el mismo `holdId` en `HELD` superan ambos el check `hold.status !== 'HELD'` (`:51`) y crean dos bookings antes de que cualquiera marque `CONSUMED` (`:129`).
- **Archivo:** `src/modules/vuelos/services/offers.service.ts:155-158` — `setHoldStatus` es un `save` suelto, reutilizado para `RELEASED` y `CONSUMED` sin condición `WHERE status='HELD'`.

### C3 — Sin control de inventario

- **Archivo:** `src/modules/vuelos/entities/vuelo.entity.ts:37-38` — `asientosDisponibles` existe pero **ningún servicio lo lee para decrementar ni lo valida** (búsqueda en `search.service.ts` y `offers.service.ts` confirma cero referencias de escritura).
- **Archivo:** `src/modules/vuelos/services/offers.service.ts:36-52` — `getSeatmap` ignora `offerId` y genera `isAvailable: (rowNumber + charCode) % 5 !== 0` determinista; nunca consulta holds/bookings.
- **Archivo:** `src/modules/vuelos/services/search.service.ts:143-177` — `priceFamily` publica `availableSeats: vuelo.asientosDisponibles` como foto estática.

### C4 — `date` ignorado en flight-status

- **Archivo:** `src/modules/vuelos/services/flight-status.service.ts:11-25` — `dayStart/dayEnd` se calculan y **nunca se usan**; `findOne({ where: { codigoVuelo: flightNumber } })` devuelve el primer vuelo con ese código sin filtrar por fecha. Además `setHours(0,0,0,0)` usa zona local del servidor, no la del aeropuerto (el propio `business-rules.ts:31-34` admite la simplificación, pero aquí produce día erróneo).

### C5 — Stubs con forma de éxito

- **Archivo:** `src/modules/vuelos/vuelos.controller.ts:153-155,168-176,184-187,195-197,206-208,217-219,227-229,248-250,257-259` — `getBaggageOptions → []`, `addBaggage → {}`, `searchDateChange → []`, `confirmDateChange → {}`, `getCancellationQuote → {}`, `cancelBooking → {}`, `checkIn → {}`, `getBoardingPasses → {}`, `listWebhooks → []`, `createWebhook → {}`. Ninguno persiste (la entidad `WebhookSubscription` está registrada en `vuelos.module.ts:32` pero sin uso) ni devuelve `501`.

### C6 — Idempotencia frágil

- **Archivo:** `src/modules/vuelos/services/idempotency.service.ts:18-29` — `findReplay` luego `record` sin transacción ni `ON CONFLICT DO NOTHING`; dos reintentos paralelos con la misma key insertan dos filas contra `PrimaryColumn(key, route)` (`idempotency-record.entity.ts:8-12`) y uno falla con `QueryFailedError` (500) en vez de replay.
- **Archivo:** `src/modules/vuelos/services/offers.service.ts:59-62,128` y `bookings.service.ts:37-40,132` — el replay no compara hash del cuerpo; mismo `Idempotency-Key` con distinto `offerId`/`holdId`/pasajeros devuelve la respuesta del primer cuerpo.

### A1 — DTOs laxos (muestra; el patrón se repite)

- **Archivo:** `src/modules/vuelos/dto/search.dto.ts:60-69` — `MoneyAmountDto` sin ningún `class-validator`.
- **Archivo:** `src/modules/vuelos/dto/hold.dto.ts:11-17` — `cabinClass: string` con `IsString` (contrato: enum `ECONOMY/PREMIUM_ECONOMY/BUSINESS/FIRST`); `fareBrand` sin `IsIn`.
- **Archivo:** `src/modules/vuelos/dto/booking.dto.ts:47-49,63-65,84-86` — `passengerType/documentType/gender` con `IsString` (deben ser `IsEnum`); `:32-38,:76-82` — `email/phone/birthDate/documentExpiryDate` con `IsString` (deben ser `IsEmail/IsPhoneNumber/IsDateString`); `:110-112` — `holdId` con `IsString` (contrato: `format: uuid`).
- **Archivo:** `src/modules/vuelos/dto/webhooks.dto.ts:5-31` — `url` solo `IsString` (debe `IsUrl`), `events: string[]` solo `IsArray` (debe `IsIn` de los 12 eventos del YAML), `secret` sin `MinLength`.

### A2 — Pricing por pasajero ausente

- **Archivo:** `src/modules/vuelos/services/search.service.ts:76-82,165-175` — `priceFamily` emite un único `pricePerPassengerType[0]` (`ADULT`); `cheapestSum` suma el `total` de ese único tipo sin multiplicar por `adults/youths/children/infants`.
- **Archivo:** `src/modules/vuelos/services/offers.service.ts:90-104` — `lockedTotal` acumula un `total` por selección, tampoco multiplicado por Nº pasajeros, e ignora `request.passengersBreakdown` vs `offer.passengersBreakdown`.
- **Caso borde:** si `fareFamilies` está vacía, `Math.min(...[])` es `Infinity` (`search.service.ts:79-81`) → `grandTotal "Infinity"` persistido en `FlightOffer.grandTotal`.

### A3 — Seatmap sin validar oferta

- **Archivo:** `src/modules/vuelos/services/offers.service.ts:36` — `getSeatmap(offerId, segmentId)` no consulta `offers.findOne`; oferta inexistente o expirada devuelve 200 con filas inventadas. Ver también `vuelos.controller.ts:42` (`segmentId` opcional en código, requerido en YAML `vuelos-openapi.yaml` segmento `/offers/{offerId}/seatmap`).

### A4 — `listBookings` recorta el contrato

- **Archivo:** `src/modules/vuelos/vuelos.controller.ts:85-96` — recibe `createdFrom/createdTo/cursor` y los **descarta** al llamar `listBookings(ownerId, { pnr, status, limit })`.
- **Archivo:** `src/modules/vuelos/services/bookings.service.ts:162-179` — `status` se pasa crudo al `where` sin validar enum; `limit` sin tope (contrato: máx 50); sin cursor (`nextCursor` del contrato ausente).

### A5 — Guard de idempotencia ausente en postventa

- **Archivo:** `src/modules/vuelos/vuelos.controller.ts:47-48,98-99` — `holdOffer` y `createBooking` sí tienen `@UseGuards(IdempotencyKeyGuard)`; pero `addBaggage (:157-166)`, `confirmDateChange (:178-187)` y `cancelBooking (:199-208)` documentan `@ApiHeader Idempotency-Key required: true` **sin** `@UseGuards`.

### A6 — Pago opaco + colisiones no mapeadas

- **Archivo:** `src/modules/vuelos/services/bookings.service.ts:94` — `paymentReference` se guarda sin validar contra Payment API (documentado como RDA1, pero sin siquiera `MinLength`/formato).
- **Archivo:** `src/modules/vuelos/services/bookings.service.ts:217-236` — `generateUniquePnr` (10 intentos) y `generateETicketNumber` (13 dígitos) pueden colisionar contra `@Column(unique)` (`booking.entity.ts:19`, `ticket.entity.ts:18`); el `QueryFailedError` resultante cae en `VuelosProblemDetailsFilter` como 500 (ver A8).

### A7 — Cabeceras/parámetros no exigidos

- **Archivo:** `src/modules/vuelos/vuelos.controller.ts:33` — `search` recibe `X-Device-Fingerprint` (requerido en YAML y Swagger `ApiHeader required: true`) y lo ignora sin chequeo de vacío.
- **Archivo:** `src/modules/vuelos/vuelos.controller.ts:42,237` — `segmentId` y `date` llegan como `string | undefined` sin `BadRequest` si faltan (contrato: ambos `required: true`).

### A8 — ProblemDetails incompleto y con fuga

- **Archivo:** `src/modules/vuelos/common/problem-details.exception.ts:5-12` — solo 7 `code`; el YAML define ~25 (`SEAT_TAKEN`, `HOLD_EXPIRED`, `BAGGAGE_LIMIT_EXCEEDED`, `QUOTE_EXPIRED`, …).
- **Archivo:** `src/modules/vuelos/common/problem-details.filter.ts:22-29` — rama no-`HttpException` responde `status: 500` con `code: 'VALIDATION_FAILED'` (incoherente) y `detail: error.message` (fuga de stack/mensajes internos).
- **Archivo:** `src/modules/vuelos/vuelos.controller.ts` — solo declara `@ApiResponse 200/201/202/204`; ningún `400/404/409/410/422/429` del contrato.

### A9 — Estados de hold

- **Archivo:** `src/modules/vuelos/services/offers.service.ts:149-152,174-179` — `releaseHold` acepta cualquier estado previo (incluido `CONSUMED` → destruiría la trazabilidad de una reserva confirmada); `lazilyExpire` solo corre en `getHoldStatus`, así que `findHoldOrThrow` devuelve holds expirados como `HELD` hasta que alguien consulte el status.

### A10 — Entidad `Vuelo`

- **Archivo:** `src/modules/vuelos/entities/vuelo.entity.ts:24-28` — `fechaSalida/fechaLlegada: string` sobre `@Column({type:'timestamp'})` (debe ser `Date`; el `string` solo va en DTOs con `IsDateString`).
- **Mismo archivo `:18-22`** — `origenIATA/destinoIATA varchar(10)` sin `Check(origen!=destino)` ni patrón `^[A-Z]{3}$`; sin `@Index` ni `unique(codigoVuelo, fechaSalida)`.

### Medios / Bajos (evidencia puntual)

- **M1:** `src/modules/vuelos/services/search.service.ts:63-64`, `offers.service.ts:82-83` — `Number(config.get('TAX_RATE','0.15'))` y TTL sin `isNaN`/rango; `NaN` → `new Date(NaN)` (`expiresAt` inválido) o impuestos `NaN`.
- **M2:** ver A9 (`offers.service.ts:132-147` vs `:149-152`).
- **M3:** `src/modules/vuelos/services/bookings.service.ts:170-178` — `Promise.all(bookings.map(... tickets.find ...))` (N+1); `take: filters.limit` sin cursor.
- **M4:** `src/modules/vuelos/services/search.service.ts:118-134` — `Raw(alias => DATE(alias) = :date)` acopla a Postgres y evita índice por función; sin `toUpperCase()` de IATA. `:136-141` cross-product con `slice(0, 5)` silencioso.
- **M5:** cero `Logger/EventEmitter` en `services/`; SRS RF-095 sin outbox (confirmado por grep: ninguna emisión `booking.confirmed/ticket_issued/hold.expired`).
- **M6:** `src/modules/vuelos/entities/webhook-subscription.entity.ts:15-17` — `secret varchar(200)` en claro; controlador stub (C5) ni lo usa.
- **M7:** `src/modules/vuelos/seed/seed.ts:55-60,139-146` — `daysFromNow(...).toISOString()` con ms exactos vs igualdad estricta `where: { codigoVuelo, fechaSalida }` → re-seed duplica si los ms difieren; `synchronize` global (fuera de esta carpeta, `src/app.module.ts`) sin migraciones.
- **M8:** `services/*.spec.ts` — mocks de repositorios; sin test de doble-booking concurrente, TTL real, replay con cuerpo distinto ni colisión PNR/e-ticket.
- **B1–B5:** `vuelos.controller.ts:38,48,58,68,...` tags por método redundantes; `:12` `@Controller()` sin prefijo; `pricing.util.ts:10-17` float+`toFixed`; `bookings.service.ts:200,213` `.toISOString()` directo; `vuelos.controller.ts:47-56` sin `@HttpCode(201)`; `dto/search.dto.ts:47-58` sin `ArrayMinSize/ArrayMaxSize` ni tope RN-05.

---

## 4. Recomendación de corrección para cada hallazgo

| ID | Recomendación |
|----|---------------|
| C1 | Introducir `JwtAuthGuard` + `OwnerGuard`: verificar firma JWT (JWKS del IdP en RDA2; mientras tanto, fail-closed en vez de `dev-owner` para rutas con datos), propagar `ownerId` desde el guard (no del header crudo) y exigir `booking.ownerId === request.ownerId` en `getBookingDetail/getBookingTickets/getTicketDetail` (403 si no coincide). No loguear tokens. |
| C2 | Envolver `createBooking` en transacción TypeORM (`QueryRunner` con `pessimistic_write` sobre el hold: `findOne({ where:{holdId, status:'HELD'}, lock })` + re-check de expiración dentro de la tx; `save` de booking/pasajeros/tickets y `UPDATE holds SET status='CONSUMED' WHERE holdId=:id AND status='HELD'` condicional; si `affected===0` → 409). Alternativa mínima: `UPDATE ... WHERE status='HELD'` optimista antes de insertar. |
| C3 | Descontar `asientosDisponibles` al crear el hold (`UPDATE vuelos SET asientosDisponibles = asientosDisponibles - :pax WHERE id=:id AND asientosDisponibles >= :pax`; si `affected===0` → 409 `SEAT_TAKEN`), devolver al liberar/expirar/consumir-fallido, y hacer que `getSeatmap` cruce oferta + holds `HELD` vigentes + tickets emitidos en vez de pseudo-aleatorio. Añadir test de overbooking a 0 asientos. |
| C4 | Filtrar por fecha real: `where: { codigoVuelo, fechaSalida: Between(dayStartUTC, dayEndUTC) }` calculado en UTC (no `setHours` local), 404 `FLIGHT_STATUS_NOT_AVAILABLE` si no hay vuelo ese día; validar `date` con `IsDateString` y 400 si falta/inválido. Eliminar código muerto si se mantiene otra estrategia. |
| C5 | No devolver éxito falso: o implementar postventa/check-in/webhooks contra `Booking/Ticket/WebhookSubscription`, o responder `501 Not Implemented` (ProblemDetails `code: VALIDATION_FAILED` no; crear `NOT_IMPLEMENTED`) y excluirlos de Swagger público hasta RDA2. Nunca `return {}`/`[]` con 200. |
| C6 | Hacer idempotencia atómica y fiel: `INSERT ... ON CONFLICT (key, route) DO NOTHING RETURNING`, o `save().catch(QueryFailedError → findReplay)`; almacenar `requestHash (SHA-256 del body canónico)` y si la key existe con distinto hash → `422` (key reuse con payload distinto) en vez de replay ajeno. Añadir TTL/limpieza de `IdempotencyRecord`. |
| A1 | Endurecer DTOs: `IsEnum` (cabinClass, passengerType, documentType, gender, hold/booking status), `IsUUID(4)` (holdId/bookingId/offerId), `IsEmail/IsPhoneNumber/IsDateString/IsUrl`, `ArrayMinSize(1)/ArrayMaxSize(6)` en itineraries, `Min/Max`, `Matches(/^[A-Z]{3}$/)` en IATA/moneda/dinero (`/^\d+\.\d{2}$/`), `MinLength(secret)`, `@Type()` faltantes y validador de clase `origin!==destination`. |
| A2 | Cotizar por tipo de pasajero (tabla o factor por `ADULT/YOUTH/CHILD/INFANT`; `INFANT` sin asiento según RN-04), multiplicar por cantidades del breakdown, validar `passengersBreakdown` del hold contra la oferta, y guardar `pricingSnapshot` por `itineraryId×fareBrand`. Si no hay fare families → 500 controlado (`PRICING_UNAVAILABLE`) en vez de `"Infinity"`. |
| A3 | `getSeatmap` debe hacer `offers.findOne(offerId)` → 404 `OFFER_NO_LONGER_AVAILABLE` si falta, 410 `QUOTE_EXPIRED` si expiró, y resolver `segmentId` contra `offer.itineraries` (400 si no pertenece); luego componer disponibilidad desde inventario real (C3). |
| A4 | Crear `ListBookingsQueryDto` (`pnr`, `status IsEnum`, `createdFrom/To IsDateString`, `limit DefaultValuePipe(10)+ParseIntPipe+Max(50)`, `cursor` opaco base64 `createdAt+id`) y devolver `{ items, nextCursor }`; filtrar por rango en BD en vez de ignorarlo. |
| A5 | Añadir `@UseGuards(IdempotencyKeyGuard)` a `addBaggage/confirmDateChange/cancelBooking` (o quitar el `Idempotency-Key` de su Swagger hasta implementarlos, ver C5). Regla: todo `POST` transaccional exige guard + `record/replay`. |
| A6 | Validar `paymentReference` (formato mínimo + verificación contra Payment API en RDA2; mientras tanto `MinLength` y log de correlación) y mapear colisiones: capturar `QueryFailedError`23505 en PNR/e-ticket → reintentar PNR / regenerar e-ticket, y si agota → ProblemDetails 409/500 controlado sin exponer `error.message`. |
| A7 | Exigir `X-Device-Fingerprint` no vacío (400 si falta), `segmentId`/`date` requeridos con `BadRequest` si faltan, y documentar con `@ApiQuery/@ApiHeader required: true` coherente con el YAML. |
| A8 | Ampliar `ProblemDetailsCode` con el enum completo del YAML (`SEAT_TAKEN`, `HOLD_EXPIRED`, `BAGGAGE_LIMIT_EXCEEDED`, `QUOTE_EXPIRED`, …), corregir el filtro: unknowns → `code: 'INTERNAL_ERROR'`, `status: 500`, `detail` genérico (sin `error.message`), y declarar `@ApiResponse 400/404/409/410/422/429` por ruta. |
| A9 | Máquina de estados estricta: `releaseHold` solo desde `HELD` (desde `EXPIRED` → 410, desde `CONSUMED/RELEASED` → 409/404 según semántica), `setHoldStatus` con `UPDATE ... WHERE status=:expected`, y aplicar `lazilyExpire` (o mejor, un barrido/expiración en la propia query con `expiresAt`) en `findHoldOrThrow` y `createBooking`. |
| A10 | Migrar `Vuelo.fechaSalida/fechaLlegada: Date`, `origenIATA/destinoIATA char(3)` + `Check`, `@Index(['origenIATA','destinoIATA'])` y `@Unique(['codigoVuelo','fechaSalida'])`, `asientosDisponibles Check >= 0`; gestionar con migraciones (ver M7), no solo `synchronize`. |
| M1 | Validar env al arranque (`class-validator` sobre `ConfigService` o `zod`): `TAX_RATE` en `[0,1)`, TTLs enteros `>0`; fallar rápido con mensaje claro en vez de `NaN`. |
| M2 | Centralizar transición de holds en un método `transition(hold, from, to)` con update condicional y expiración perezosa siempre; añadir job/barrido de expirados que libere inventario (C3). |
| M3 | Eliminar N+1 con `leftJoin`/`find({ where:{bookingId: In(ids)} })` agrupado, e implementar cursor real (`WHERE (createdAt,id) < cursor ORDER BY createdAt DESC, id DESC LIMIT n+1`). |
| M4 | Normalizar IATA (`toUpperCase().trim()`) antes de buscar; reemplazar `DATE(alias)` por rango `Between(startUTC,endUTC)` indexable o columna `departureDate date`; documentar el tope de 5 combinaciones en Swagger o hacerlo configurable. |
| M5 | Añadir `Logger` por caso de uso + `correlation-id`, interceptor de tiempos, y `EventEmitter`/outbox para `booking.confirmed/ticket_issued/hold.expired` (preparar RDA2/webhooks). |
| M6 | Si se implementan webhooks (C5): hash `secret` (bcrypt/sha-256 + salt), nunca devolverlo en `GET`, firmar payloads `HMAC-SHA256`, cola con reintentos exponenciales + DLQ. Si no: retirar entidad del `forFeature` hasta usarla. |
| M7 | Apagar `synchronize` fuera de dev y versionar esquema con migraciones TypeORM; hacer el seed idempotente por clave de negocio (`codigoVuelo + date`) con `upsert`, no por timestamp exacto. |
| M8 | Añadir tests de concurrencia (doble booking mismo hold), TTL (hold expira → 410), idempotencia (misma key + distinto body → 422; reintento → replay sin segundo `save`), y unicidad (mock de `QueryFailedError` 23505). |
| B1 | Dejar `@ApiTags` a nivel de clase/grupo, quitar duplicados por método; definir `@Controller('flights')` (o `RouterModule`) y documentar el mapeo `api/v1/flights/*` ↔ `flights/v1` del YAML para evitar colisión con Alojamientos/Autos/Atracciones. |
| B2 | `MoneyAmount` con `@Matches(/^\d+\.\d{2}$/)` y transformer a centavos enteros para cálculo (o `Decimal.js`); `currency` con `Matches(/^[A-Z]{3}$/)`. |
| B3 | Normalizar fechas de respuesta con helper (`toISO(value: Date|string)`) en vez de `.toISOString()` directo. |
| B4 | Explicitar `@HttpCode(201)` en POST de creación, `@HttpCode(204)` en DELETE y `@HttpCode(202)` donde aplique async GDS. |
| B5 | Añadir `ArrayMinSize(1)/ArrayMaxSize(6)` a `itineraries`, `MaxTotalPassengers` (RN-05) y `NoDuplicatePassengers` (RF-068, por documento+nombre) como validadores de clase. |

---

## 5. Pruebas que deberían repetirse después de corregir

### 5.1 Contrato (contra `contracts/vuelos-openapi.yaml` v1.5.0.0)

1. **Schemas:** validador OpenAPI (`schemathesis`/`dredd`/`openapi-validator`) contra Swagger vivo para las 22 rutas; `SearchResponse/HoldResponse/BookingDetail/Ticket/FlightStatus` byte a byte. Hoy fallan postventa/check-in/webhooks (C5) y seatmap/listBookings (A3/A4).
2. **Happy path:** `POST /search` (1 y 6 itinerarios) → `POST /offers/hold` (201) → `GET hold` → `POST /bookings` (201) → `GET tickets` → `GET /flights/:n/status`; assert de formas y `grandTotal == lockedPrice`.
3. **Errores tipados:** `400` (IATA inválido, `origin==destination`, fingerprint ausente, `segmentId/date` ausentes), `404` (offer/hold/booking/ticket inexistente, vuelo-fecha inexistente), `409` (`SEAT_TAKEN`, doble booking, `release` de `CONSUMED`), `410` (offer/hold expirado), `422` (infantes>adultos, edad≠tipo, key rehusada con otro body), `429` (ráfaga de search); assert `application/problem+json` con `code` del YAML (A8).
4. **Regresión RDA1:** `GET /api/docs` carga; `npm run seed:vuelos` idempotente (M7); `POST /search` p95 `<3s` con dataset semilla.

### 5.2 Reglas de negocio y validación

5. **Unitarios:** RN-01 (`BOG==BOG` → 400), RN-02 (fecha pasada / tramo retorno anterior → 400), RN-04 (2 infantes/1 adulto → 422), RN-06 (niño declarado adulto y viceversa → 422) — existen en `business-rules.spec.ts`, re-ejecutar más los nuevos: RN-05 (tope grupo), `ArrayMaxSize(6)`, duplicados RF-068, `IsEnum/IsEmail/IsUrl/IsUUID` (A1/B5).
6. **Pricing:** 2 adultos + 1 niño + 1 infante → total = Σ(fare×factor×(1+tax)) por tipo, no 1×ADULT (A2); sin fare families → error controlado, no `"Infinity"`; `lockedPrice ===` cotizado en search para misma `fareBrand`.
7. **Query/params:** `limit=0/51/abc` → 400, ausente → 10; `cursor` inválido → 400; `createdFrom/To` filtran de verdad; `status` inválido → 400 (A4).

### 5.3 Seguridad, idempotencia y concurrencia

8. **Auth/propiedad (C1):** sin token → 401 (cuando se endurezca); token de usuario A leyendo booking de B → 403; `dev-owner` deja de ver todo.
9. **Idempotencia (C6/A5):** mismo `Idempotency-Key` 3× en `hold` y `bookings` → 1 sola fila y mismo cuerpo; key ausente/no-UUID → 400 del guard; misma key + body distinto → 422; concurrentes misma key → un 201 + un replay (sin 500 por PK).
10. **Concurrencia/inventario (C2/C3):** dos `POST /bookings` simultáneos mismo `holdId` → un 201 + un 409; vuelo con 1 asiento y dos holds paralelos → un 201/409 `SEAT_TAKEN` y `asientosDisponibles` nunca negativo; `releaseHold` de `CONSUMED` → 409, no `RELEASED`.
11. **TTL (M2/A9):** hold con TTL corto → `HELD→EXPIRED`, `GET` posterior 410, booking posterior 410 `QUOTE_EXPIRED`; expirados liberan inventario.

### 5.4 Persistencia, estados y no funcionales

12. **Migraciones:** `migration:run` desde cero sin `synchronize`; `revert` limpio; columnas `Vuelo` como `Date/char(3)` con índices (A10/M7).
13. **Flight-status (C4):** mismo `flightNumber` en dos fechas distintas → estados/fechas distintas; `date` ausente/inválida → 400; vuelo inexistente ese día → 404 (no el vuelo de otro día).
14. **Webhooks/postventa/check-in (C5/M6):** o 501 documentado, o ciclo completo `POST /webhooks` (201 sin exponer `secret`) → evento `booking.confirmed/ticket_issued` firmado HMAC → receptor dummy lo recibe; caída del receptor → backoff + DLQ.
15. **Carga y ruteo:** `POST /search` p95 `<3s` (k6/Artillery); rutas finales sin colisión entre dominios (`/api/v1/flights/*` vs alojamientos/autos/atracciones); `helmet`/CORS sin stack en 500.

> **Criterio de cierre:** §5.1–5.3 en CI por PR (`npm test` + validador OpenAPI); §5.4 antes de declarar RDA2. Adjuntar logs JUnit + reporte del validador junto a este informe.
