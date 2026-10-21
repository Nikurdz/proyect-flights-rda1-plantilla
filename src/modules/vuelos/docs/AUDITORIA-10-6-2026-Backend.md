# Auditoría no destructiva de backend — Módulo `src/modules/vuelos`

> **Archivo:** `src/modules/vuelos/docs/AUDITORIA-10-6-2026-Backend.md` · **Fecha:** 2026-10-06
> **Alcance:** solo backend de `src/modules/vuelos/` — núcleo GDS (`vuelos.controller.ts`, `vuelos-core.module.ts`, `vuelos.module.ts`, `services/`, `auth/`, `common/`, `dto/`, `entities/`, `seed/`, `migrations/`, `testing/`) + e-commerce (`ecommerce/`: identidad, mercados, catálogo, ofertas, pagos, órdenes, notificaciones, admin/observabilidad, `common/`, `seed/`). Excluye `frontend/`. Referencia de contrato: `contracts/vuelos-openapi.yaml` v1.5.0.0.
> **Método:** solo lectura. No se modificó ningún archivo existente; este informe es el único archivo creado en esta pasada.
> **Contexto:** commits recientes implementaron postventa, check-in, boarding passes y webhooks ("no 501 left"), QR firmado por ticket, admin de asientos y observabilidad. Varios hallazgos críticos de auditorías del 10-04 se verifican abajo como **CORREGIDOS**.

---

## 1. Resumen ejecutivo

El backend está en su mejor estado hasta la fecha. Lo verificado como sólido debe preservarse: **no queda ningún 501 ni stub con éxito falso** en el contrato (postventa, check-in/boarding y webhooks delegan a servicios reales); atomicidad de hold/booking/inventario/asientos por UPDATE condicional + lock pesimista + índice único `(vueloId, seatNumber)`; idempotencia `(key, ruta, owner)` con hash de cuerpo, 422 ante cuerpo distinto y 409 ante reclamo en curso; PII de pasajeros y secreto de webhook cifrados en reposo (AES-256-GCM); QR `v1.`/boarding firmados por HKDF sin datos personales y con comparación en tiempo constante; webhooks con secreto cifrado, firma HMAC, reintentos con backoff, lease multi-instancia y defensa SSRF; saga de compra en transacción única con compensación `FALLIDA_COMPENSADA` que ya no lanza; reconciliador de pagos pendientes cada 60 s; back-office tras `JwtAuthGuard + RolesGuard + @Roles('ADMIN')` con tests 401/403.

Riesgo residual (ningún crítico abierto): **dinero y entregabilidad en bordes**. El quote de cancelación reprorratea impuestos desde el `precioBase` vivo en vez del desglose congelado; el seatmap ignora holds vivos (sobreestima y deja el `SEAT_TAKEN` para el booking); el dedup del adaptador simulado vive en un `Map` en memoria; la rama de compensación puede lanzar si el mercado desapareció entre el lock y el `compensar()`; el rate-limit, aunque ampliado (login/guest/verify/ofertas/compra/recovery/verifyQR), sigue en memoria por proceso; y no hay outbox (declarado para RDA1), mitigado por reconciliador + `UQ_eventoId`. En higiene quedan: filas basura de `DateChangeOffer`/`CancellationQuote` por búsqueda/cotización, `quantity @Max(5)` vs cap real 2, enum de check-in con estados inalcanzables, DTO de webhook que rechaza `http` local, eventos `flight.*` sin productor GDS, y `toMinorUnits` sobre `number` proveniente de `numeric`.

**Distribución:** 0 críticos abiertos (5 históricos verificados corregidos) · 6 altos · 9 medios · 8 bajos.

---

## 2. Hallazgos

### 2.1 Críticos — 0 abiertos

No hay hallazgos críticos abiertos. Verificados como corregidos respecto a auditorías del 10-04:

| ID | Hallazgo histórico | Estado |
|----|--------------------|--------|
| C-CERR-1 | Stubs 501 / éxito falso en postventa, check-in y webhooks | CORREGIDO: todo delega a servicios reales; `grep 501` solo devuelve mapeos de formato |
| C-CERR-2 | Booking/hold/inventario no atómicos, oversell posible | CORREGIDO: UPDATE condicional + `pessimistic_write` + consumo `WHERE HELD` + UNIQUE de asiento |
| C-CERR-3 | Idempotencia con carrera y sin amarre al cuerpo | CORREGIDO: claim `INSERT..ON CONFLICT DO NOTHING`, completion en la misma tx, 422/409, 120 s stale, purga 24 h |
| C-CERR-4 | PII de pasajeros GDS en claro | CORREGIDO: `encryptedJson` AES-256-GCM + test de ciphertext |
| C-CERR-5 | `FALLIDA_COMPENSADA` se perdía si `anular()` lanzaba | CORREGIDO: `anular()` nunca lanza (parquea `ANULACION_PENDIENTE`); `compensar` siempre registra |

### 2.2 Altos (dinero, reembolso, inventario lógico, resiliencia de pago)

| ID | Hallazgo |
|----|----------|
| A1 | El quote de cancelación reprorratea impuestos desde el `precioBase` vivo, no del desglose congelado |
| A2 | Seatmap ignora holds vivos: sobreestima disponibilidad; el conflicto aparece tarde como 409 en booking |
| A3 | Dedup del adaptador simulado en `Map` en memoria: se pierde al reiniciar / multi-instancia |
| A4 | `compensar()` puede lanzar si el mercado desapareció tras el lock → key liberada y 2ª `FALLIDA_COMPENSADA` en reintento |
| A5 | Rate-limit ampliado pero en memoria por proceso; `@Ip()` exige `TRUST_PROXY=1` tras proxy |
| A6 | Sin outbox (declarado RDA1): crash entre commit y publicación deja `EMITIDA` sin email; mitigado por reconciliador |

### 2.3 Medios (reglas, contrato menor, operativa)

| ID | Hallazgo |
|----|----------|
| M1 | `searchOptions()` de date-change inserta hasta 5 filas por búsqueda sin dedup ni purga (basura acumulada) |
| M2 | `quote()` de cancelación inserta una fila `OPEN` por cada GET (cotizar N veces = N filas) |
| M3 | `BASIC` (`seatSelectionIncluded:false`) puede reservar asientos gratis |
| M4 | Nunca se emite `Retry-After` en 409/429 aunque el contrato lo documenta |
| M5 | `token + marca` incoherente llega a pasarela y genera `Pago RECHAZADO` 402 en vez de 422 temprano |
| M6 | `restore` de inventario recorta en silencio con `LEAST()` en vez de alertar ante doble-restore |
| M7 | Ofertas expiradas nunca se purgan (holds e idempotencia sí tienen sweeper) |
| M8 | `assertChronology` compara días, no instantes (vuelta el mismo día antes que la ida pasa) |
| M9 | Dedup de pasajeros normaliza poco (`trim+upper`): `"AB 123"` vs `"AB123"` pasan como distintos |

### 2.4 Bajos (higiene, documentación, rendimiento menor)

| ID | Hallazgo |
|----|----------|
| B1 | Entrada muerta `501/NOT_IMPLEMENTED` en `DESCRIPTIONS` del filtro (ninguna ruta la declara) |
| B2 | `toMinorUnits(number)` opera sobre float porque el transformer entrega `number` desde `numeric` |
| B3 | Ventana `BOARDING` de 30 min hardcodeada en el servicio |
| B4 | `quantity @Max(5)` en DTO vs cap real 2 (`BAGGAGE_LIMIT_EXCEEDED`) |
| B5 | `CheckInResponseDto.status` incluye `NOT_ELIGIBLE`/`FAILED` que el servicio nunca emite |
| B6 | DTO de webhook exige `https` pero el servicio aceptaría `http` local con `allowPrivateHosts` |
| B7 | Eventos `flight.schedule_changed`/`flight.cancelled` sin productor en el núcleo |
| B8 | Claves de jobs en idiomas distintos (`barredor-holds` vs `webhooks`) |

---

## 3. Evidencia concreta (archivo y elemento afectado)

### Correcciones verificadas (sin acción)

- **C-CERR-1:** `src/modules/vuelos/vuelos.controller.ts:81-423` — search, seatmap, hold ×3, bookings/tickets ×5, postventa ×6, check-in ×2, flight-status ×1, webhooks ×3, todo con delegación real. `testing/vuelos.integration.spec.ts:136` ("serves what used to be stubs for real").
- **C-CERR-2:** `services/inventory.service.ts:23-28` (UPDATE condicional, único escritor); `services/offers.service.ts:191` (reserva en tx de idempotencia); `services/bookings.service.ts:130,161` (lock + consume `WHERE status='HELD'`); `entities/seat-assignment.entity.ts:6` (UNIQUE `vueloId,seatNumber`); `common/db-errors.ts:28-33` (→ `SEAT_TAKEN`); `services/date-change.service.ts:152-154` (reserva-nuevo-antes-de-devolver-viejo); `services/cancellation.service.ts:102-114` (cancela+devuelve en una tx).
- **C-CERR-3:** `services/idempotency.service.ts:61-62,83-109,142-175` + purga en `services/holds-sweeper.service.ts:40`; usos en `baggage.service.ts:58-59`, `date-change.service.ts:101-102`, `cancellation.service.ts:68-69`, `bookings.service.ts:63-64`; check-in idempotente natural (`check-in.service.ts:61-64` + advisory lock).
- **C-CERR-4:** `entities/passenger.entity.ts:31-56`, `entities/webhook-subscription.entity.ts:23-24` vía `encryptedJson` (`common/cifrado.ts:21-27`); llave de `DATA_ENCRYPTION_KEY`, exigida en prod (`common/vuelos-config.ts:127-137`); test `testing/vuelos.integration.spec.ts:516-528`.
- **C-CERR-5:** `ecommerce/ordenes/compras.service.ts:206-242` + `ecommerce/pagos/pagos.service.ts:191-207` (`anular()` no-throw); tests `testing/ecommerce.integration.spec.ts:682-708,735-754`.

### Altos

- **A1:** `src/modules/vuelos/services/cancellation.service.ts:140-154` — `amountsFor()` toma `fareTotalMinor` del `grandTotal` almacenado pero reprorratea `taxesMinor` con `vuelo.precioBase` actual; si un admin cambia el precio, el reembolso de tarifa no reembolsable (solo impuestos) deriva.
- **A2:** `src/modules/vuelos/services/offers.service.ts:65-67` + `services/search.service.ts:171` — `getSeatmap` marca ocupado solo desde `SeatAssignment`; `availableSeats` sí refleja `asientosDisponibles` (con holds).
- **A3:** `src/modules/vuelos/ecommerce/pagos/ports/simulated-adapters.ts:32-34,38-41,51-53` — `byReference`/`states: Map`; crash entre `autorizar` gateway y `save AUTORIZADO` (`ecommerce/pagos/pagos.service.ts:123-154`) deja 2ª `authRef` en reintento (mitigado parcialmente por `autorizadoDeOferta`, `:158-160`).
- **A4:** `src/modules/vuelos/ecommerce/ordenes/compras.service.ts:223-224` — `await mercados.obtener()` dentro de `compensar()`, después de `anular+registrarFallida`; si el mercado se borró/desactivó, lanza sin `SagaOutcome`.
- **A5:** `src/modules/vuelos/ecommerce/common/rate-limiter.ts:10-11` (in-memory) + `src/main.ts:12-14` (`TRUST_PROXY`); cobertura actual: login 20/15 m, guest 120/h, verify 10/15 m (`ecommerce/identidad/identidad.service.ts:29-31,96-97,136`), ofertas 30/m (`ecommerce/ofertas/ofertas.service.ts:67`), compra 10/m (`ecommerce/ordenes/compras.service.ts:50,71`), recovery 10/m + verifyQR 30/m (`ecommerce/ordenes/ordenes.service.ts:32-35`).
- **A6:** `src/modules/vuelos/common/domain-event-bus.ts:57-65` + `ecommerce/ordenes/compras.service.ts:171-174`, `ecommerce/notificaciones/notificaciones.service.ts:139-142` — `OrdenEmitida` tras commit sin outbox; mitigado por reconciliador (`ecommerce/ordenes/reconciliacion.service.ts:50,64-89`) + `UQ_eventoId` idempotente. `common/runtime-metrics.ts:1-9` (proceso-local, no fuente de verdad).

### Medios

- **M1:** `src/modules/vuelos/services/date-change.service.ts:25,50-98` — `MAX_OPTIONS_PER_CHANGE`, una fila `DateChangeOffer` por candidato y búsqueda, sin dedup/limpieza.
- **M2:** `src/modules/vuelos/services/cancellation.service.ts:38-65` — `quote()` inserta `CancellationQuote` por cada GET.
- **M3:** `src/modules/vuelos/services/bookings.service.ts:247-272` (asientos sin chequear familia) + `seed/flights.seed.ts:6-17` (`BASIC.seatSelectionIncluded:false`).
- **M4:** `contracts/vuelos-openapi.yaml:700-729` documenta `Retry-After`; `src/modules/vuelos/common/problem-details.filter.ts:68-89` nunca lo envía.
- **M5:** `src/modules/vuelos/ecommerce/ordenes/dto/ordenes.dto.ts:18` + `ecommerce/pagos/pagos.service.ts:97-102` — `marca` libre validada tarde → 402 `brand_mismatch`.
- **M6:** `src/modules/vuelos/services/inventory.service.ts:42-53` — `restore` con `LEAST()`.
- **M7:** `src/modules/vuelos/entities/flight-offer.entity.ts:8-34` + `services/search.service.ts:84-93` — ofertas vencidas sin purga.
- **M8:** `src/modules/vuelos/common/business-rules.ts:33-57` — cronología por día `YYYY-MM-DD`.
- **M9:** `src/modules/vuelos/common/business-rules.ts:151-172` — dedup por documento con `trim().toUpperCase()`.

### Bajos

- **B1:** `src/modules/vuelos/common/api-problem-responses.ts:14` + `common/problem-details.filter.ts:21`.
- **B2:** `src/modules/vuelos/common/money.util.ts:8-10` + `entities/vuelo.entity.ts:38-43` (transformer entrega `number`).
- **B3:** `src/modules/vuelos/services/flight-status.service.ts:8,40-51` (resto correcto: día UTC `utcDayRange :18-25`, DTO `flight-status.dto.ts:7-15`, test `:564-581`).
- **B4:** `src/modules/vuelos/dto/booking.dto.ts:49-53` + `dto/postventa.dto.ts:20-24` (`@Max(5)`) vs `services/bookings.service.ts:302-304`, `services/baggage.service.ts:97-104` (cap 2, 409 tipado).
- **B5:** `src/modules/vuelos/dto/postventa.dto.ts:143-147` vs `services/check-in.service.ts:146-157` (solo `COMPLETED`/`IN_PROGRESS`/`AVAILABLE`).
- **B6:** `src/modules/vuelos/dto/webhooks.dto.ts:7` (`@IsUrl protocols:['https']`) vs `common/safe-http.ts:67` (aceptaría `http` local).
- **B7:** `src/modules/vuelos/dto/enums.ts:15-16` + `services/webhooks.service.ts:43-45` (suscribe `flight.*` sin productor en el núcleo; productores admin en ecommerce).
- **B8:** `src/modules/vuelos/services/holds-sweeper.service.ts:41` (`barredor-holds`) vs `services/webhook-dispatcher.service.ts:62` (`webhooks`).

---

## 4. Recomendación de corrección para cada hallazgo

| ID | Recomendación |
|----|---------------|
| A1 | Persistir el desglose base/impuestos por pasajero en hold/booking y usarlo en `amountsFor()` en vez del `precioBase` vivo. |
| A2 | Restar holds vivos al pintar el mapa o advertir en el `@ApiOperation` que el seatmap es de cabina, no de inventario (el 409 tardío se mantiene como red). |
| A3 | Documentar el límite RDA1 del simulador; en PSP real usar `referencia = claveIdempotencia` server-side (`pagos.ports.ts:15-16`) con dedup durable. |
| A4 | `obtener(...).catch(() => null)` con fallback `idioma:'es'` en `compensar()`, o mover la lectura del mercado fuera del camino crítico. |
| A5 | Fijar `TRUST_PROXY=1` en Render; para multi-instancia migrar el limiter a Redis. |
| A6 | En RDA2 añadir outbox/broker; hoy no usar `/runtime` como verdad y mantener reconciliador + `UQ_eventoId`. |
| M1 | Purga por TTL de `DateChangeOffer` en el sweeper o dedup por `(bookingId,itineraryId,toVueloId,ventana)`. |
| M2 | Reutilizar la última `OPEN` vigente en `quote()` o purgar expiradas. |
| M3 | Bloquear `assignedSeats` si la familia del hold no incluye selección, o documentar la excepción. |
| M4 | Añadir `Retry-After` en 409 por contención y en 429. |
| M5 | Validar coherencia token-marca antes de crear el `Pago`, o aceptar el 402 como costo de auditoría. |
| M6 | Registrar `warning` cuando el restore recorta, o fallar si `disponibles + seats > capacidadTotal`. |
| M7 | Añadir purga de ofertas vencidas al `HoldsSweeper`. |
| M8 | Comparar instantes (no solo día) cuando haya hora. |
| M9 | Normalizar espacios/guiones del documento antes de comparar duplicados. |
| B1 | Eliminar la entrada 501 de `DESCRIPTIONS` o documentarla como reservada. |
| B2 | Leer `precioBase` como string o redondear una sola vez en el borde. |
| B3 | Mover `BOARDING_WINDOW_MS` a `VuelosConfig` o documentarlo como decisión. |
| B4 | Bajar `@Max(5)` a `@Max(2)` o derivarlo de la config (`POSTSALE_*`). |
| B5 | Alinear el enum del DTO con los tres estados reales del servicio. |
| B6 | Relajar el DTO a `['https','http']` dejando que `resolveSafeTarget` decida, o documentar que local usa https. |
| B7 | Documentar `flight.*` como reservados a admin o mover la suscripción junto al productor. |
| B8 | Unificar claves a `holds-sweeper` / `webhook-dispatcher`. |

---

## 5. Pruebas que deberían repetirse después de corregir

### 5.1 Contrato y happy path (GDS + e-commerce)

1. **Schemas OpenAPI** (`schemathesis`/`dredd`) contra Swagger vivo para todas las rutas: `SearchResponse`, `HoldResponse`, `BookingDetail`, `Ticket`, `FlightStatus`, `Oferta`, `Orden`, `Pago`, `WebhookSubscription` byte a byte; ningún `501` en el contrato.
2. **Happy path GDS:** `POST /search` (1 y 6 itinerarios) → `POST /offers/hold` (201) → `GET hold` → `POST /bookings` (201, `grandTotal == lockedPrice`) → `GET tickets` → `GET /flights/:n/status` (día UTC, `date` obligatoria).
3. **Postventa real:** `GET baggage-options` → `POST baggage` (40 USD, máx 2, corte 3 h, referencia single-use) → `POST date-change/search` → `POST date-change` (fee 30 USD) → `GET cancellation-quote` → `POST cancel` (penalidad 10 %) → reembolso `REEMBOLSADO` / `REEMBOLSO_PENDIENTE` y orden `DEVOLUCION_EN_CURSO → REEMBOLSADA`.
4. **Check-in/boarding + QR:** dentro de ventana 48 h/1 h → `COMPLETED` + boarding determinista; QR `v1.` verificable en `GET /tickets/verificar` (público, sin PII); fuera de ventana → 409/422 tipado.
5. **Webhooks:** suscripción sin exponer `secret`; evento firmado `sha256=HMAC(secret,timestamp.cuerpo)`; receptor caído → reintentos 1 m/5 m/30 m/2 h/6 h → `DEAD`; SSRF bloqueado (https + IP pública, `ALLOW_PRIVATE` rechazado en prod).
6. **Errores tipados:** 400/404/409/410/422/429 con `application/problem+json`, `code` del YAML y `X-Correlation-Id`; `cursor`/`limit` (1–50), `IsDateOnly` rechaza `2026-02-31`.

### 5.2 Dinero, inventario y concurrencia

7. **Pricing:** 2 adultos + 1 niño + 1 infante → Σ por tipo con factores; A1: cambiar `precioBase` tras el hold no altera el reembolso cotizado.
8. **Doble booking mismo hold / mismo asiento** → un 201 + un 409 `SEAT_TAKEN`; `asientosDisponibles` nunca negativo; A2: dos holds paralelos eligen el mismo asiento → el perdedor recibe 409 solo en booking (documentar o corregir mapa).
9. **Saga e-commerce:** lock oferta → revalidación → `verificarAsientos` antes de autorizar → tx única → captura; `PRICE_CHANGED`/`OFFER_INCOMPLETE` no se almacenan; outcomes (201/402/compensado) se replayean; `anular` que tarda → `ANULACION_PENDIENTE` + `FALLIDA_COMPENSADA` registrada; A4: mercado borrado en compensación → sin 2ª fallida.
10. **Reconciliación:** `CAPTURA_PENDIENTE` → capturada por job 60 s; `ANULACION_PENDIENTE` → void; `REEMBOLSO_PENDIENTE` → reembolsada; `EMITIDA` sin confirmación → re-anunciada (sin duplicar por `UQ_eventoId`).
11. **TTL/estados:** hold TTL corto → `HELD → EXPIRED` (sweeper 30 s + `SKIP LOCKED`), `GET` 410, booking 410; `RELEASED` re-borrado = no-op; `CONSUMED` → 409.

### 5.3 Seguridad, PII y operativa

12. **Auth/propiedad/roles:** sin token → 401; `alg:none`/firma ajena/caducado → 401; recurso ajeno → 403 (no 404 que filtre); `guest` vs `customer` según decisión documentada; admin (`mercados`, `notificaciones`, `observabilidad`, `asientos`) → 401 anónimo / 403 guest y customer.
13. **PII:** SQL sin PII en claro para pasajeros/contacto/facturación/cuerpo de notificación; QR y payload webhook sin PII; admin de asientos sin nombres (solo pnr/orden).
14. **Rate-limit:** ráfagas sobre login/guest/verify/ofertas/compra/recovery/verifyQR → 429 con `Retry-After` (M4); `TRUST_PROXY=1` verificado tras proxy.
15. **Migraciones/seed/observabilidad:** `migration:generate` tras cambiar entidad + `migration:check:vuelos` exit 0; `migration:run` desde cero; seed idempotente sin sobrescribir edición admin; no regenerar `DATA_ENCRYPTION_KEY` con datos existentes; `/admin/observabilidad/resumen` desde BD (durable) vs `/runtime` solo proceso-local.

> **Criterio de cierre:** §5.1–5.2 en CI por PR (`npm test` con `TEST_DATABASE_URL` para `testing/*.integration.spec.ts` + validador OpenAPI); §5.3 antes de declarar RDA2. Guardar logs JUnit + reporte del validador junto a este informe.
