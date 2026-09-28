# AUDITORIA.md — Módulo `src/modules/vuelos`

> **Proyecto:** Proyect-Flights-RDA1 · **Fecha:** 2026-09-28
> **Alcance:** `vuelos.controller.ts`, `vuelos.service.ts`, `vuelos.module.ts`, `entities/vuelo.entity.ts`, `dto/*.ts` (7 ficheros), `README.md`, `docs/Levantamiento_Requerimientos_LATAM_Nucleo_Vuelos_1.md`, contrato `contracts/vuelos-openapi.yaml` v1.5.0.0, más contexto `src/main.ts`, `src/app.module.ts`, `src/common/common.module.ts`, `src/common/guards/idempotency-key.guard.ts`, `package.json`.

---

## 1. Resumen ejecutivo

El módulo `src/modules/vuelos` es actualmente una **plantilla de contrato con respuestas simuladas (mocks)**, tal como lo declara su propio `README.md`. Existe correspondencia nominal del 100% con el contrato (los 22 endpoints del `vuelos-openapi.yaml` están declarados en el controlador), pero **correspondencia funcional del 0%**: todos los handlers devuelven `{}` / `[]`, ninguno delega al servicio, el servicio es un CRUD legado no utilizado, la entidad es huérfana (no registrada en TypeORM) e incompatible con el modelo Offer/Hold/Booking/Ticket del contrato, no hay autenticación/autorización real, no hay validación de idempotencia, no hay persistencia, y el ruteo colisionará con otros dominios.

**Consecuencia:** el módulo sirve para la fase RDA1 (despliegue independiente en Render y guía visual en Swagger), pero **bloquea la fase RDA2 (integración real entre APIs)**. Ningún equipo consumidor puede desarrollar contra él, y si se conecta tal cual a producción habría riesgo de cobros duplicados, reservas inconsistentes, datos inválidos aceptados y exposición pública de endpoints protegidos.

**Distribución de hallazgos:** 7 críticos · 7 altos · 6 medios · 5 bajos. Se recomienda no iniciar integración hasta cerrar los críticos y altos.

---

## 2. Hallazgos

### 2.1 Críticos (bloquean integración / riesgo de pérdida monetaria o seguridad)

| ID | Hallazgo |
|----|----------|
| C1 | Controlador devuelve mocks y nunca llama al servicio |
| C2 | Servicio muerto: CRUD legado no consumido por nadie |
| C3 | Módulo sin persistencia: entidad no registrada, `CommonModule` vacío |
| C4 | Entidad `Vuelo` incompatible con el dominio del contrato |
| C5 | Seguridad OAuth2 solo decorativa: endpoints protegidos son públicos |
| C6 | Idempotencia documentada pero no aplicada: riesgo de doble cargo |
| C7 | Ruteo sin prefijo de dominio: colisión entre módulos y divergencia del contrato |

### 2.2 Altos (incumplimiento de contrato / aceptación de datos inválidos)

| ID | Hallazgo |
|----|----------|
| A1 | DTOs con validación insuficiente (campos críticos como `string` genérico) |
| A2 | Reglas de negocio del SRS no codificadas (RN-01, RN-04, límites) |
| A3 | Query/path params sin pipes ni validación (`limit`, `segmentId`, `date`) |
| A4 | Respuestas no conformes al contrato (objetos vacíos vs. schemas obligatorios) |
| A5 | Errores `ProblemDetails` (400/404/409/410/422/429) ni documentados ni implementados |
| A6 | Dependencias de seguridad y resiliencia ausentes en `package.json` y `main.ts` |
| A7 | `synchronize: true` en no-producción sin migraciones |

### 2.3 Medios (deuda técnica / funcionalidad incompleta)

| ID | Hallazgo |
|----|----------|
| M1 | Código muerto: `CreateVueloDto` y `VueloResponseDto` |
| M2 | `_links` HATEOAS en `VueloResponseDto` no contratado |
| M3 | Paginación por cursor (`nextCursor`) no implementada |
| M4 | Webhooks sin dispatcher, sin firma ni reintentos |
| M5 | Sin logging, tracing ni eventos de dominio (RF-095) |
| M6 | Brecha de trazabilidad SRS → YAML → código (millas, 3DS, antifraude, PNR) |

### 2.4 Bajos (calidad / convención)

| ID | Hallazgo |
|----|----------|
| B1 | `@ApiTags` redundante por método además de clase |
| B2 | Montos monetarios como `string` sin transformer/validación de formato decimal |
| B3 | Fechas de entidad tipadas `string` sobre columna `timestamp` |
| B4 | Falta `@HttpCode(201/204)` explícito en POST/DELETE |
| B5 | TODO en comentario, falta JSDoc y scripts de test/lint funcionales |

---

## 3. Evidencia concreta (archivo y elemento afectado)

### C1 — Controlador mock sin delegación

- **Archivo:** `src/modules/vuelos/vuelos.controller.ts:13-14` — `constructor(private readonly vuelosService: VuelosService) {}` inyecta el servicio pero ningún método lo usa.
- **Archivo:** `src/modules/vuelos/vuelos.controller.ts:21-23` — `search(...) { return {}; }` ignora `SearchRequestDto` y `X-Device-Fingerprint`.
- **Archivo:** `src/modules/vuelos/vuelos.controller.ts:30-32, 41-43, 51-53, 61-63, 71-80, 89-91, 99-101, 109-111, 120-122, 131-133, 142-144, 152-154, 163-165, 173-175, 184-186, 195-197, 205-207, 215-217, 225-227, 235-237, 244-246` — los 22 handlers devuelven `{}`, `[]` o `return;`.

### C2 — Servicio muerto

- **Archivo:** `src/modules/vuelos/vuelos.service.ts:6-16` — `create(createVueloDto)`, `findAll()`, `findOne(id)`; ninguno corresponde a `search/hold/booking/ticket/check-in/webhook`.
- **Evidencia cruzada:** cero importaciones de `VuelosService` fuera de `vuelos.controller.ts` y `vuelos.module.ts`.

### C3 — Módulo sin persistencia

- **Archivo:** `src/modules/vuelos/vuelos.module.ts:6-10` — `imports: [CommonModule]`, sin `TypeOrmModule.forFeature([Vuelo])`.
- **Archivo:** `src/common/common.module.ts:1-8` — `imports/exports/providers` vacíos; importar `CommonModule` no aporta nada.
- **Archivo:** `src/app.module.ts:20-29` — `autoLoadEntities: true` no sirve si la entidad nunca se registra en un `forFeature`.

### C4 — Entidad incompatible

- **Archivo:** `src/modules/vuelos/entities/vuelo.entity.ts:4-36` — modelo plano `aerolinea, codigoVuelo, origenIATA, destinoIATA, fechaSalida, fechaLlegada, precioBase, asientosDisponibles`.
- **Elementos ausentes vs. contrato:** `Hold(holdId, expiresAt, lockedPrice, HELD/RELEASED/EXPIRED/CONSUMED)`, `Booking(bookingId, pnr 6 chars, PENDING/CONFIRMED/...)`, `Ticket(eTicketNumber 13 dígitos, ISSUED/FAILED...)`, `Passenger`, `FlightSegment(marketingCarrier vs operatingCarrier)`, `CabinPricing/FareBrand`, `WebhookSubscription`.
- **Tipos erróneos:** `fechaSalida: string` + `fechaLlegada: string` sobre `@Column({ type: 'timestamp' })` (`vuelo.entity.ts:21-25`); debe ser `Date`.
- **Sin índices/constraints:** sin `@Index`, sin `Check(origen!=destino)`, `origenIATA varchar(10)` sin patrón `^[A-Z]{3}$`.

### C5 — Seguridad decorativa

- **Archivo:** `src/modules/vuelos/vuelos.controller.ts:37, 47, 57, 68, 84, 94, 104, ...` — 18× `@ApiSecurity('OAuth2Security', [...])` sin ningún `UseGuards`, `AuthGuard`, `JwtStrategy` o validación de scopes (`flights:read/hold/book/cancel/webhooks` definidos en `vuelos-openapi.yaml:659-678`).
- **Archivo:** `src/main.ts:6-29` — sin `helmet`, sin CORS, sin `ThrottlerModule`, sin esquema OAuth2 en `DocumentBuilder` (contrato exige `429 + Retry-After` en `vuelos-openapi.yaml:55, 83, 720-729`).

### C6 — Idempotencia no aplicada

- **Archivo:** `src/modules/vuelos/vuelos.controller.ts:41, 89, 142, 163, 184` — lee `@Headers('Idempotency-Key')` como `string` sin validar formato UUID ni persistir/deduplicar.
- **Archivo:** `src/common/guards/idempotency-key.guard.ts:17-56` — guard `IdempotencyKeyGuard` correcto y disponible, con **cero usos** en el módulo (búsqueda de `@UseGuards` vacía).

### C7 — Ruteo con colisión

- **Archivo:** `src/modules/vuelos/vuelos.controller.ts:12` — `@Controller()` sin prefijo.
- **Archivo:** `src/main.ts:9` — `app.setGlobalPrefix('api/v1')` → rutas reales `/api/v1/search`, `/api/v1/bookings`.
- **Contrato:** `contracts/vuelos-openapi.yaml:12-16` — `servers: https://api.booking-hub.com/flights/v1`.
- **Colisión:** `src/app.module.ts:37-40` prevé descomentar `Alojamientos/Autos/Atracciones`, todos colisionarían en `/api/v1/search`.

### A1 — Validación insuficiente en DTOs

- **Archivo:** `src/modules/vuelos/dto/search.dto.ts:60-69` — `MoneyAmountDto` sin ningún decorador `class-validator`.
- **Archivo:** `src/modules/vuelos/dto/hold.dto.ts:12` — `cabinClass: string` con `IsString`; contrato exige enum `ECONOMY/PREMIUM_ECONOMY/BUSINESS/FIRST` (`vuelos-openapi.yaml:960-966`).
- **Archivo:** `src/modules/vuelos/dto/booking.dto.ts:110-111` — `holdId: string` con `IsString`; contrato exige `format: uuid` (`vuelos-openapi.yaml:1133-1135`).
- **Archivo:** `src/modules/vuelos/dto/booking.dto.ts:32-38, 75-82` — `email/phone/birthDate/documentExpiryDate` con `IsString`; deben ser `IsEmail/IsPhoneNumber/IsDateString`.
- **Archivo:** `src/modules/vuelos/dto/booking.dto.ts:46-48, 63-65, 84-86` — `passengerType/documentType/gender` con `IsString`; deben ser `IsEnum`.
- **Archivo:** `src/modules/vuelos/dto/webhooks.dto.ts:7-31` — `url` solo `IsString` (debe `IsUrl`), `events: string[]` solo `IsArray` (debe `IsIn` de los 12 eventos `vuelos-openapi.yaml:1458-1470`), `secret` sin `MinLength`.

### A2 — Reglas de negocio no codificadas

- **RN-01/RF-011:** `origin !== destination` y patrón `^[A-Z]{3}$` solo a nivel campo (`search.dto.ts:8, 13`), sin validador de clase.
- **RN-04:** `infants <= adults` ausente en `PassengerBreakdownDto` (`search.dto.ts:21-45`).
- **Contrato `SearchRequest.itineraries minItems:1 maxItems:6`** (`vuelos-openapi.yaml:792-794`): `SearchRequestDto.itineraries` (`search.dto.ts:49-52`) sin `ArrayMinSize/ArrayMaxSize`.
- **RN-05 (tope pasajeros/grupo), RN-06 (edad a fecha del primer vuelo), RF-068 (duplicados):** sin implementación.

### A3 — Params sin pipes

- **Archivo:** `src/modules/vuelos/vuelos.controller.ts:76` — `@Query('limit') limit: number = 10` sin `ParseIntPipe`; llega como `string`, sin `Max(50)` del contrato (`vuelos-openapi.yaml:189-194`).
- **Archivo:** `src/modules/vuelos/vuelos.controller.ts:30` — `@Query('segmentId') segmentId: string` opcional en código, requerido en contrato (`vuelos-openapi.yaml:69-73`).
- **Archivo:** `src/modules/vuelos/vuelos.controller.ts:215` — `@Query('date') date: string` sin `IsDateString`; requerido en contrato (`vuelos-openapi.yaml:643-647`).
- **Archivo:** `src/modules/vuelos/vuelos.controller.ts:21` — `X-Device-Fingerprint` requerido en Swagger pero sin chequeo de vacío.

### A4 — Respuestas vacías vs. schemas obligatorios

- `POST /search` debe devolver `SearchResponse{totalOffers, offers: FlightOffer[]}` (`vuelos-openapi.yaml:832-843`); devuelve `{}`.
- `POST /offers/hold` debe devolver `HoldResponse{holdId uuid, HELD, expiresAt, lockedPrice}` (`vuelos-openapi.yaml:1081-1103`); devuelve `{}`.
- `GET baggage-options` / `date-change/search` / `webhooks` deben devolver arrays tipados; devuelven `[]` sin forma.

### A5 — Errores no documentados

- Controlador solo declara `@ApiResponse 200/201/202/204`. Contrato exige `ProblemDetails` 400/404/409/410/422/429 con `code` enumerado (`vuelos-openapi.yaml:679-783`, 25 códigos como `SEAT_TAKEN`, `HOLD_EXPIRED`, `PAYMENT_REFERENCE_INVALID`).
- Sin filtro global que emita `{type, title, status, code, invalidParams}`.

### A6 — Dependencias ausentes

- **Archivo:** `package.json:17-30` — faltan `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/throttler`, `helmet`; sin scripts `test`, `test:e2e`, `migration:*`.
- **Archivo:** `src/main.ts` — sin `helmet()`, sin `enableCors()`, sin `ThrottlerGuard`, sin `DocumentBuilder.addOAuth2()`.

### A7 — Sincronización peligrosa

- **Archivo:** `src/app.module.ts:28` — `synchronize: NODE_ENV !== 'production'` sin migraciones; riesgo de pérdida/alteración de esquema en staging.

### M1–M6, B1–B5 (evidencia resumida)

- **M1:** `dto/create-vuelo.dto.ts:1-42`, `dto/vuelo-response.dto.ts:1-31` — ningún controlador/servicio los importa.
- **M2:** `dto/vuelo-response.dto.ts:4` — `extends BaseResponseDto` (`src/common/dto/base-response.dto.ts:3-12`) añade `_links` no definido en el YAML.
- **M3:** `vuelos.controller.ts:71-80` — `cursor` recibido e ignorado; contrato `BookingListResponse{nextCursor, items}` (`vuelos-openapi.yaml:1226-1250`) no modelado.
- **M4:** `vuelos.controller.ts:225-246` — CRUD de suscripciones mock, sin entity, sin `POST` firmado `HMAC(secret)`, sin reintentos/backoff, sin `callbacks.flightEvent` (`vuelos-openapi.yaml:490-501`).
- **M5:** cero `Logger`, cero interceptores; SRS RF-095 (eventos `booking.confirmed/ticket_issued/...`) sin `EventEmitter`/outbox.
- **M6:** SRS MOD-01 (catálogo/contexto RF-001..008), MOD-08 (3DS/antifraude/millas RF-080..089), MOD-09 (PNR/e-ticket RF-090..096) sin reflejo en YAML/DTOs/entidad.
- **B1:** `vuelos.controller.ts:26, 36, 46, ...` — `@ApiTags` repetido por método cuando la clase ya declara `@ApiTags('Búsqueda y Catálogo')` (`:11`).
- **B2:** `search.dto.ts:64-68` — `baseFare/taxes/total: string` sin `@Matches(/^\d+\.\d{2}$/)` ni transformer a centavos.
- **B3:** `vuelo.entity.ts:21-25` (ver C4).
- **B4:** `vuelos.controller.ts:55-63, 238-246` — `DELETE` sin `@HttpCode(204)`; `POST hold` sin `@HttpCode(201)`.
- **B5:** `search.dto.ts:71` — comentario `// ... other response DTOs ...`; sin JSDoc en servicio/entidad; `package.json:8-15` sin `test`.

---

## 4. Recomendación de corrección para cada hallazgo

| ID | Recomendación |
|----|---------------|
| C1 | Implementar `VuelosService` real (o gateway al PSS/GDS) y hacer que cada handler delegue con DTOs tipados y retorne DTOs de respuesta. Eliminar `return {}/[]`. Añadir `take-home` intermedio: mocks con forma válida del contrato (ej. `HoldResponse` con `holdId` uuid) si la integración real aún no existe. |
| C2 | Borrar el CRUD `create/findAll/findOne` o moverlo a un `CatalogoVuelosService` separado. Crear métodos `searchOffers(), holdOffer(), getHold(), releaseHold(), createBooking(), ...` con firmas alineadas al YAML. |
| C3 | Registrar `TypeOrmModule.forFeature([Hold, Booking, Ticket, ...])` en `VuelosModule`; poblar `CommonModule` (filtros, guards, interceptores compartidos) o dejar de importarlo. |
| C4 | Diseñar modelo real: `Offer{offerId, itineraries, grandTotal}`, `Hold{holdId PK uuid, status enum, expiresAt, lockedPrice}`, `Booking{bookingId PK, pnr char(6) unique, status enum, grandTotal}`, `Ticket{eTicketNumber char(13) unique}`, `Passenger`, `FlightSegment(marketingCarrier, operatingCarrier)`. Cambiar fechas a `Date`, `origen/destino char(3)` con `Check`, índices en `(codigoVuelo, fechaSalida)` y `(origen, destino)`. Crear migraciones iniciales. |
| C5 | Añadir `@nestjs/jwt` + `passport-jwt`, `JwtAuthGuard` global o por ruta, `ScopesGuard` que valide `flights:*` del YAML. Mantener `security: []` solo en `POST /search`, `GET seatmap`, `GET status`. Configurar `DocumentBuilder.addOAuth2()` en `main.ts`. |
| C6 | Aplicar `@UseGuards(IdempotencyKeyGuard)` en los 6 POST transaccionales (`hold`, `bookings`, `baggage`, `date-change`, `cancel`); añadir tabla `IdempotencyKey{key PK uuid, endpoint, hashBody, response, createdAt}` con TTL y retorno replay ante reintento. Validar `paymentReference` contra Payment API antes de emitir. |
| C7 | Cambiar a `@Controller('flights')` (o configurar `RouterModule`/`app.setGlobalPrefix('api')` + prefijo por módulo) para obtener `/api/v1/flights/search`, y documentar el mapeo hacia `https://api.booking-hub.com/flights/v1` vía gateway. Verificar que `Alojamientos/Autos/Atracciones` usen sus propios prefijos. |
| A1 | Endurecer DTOs: `IsEnum` (cabinClass, passengerType, documentType, gender, eventos webhook), `IsUUID` (holdId/bookingId), `IsEmail/IsPhoneNumber/IsDateString/IsUrl`, `ArrayMinSize(1)/ArrayMaxSize(6)`, `Min/Max`, `IsInt`, `Matches(/^[A-Z]{3}$/)`, `MinLength(secret)`. Añadir `@Type()` faltantes y validadores de clase (`origin!==destination`). |
| A2 | Implementar validadores custom: `IsDifferentIata`, `InfantsLteAdults`, `MaxPassengers(9)`, `AgeMatchesType` (edad a fecha del primer vuelo), `NoDuplicatePassengers`. Cubrir RN-01..RN-08 prioritarios. |
| A3 | Usar `@Query('limit', new DefaultValuePipe(10), ParseIntPipe)` + `Max(50)`, DTO dedicado `ListBookingsQueryDto` (`pnr, status enum, createdFrom/To IsDateString, limit, cursor`), `BadRequest` si `segmentId/date/fingerprint` ausentes o malformados. |
| A4 | Crear `SearchResponseDto, HoldResponseDto, BookingDetailDto, TicketListResponseDto, ...` espejo del YAML y retornarlos. Activar pruebas de contrato (ver §5). |
| A5 | Documentar `@ApiResponse({status:400/404/409/410/422/429})` en cada ruta e implementar `ProblemDetailsFilter` global que emita `{type, title, status, code, detail, invalidParams}` con los 25 `code` del contrato. Mapear `SEAT_TAKEN→409`, `QUOTE_EXPIRED→410`, `INFANT_SEAT_NOT_ALLOWED→422`. |
| A6 | Añadir `helmet`, `@nestjs/throttler` (ej. 100 req/min search, 20 req/min booking), CORS restrictivo, `addBearerAuth/addOAuth2` en Swagger. Añadir scripts `test`, `test:e2e`, `typeorm migration:*`. |
| A7 | Desactivar `synchronize` (poner `false` siempre) y gestionar esquema solo con migraciones TypeORM versionadas. |
| M1 | Eliminar `CreateVueloDto`/`VueloResponseDto` o marcarlos `@deprecated` y excluirlos de Swagger hasta definir catálogo real (MOD-01). |
| M2 | Quitar `extends BaseResponseDto` de respuestas de vuelos o extender el contrato con `_links` si HATEOAS es decisión arquitectónica. |
| M3 | Implementar paginación por cursor opaco (base64 de `createdAt+id`) con `limit<=50` y `nextCursor`; reutilizar `common/dto/pagination-query.dto.ts`. |
| M4 | Persistir `WebhookSubscription{id, url, events[], secretHash}`, firmar payloads `HMAC-SHA256(secret)`, implementar cola con reintentos exponenciales y endpoint de reintento/DLQ. No devolver `secret` en `GET`. |
| M5 | Añadir `Logger` por operación (`search/hold/book`), `correlation-id`, interceptor de tiempos, y `EventEmitter` + outbox para `booking.confirmed/ticket_issued/hold.expired/...`. |
| M6 | Crear matriz de trazabilidad `SRS(RF/RN) → YAML(schema/path) → código(DTO/entidad)`; decidir qué requisitos de millas/3DS/antifraude/PNR quedan como delegación documentada vs. implementación propia. |
| B1 | Dejar `@ApiTags` solo a nivel clase o por grupo funcional; evitar duplicados por método. |
| B2 | Definir `MoneyAmount` con validación de decimal (`@Matches(/^\d+\.\d{2}$/)`) y transformer a centavos/`Decimal.js` para evitar errores de coma flotante; `currency` con `@Matches(/^[A-Z]{3}$/)`. |
| B3 | Cambiar `fechaSalida/fechaLlegada: Date` en la entidad (mantener `string ISO` solo en DTOs con `IsDateString`). |
| B4 | Añadir `@HttpCode(201)` en `POST hold/webhooks`, `@HttpCode(204)` en `DELETE`, `@HttpCode(202)` donde aplique flujo asíncrono GDS. |
| B5 | Convertir el TODO de `search.dto.ts:71` en `SearchResponseDto` real; añadir JSDoc mínima y scripts `lint/format/test` en CI. |

---

## 5. Pruebas que deberían repetirse después de corregir

### 5.1 Contrato (obligatorias, contra `contracts/vuelos-openapi.yaml`)

1. **Validación de schemas:** ejecutar validador OpenAPI (ej. `openapi-validator` / `schemathesis` / `dredd`) contra Swagger vivo para los 22 endpoints; verificar `SearchResponse`, `HoldResponse`, `BookingDetail`, `Ticket`, `FlightStatus`, `WebhookSubscription` byte a byte.
2. **Ejemplos extremo a extremo:** `POST /search` multidestino (1 y 6 itinerarios) → `POST /offers/hold` → `GET hold` → `POST /bookings` → `GET tickets` → `POST check-in` → `GET boarding-passes`; assert de `201/200` y formas.
3. **Errores tipados:** forzar `400` (IATA inválido, `origin==destination`, `infants>adults`), `404` (hold/booking inexistente), `409` (`SEAT_TAKEN`, doble booking), `410` (hold expirado), `422` (`INFANT_SEAT_NOT_ALLOWED`), `429` (ráfaga de search); assert de `application/problem+json` con `code` correcto.
4. **Regresión RDA1:** `GET /api/docs` carga, `POST /search` responde `<3s p95` con dataset semilla.

### 5.2 Validación y reglas de negocio

5. **DTOs unitarios:** `SearchRequestDto` (origen=destino rechazado, 0 y 7 itinerarios rechazados), `PassengerBreakdownDto` (2 infantes/1 adulto rechazado), `BookingRequestDto` (email/teléfono/fecha inválidos rechazados, `holdId` no-uuid rechazado), `WebhookSubscriptionDto` (url no-uri y evento desconocido rechazados).
6. **Query params:** `limit=0/51/abc` → `400`; `limit` ausente → `10`; `cursor` inválido → `400`; `segmentId/date` ausentes → `400`.

### 5.3 Seguridad e idempotencia

7. **Auth/scopes:** sin token → `401`; token sin scope (`flights:book` en `POST /bookings`) → `403`; `GET /search|seatmap|status` públicos → `200`.
8. **Idempotencia:** `POST /offers/hold` y `POST /bookings` con misma `Idempotency-Key` reintentados 3× → una sola reserva/cargo, misma respuesta replay; key ausente o no-uuid → `400` (`missing/invalid-idempotency-key` del guard).
9. **Rate-limit:** ráfaga `POST /search` > umbral → `429` con header `Retry-After`.

### 5.4 Persistencia y concurrencia

10. **Migraciones:** `migration:run` desde cero crea esquema sin `synchronize`; `migration:revert` limpio.
11. **Hold TTL:** crear hold con TTL corto, verificar `HELD→EXPIRED`, `GET` posterior → `410`, intento de booking → `410 QUOTE_EXPIRED/OFFER_NO_LONGER_AVAILABLE`.
12. **Concurrencia de asientos:** dos `POST /bookings` simultáneos sobre el mismo `holdId`/asiento → uno `201`, otro `409 SEAT_TAKEN`; sin overbooking en BD.
13. **Cancel/postventa:** `GET cancellation-quote` → `POST cancel` con `quoteId` expirado → `410`; `addBaggage` sobre límite → `409 BAGGAGE_LIMIT_EXCEEDED`.

### 5.5 Webhooks y asincronía

14. **Suscripción:** `POST /webhooks` → `201` con `id` uuid y sin exponer `secret`; `GET` no filtra `secret`; `DELETE` → `204`, segundo `DELETE` → `404`.
15. **Entrega:** emitir `booking.confirmed/ticket_issued` → receptor dummy recibe payload firmado; caída del receptor → reintentos con backoff y DLQ; verificar `callbacks.flightEvent` del contrato.

### 5.6 No funcionales y despliegue

16. **Carga:** `POST /search` p95 `<3s`, catálogo `<300ms`, revalidación `<2s` (umbrales SRS RNF-01/02) con k6/Artillery.
17. **Ruteo:** assert de rutas finales `/api/v1/flights/*` sin colisión con `alojamientos/autos/atracciones`; health-check `GET /health` → `200`.
18. **Seguridad base:** cabeceras `helmet`, CORS denegando origen no permitido, sin volcado de stack en `500`.

> **Criterio de cierre:** repetir §5.1–5.3 en CI por cada PR; §5.4–5.6 antes de declarar RDA2. Guardar evidencias (logs JUnit + reportes de validador OpenAPI) junto a este informe.
