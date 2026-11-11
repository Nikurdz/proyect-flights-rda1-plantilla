# Auditoría no destructiva — Módulo `src/modules/vuelos` (2ª emisión)

> **Proyecto:** Proyect-Flights-RDA1 · **Fecha de auditoría:** 2026-10-04
> **Alcance:** carpeta `src/modules/vuelos/` completa, incluyendo `ecommerce/` (identidad, mercados, catálogo, ofertas, pagos, órdenes, notificaciones), núcleo GDS (`services/`, `auth/`, `common/`, `dto/`, `entities/`, `seed/`, `migrations/`, `testing/`), `vuelos.controller.ts`, `vuelos.module.ts`, `vuelos-core.module.ts`, `README.md`, `docs/` y contrato `contracts/vuelos-openapi.yaml` v1.5.0.0 como referencia.
> **Método:** solo lectura. No se modificó ningún archivo existente. Este informe es el único archivo creado en esta pasada, con `(1)` al final del nombre para diferenciarlo de `AUDITORIA-VUELOS-10-4-2026.md`.
> **Base técnica verificada:** `InventoryService` como único escritor de `asientosDisponibles`, `IdempotencyService.execute/executeSaga`, saga `compras.service.ts`, `HoldsSweeper`, `FieldCipher`/`encryptedJson`, `JwtAuthGuard` + `RolesGuard`, `VuelosProblemDetailsFilter` por controlador, `ValidationPipe` estricto, tests en `testing/*.integration.spec.ts`.

---

## 1. Resumen ejecutivo

El módulo está dividido en dos capas que comparten inventario e idempotencia: **núcleo GDS** (search → seatmap → hold → booking → ticket → flight-status) y **e-commerce R1** (identidad, mercados, catálogo, ofertas, pagos simulados, órdenes/saga de compra, notificaciones). Lo verificado como sólido debe preservarse: JWT HS256 fail-closed con `sub` obligatorio, `ownerId` siempre desde el token (IDOR cubierto por tests), reserva atómica (`pessimistic_write` + `UPDATE … WHERE status='HELD'` + `UNIQUE(vueloId,seatNumber)`), idempotencia `(key, ruta, owner)` con hash SHA-256 del cuerpo (422 ante cuerpo distinto, 409 ante reclamo en curso), dinero en minor units, `ProblemDetails` por controlador (no global) y stubs postventa/check-in/webhooks que devuelven **501 honesto** en vez de `{}`/`[]` con 200.

Los riesgos están en **datos personales, dinero y entregabilidad**: los pasajeros del núcleo GDS (`vuelos_passengers`) y la cuenta `Cliente` persisten PII en claro mientras el cifrado (`encryptedJson`) solo cubre `ecom_*`; la saga registra `FALLIDA_COMPENSADA` solo si `anular()` no lanza (un timeout la deja en `EN_PAGO`); la captura puede quedar en `CAPTURA_PENDIENTE` sin reconciliación automática; el evento `OrdenEmitida` se publica tras commit sin outbox (caída intermedia = orden `EMITIDA` sin email y el resume no republica); el dedup de la pasarela simulada vive en un `Map` en memoria (se pierde al reiniciar / multi-instancia); y el rate-limit es en memoria y no cubre `POST /auth/invitado`, `verificar-correo`, `POST /ofertas` ni `POST /ofertas/:id/compra`. En contrato/precio quedan brechas medias: `cabinClass` acepta `BUSINESS/FIRST` pero tarifica economy, `extraBaggage` se valida y luego se descarta, el seatmap ignora holds e inventario, y `GET /bookings/:id` / `GET …/tickets` devuelven un subconjunto del schema del YAML.

**Distribución:** 6 críticos · 10 altos · 10 medios · 5 bajos. Cerrar críticos + altos antes de RDA2; los medios de contrato/precio antes de exponer e-commerce a tráfico real.

---

## 2. Hallazgos

### 2.1 Críticos (fuga de PII, doble cargo, venta sin entrega, bypass de pago)

| ID | Hallazgo |
|----|----------|
| C1 | PII de pasajeros del núcleo GDS en texto plano (el cifrado solo cubre `ecom_*`) |
| C2 | La compensación de la saga no se registra si `pagos.anular()` lanza (oferta queda `EN_PAGO` hasta 120 s) |
| C3 | Dedup de autorización de pasarela solo en memoria (`Map`): se pierde al reiniciar / multi-instancia |
| C4 | Venta responde `201 EMITIDA` con captura en `CAPTURA_PENDIENTE` y sin sweeper de reconciliación |
| C5 | `OrdenEmitida` sin outbox: caída tras commit deja orden `EMITIDA` sin email y el resume no republica |
| C6 | Scopes del contrato solo documentados: cualquier JWT válido (incl. `guest`) puede hacer hold/book en GDS |

### 2.2 Altos (contrato, precio cobrado, PII secundaria, verificación de pago)

| ID | Hallazgo |
|----|----------|
| A1 | `cabinClass: BUSINESS/FIRST` aceptada pero tarificada a precio economy |
| A2 | `passengers[].extraBaggage` se valida y luego se descarta: ni se persiste ni se cobra |
| A3 | Seatmap ignora holds `HELD` e `asientosDisponibles` (incoherente con el pricing, que sí usa inventario) |
| A4 | `GET /bookings/:id` y `GET …/tickets` devuelven un subconjunto del contrato (`TicketListResponse`, `itineraries`, `passengers`, `segments` ausentes) |
| A5 | PII de `Cliente` en claro + `MensajeriaSimulada` loguea destinatario/asunto/cuerpo con PII en desarrollo |
| A6 | `totalAceptado` se compara como string formateado (`1234.5` vs `1234.50` → 409 espurio) y admite decimales para COP/CLP |
| A7 | GDS confía en `paymentReference` con solo formato (sin verificación): cualquier string único confirma reserva |
| A8 | `createBookingWithin` no revalida `fechaSalida`: un hold previo al despegue puede confirmarse después de despegar |
| A9 | Rutas stub 501 exigen `Idempotency-Key` UUID: sin header devuelven 400 antes que el 501 honesto |
| A10 | Rate-limit en memoria y parcial: sin límite en `invitado`, `verificar-correo`, `POST /ofertas` y `POST /compra`; depende de `TRUST_PROXY=1` |

### 2.3 Medios (reglas, resiliencia, contrato menor, operativa)

| ID | Hallazgo |
|----|----------|
| M1 | `BASIC` (`seatSelectionIncluded:false`) puede reservar asientos gratis |
| M2 | Nunca se emite `Retry-After` en 409/429 aunque el contrato lo documenta |
| M3 | Factores por tipo de pasajero y bandas de edad son placeholders; redondeo por pasajero (±1¢) |
| M4 | Un solo reintento tras `expireDueHolds()` ante `SEAT_TAKEN`; bajo contención alta devuelve 409 habiendo liberables |
| M5 | Regla de velocidad antifraude cuenta solo por `ofertaId`; `REVISAR` se declina por no haber revisión manual en R1 |
| M6 | `token + marca` incoherente llega a pasarela y genera `Pago RECHAZADO` (402) en vez de 422 temprano |
| M7 | `restore` de inventario recorta en silencio con `LEAST()` en vez de alertar ante doble-restore |
| M8 | Ofertas expiradas nunca se purgan (solo holds e idempotencia tienen sweeper) |
| M9 | `assertChronology` compara días (`YYYY-MM-DD`), no instantes: permite vuelta el mismo día antes que la ida |
| M10 | Dedup de pasajeros normaliza poco (`trim+upper`): `"AB 123"` vs `"AB123"` pasan como distintos |

### 2.4 Bajos (higiene, rendimiento menor, documentación)

| ID | Hallazgo |
|----|----------|
| B1 | `buildCombinations` materializa el cartesiano completo antes de truncar a `maxOfferCombinations` |
| B2 | Sin `audience`/`clockTolerance` en JWT; llave dev derivada de `JWT_SECRET` (rotarlo pierde datos cifrados) |
| B3 | `GET hold/:id` con efecto de escritura (expira perezosamente) sin advertirlo en Swagger |
| B4 | `Ticket.passengerId` expone el UUID interno, no el `clientPassengerId` que envió el cliente |
| B5 | Seed no actualiza precio/horario existente ni limpia salidas pasadas; migración única acopla GDS + `ecom_*` |

---

## 3. Evidencia concreta (archivo y elemento afectado)

### C1 — PII del núcleo en claro

- **Archivo:** `src/modules/vuelos/entities/passenger.entity.ts:1-51` — `firstName`, `lastName`, `documentType`, `documentNumber`, `nationality`, `birthDate`, `contactEmail`, `contactPhone` sin `encryptedJson`.
- **Contraste:** `src/modules/vuelos/common/cifrado.ts:13-53` (`FieldCipher` AES-256-GCM + `encryptedJson`) usado solo por `ecom_*` (pasajeros/contacto/facturación de órdenes, `notificaciones.cuerpo`).
- **Docs:** `src/modules/vuelos/README.md:52` habla de cifrado sin aclarar que excluye `vuelos_passengers`.

### C2 — Compensación no blindada

- **Archivo:** `src/modules/vuelos/ecommerce/ordenes/compras.service.ts:190-221` — `compensar()`; si `pagos.anular()` lanza (timeout de pasarela), propaga sin registrar `FALLIDA_COMPENSADA`.
- **Efecto:** oferta queda `EN_PAGO` hasta el TTL (120 s) y la orden no refleja el fallo compensado.

### C3 — Dedup en memoria

- **Archivo:** `src/modules/vuelos/ecommerce/pagos/ports/simulated-adapters.ts:32-54` — `byReference: Map`; al reiniciar o con 2 instancias, la misma `referencia` autoriza dos veces. Patrón peligroso si se copia al adaptador real.

### C4 — Captura pendiente sin reconciliación

- **Archivo:** `src/modules/vuelos/ecommerce/ordenes/compras.service.ts:148-165` (`cobrarYEmitir`) + `src/modules/vuelos/ecommerce/pagos/pagos.service.ts:123-140` — responde `201 EMITIDA` con `CAPTURA_PENDIENTE`; solo `asegurarCaptura` en reintento, sin job periódico.

### C5 — Evento sin outbox

- **Archivo:** `src/modules/vuelos/ecommerce/ordenes/compras.service.ts:163-183` + `src/modules/vuelos/common/domain-event-bus.ts:54-64` — `OrdenEmitida` se publica tras `commit+captura`; caída intermedia = `EMITIDA` sin email; la rama resume (`existente EMITIDA`) no republica.
- **Atenuante verificado:** consumidor idempotente por `eventoId` único (`notificaciones/notificaciones.service.ts:121-157`).

### C6 — Scopes solo documentados (GDS)

- **Archivo:** `src/modules/vuelos/vuelos.controller.ts:101-170` — `holdOffer`, `createBooking`, etc. documentan scopes en `description`; el guard aplicado es `JwtAuthGuard` genérico.
- **Archivo:** `src/modules/vuelos/auth/roles.guard.ts:1-25` (`Roles`/`RolesGuard`) sin uso en las rutas GDS; contrato los exige en `contracts/vuelos-openapi.yaml:659-678`. `README.md:16` lo admite como excepción RDA1.

### A1 — Cabina premium a precio economy

- **Archivo:** `src/modules/vuelos/services/offers.service.ts:152-175` (ignora `selection.cabinClass`) + `src/modules/vuelos/dto/hold.dto.ts:13-15` (acepta `ECONOMY…FIRST`).
- **Efecto:** `vuelo.precioBase` economy × `family.priceMultiplier` también para `BUSINESS/FIRST`.

### A2 — Equipaje extra descartado

- **Archivo:** `src/modules/vuelos/services/bookings.service.ts:209-273` (`validatePassengers` no mira `extraBaggage`) + `src/modules/vuelos/dto/booking.dto.ts:133-139`.
- **Efecto:** `BAGGAGE_LIMIT_EXCEEDED` inalcanzable; el cliente cree que compró maleta.

### A3 — Seatmap parcial

- **Archivo:** `src/modules/vuelos/services/offers.service.ts:64-76` (`taken` solo de `seatAssignments`).
- **Incoherencia:** `availableSeats` del pricing sí usa `asientosDisponibles`; el seatmap puede mostrar `isAvailable:true` con inventario a 0.

### A4 — Respuesta menor que el contrato

- **Archivo:** `src/modules/vuelos/services/bookings.service.ts:340-350` (`toBookingDetail` sin `itineraries`/`passengers`) + `src/modules/vuelos/vuelos.controller.ts:184-211` (tickets como array plano en vez de `TicketListResponse{bookingId,tickets}`, `vuelos-openapi.yaml:1571-1583`; `Ticket` sin `segments`/`failureReason`).

### A5 — PII secundaria

- **Archivo:** `src/modules/vuelos/ecommerce/identidad/entities/cliente.entity.ts:12-32` — `correo, nombres, apellidos, telefono` en claro.
- **Archivo:** `src/modules/vuelos/ecommerce/notificaciones/ports/mensajeria.port.ts:26-32` (`MensajeriaSimulada`) — en `NODE_ENV=development` loguea destinatario + asunto + cuerpo y link de verificación.

### A6 — Comparación monetaria frágil

- **Archivo:** `src/modules/vuelos/ecommerce/ordenes/dto/ordenes.dto.ts:222-224` (`AceptarPrecioDto.totalAceptado`) vs `formatAmount` en compras: `1234.5` vs `1234.50` → 409 espurio; `src/modules/vuelos/ecommerce/ofertas/dto/ofertas.dto.ts:222-224`, `mercados/dto/mercado.dto.ts:178-183` admiten decimales aun para COP/CLP (0 decimales).

### A7 — Referencia de pago sin verificar (GDS, por diseño RDA1)

- **Archivo:** `src/modules/vuelos/services/bookings.service.ts:120-122` (unicidad sin verificación) + `src/modules/vuelos/dto/booking.dto.ts:26-31` (solo formato). `PAYMENT_NOT_AUTHORIZED`/`AMOUNT_MISMATCH` nunca se emiten en GDS.

### A8 — Confirmación post-despegue

- **Archivo:** `src/modules/vuelos/services/bookings.service.ts:100-142` (`createBookingWithin` sin chequeo de salida) vs `src/modules/vuelos/services/offers.service.ts:169-171` (el hold sí lo chequea).

### A9 — Guard en stubs 501

- **Archivo:** `src/modules/vuelos/vuelos.controller.ts:227,250,273` (`addBaggage`, `confirmDateChange`, `cancelBooking` con `IdempotencyKeyGuard` pero `501 NOT_IMPLEMENTED`).

### A10 — Rate-limit parcial

- **Archivo:** `src/modules/vuelos/ecommerce/common/rate-limiter.ts:1-34`, `ecommerce/identidad/identidad.service.ts:29,104-108`, `ecommerce/ordenes/ordenes.service.ts:26,137-140` — solo login (20/15 min) y recovery (10/min), en memoria por instancia; nada en `invitado`, `verificar-correo`, `POST /ofertas`, `POST /compra`. `@Ip()` exige `TRUST_PROXY=1` tras proxy.

### Medios / bajos (evidencia puntual)

- **M1:** `services/bookings.service.ts:247-272` no chequea familia; `seed/flights.seed.ts:6-17` (`BASIC.seatSelectionIncluded:false`).
- **M2:** `contracts/vuelos-openapi.yaml:700-729` documenta `Retry-After`; `common/problem-details.filter.ts:68-89` nunca lo envía.
- **M3:** `common/pricing.util.ts:18-26` (`PASSENGER_FARE_FACTORS`), `common/business-rules.ts:92-100` (`AGE_BANDS` placeholder).
- **M4:** `ecommerce/ofertas/ofertas.service.ts:108-113` un solo reintento tras `expireDueHolds()`.
- **M5:** `ecommerce/pagos/pagos.service.ts:40-77` velocidad por `ofertaId`; `tok_review`→declive directo.
- **M6:** `ecommerce/ordenes/dto/ordenes.dto.ts:18` + `pagos.service.ts:97-102` (`marca` libre validada tarde → 402 `brand_mismatch`).
- **M7:** `services/inventory.service.ts:42-53` (`restore` con `LEAST()` silencioso).
- **M8:** `entities/flight-offer.entity.ts:8-34` + `services/search.service.ts:84-93` (ofertas vencidas sin purga; holds e idempotencia sí la tienen).
- **M9:** `common/business-rules.ts:33-57` (cronología por día); **M10:** `:151-172` (dedup doc con `trim+upper`).
- **B1:** `services/search.service.ts:195-200` (cartesiano antes del `slice`); **B2:** `auth/token.service.ts:40-46` + `vuelos-config.ts:68-81`; **B3:** `services/offers.service.ts:204-217`; **B4:** `dto/booking.dto.ts:205-218` + `bookings.service.ts:164-172`; **B5:** `seed/flights.seed.ts:85-118`, `migrations/1791167576852-InitVuelosSchema.ts:24-45`.

---

## 4. Recomendación de corrección para cada hallazgo

| ID | Recomendación |
|----|---------------|
| C1 | Aplicar `encryptedJson` a la PII de `vuelos_passengers` (o documentar la brecha con plan de migración/rotación); no aceptar `ownerId` del body; mantener `ownerId = sub` verificado. |
| C2 | Envolver `pagos.anular()` en `try/catch` con reintento y registrar `FALLIDA_COMPENSADA` aunque el `void` quede pendiente de reconciliación. |
| C3 | Exigir dedup durable en el adaptador real (clave en DB/gateway, no en `Map`); añadir test que reinicie el adaptador y reintente la misma referencia. |
| C4 | Añadir sweeper que reintente `capturar()` para `CAPTURA_PENDIENTE` hasta confirmar o marcar para revisión manual. |
| C5 | Outbox transaccional (o republicar en la rama resume si no existe `Notificacion` para el evento); mantener consumidor idempotente por `eventoId` y reintentos del canal. |
| C6 | Exigir scope/rol (`JwtAuthGuard` + `RolesGuard` o chequeo de `kind`) en `POST /offers/hold` y `POST /bookings`, o dejar constancia formal de la excepción RDA1. |
| A1 | Validar `cabinClass === 'ECONOMY'` en esta fase o cablear multiplicador por cabina; no aceptar premium a precio economy. |
| A2 | Persistir/cobrar `extraBaggage` o rechazar con 422 hasta implementarlo; no aceptar en silencio lo que no se entrega. |
| A3 | Unir disponibilidad real (asignados + cupo de holds `HELD`) o advertir en Swagger que el seatmap es de cabina, no de inventario. |
| A4 | Completar `BookingDetail` (`itineraries`, `passengers`) y el wrapper `TicketListResponse`, o versionar el contrato a lo realmente servido. |
| A5 | Cifrar `telefono`/`fechaNacimiento` de `Cliente` si RNF-18 lo exige (el `correo` indexado puede quedar en claro por login); enmascarar correo y truncar cuerpo también en desarrollo. |
| A6 | Comparar por `montoMinor` entero (o normalizar decimales) y restringir el patrón de `totalAceptado` según `decimalesMoneda` del mercado. |
| A7 | Ratificar por escrito que GDS confía en la referencia externa, o verificar contra Payment API antes de emitir. |
| A8 | Revalidar `fechaSalida > now` (o ventana de corte) dentro de `createBookingWithin`. |
| A9 | Quitar el guard (y el header de Swagger) de los stubs 501 hasta implementarlos. |
| A10 | Añadir limiter en `compra`/`verificar-correo`/`invitado`/`ofertas` y Redis compartido en multi-instancia; verificar `TRUST_PROXY=1` tras proxy. |
| M1 | Bloquear `assignedSeats` si la familia del hold no incluye selección, o documentar la excepción. |
| M2 | Añadir `Retry-After` en 409 por contención y en 429. |
| M3 | Marcar en Swagger que factores y bandas de edad son provisionales pendientes de negocio. |
| M4 | Aceptable hoy; si sube la contención, reintentar con backoff o exponer `Retry-After`. |
| M5 | Correcto para R1; en R2 enrutar `REVISAR` a `PAGO_EN_VERIFICACION` en vez de declinar. |
| M6 | Validar coherencia token-marca antes de crear el `Pago`, o aceptar el 402 como costo de auditoría. |
| M7 | Registrar `warning` cuando el restore recorta, o fallar si `disponibles + seats > capacidadTotal`. |
| M8 | Añadir purga de ofertas vencidas al `HoldsSweeper`. |
| M9 | Comparar instantes (no solo día) cuando haya hora; exigir `>=` con horas si existen. |
| M10 | Normalizar espacios/guiones del documento antes de comparar duplicados. |
| B1 | Podar por leg (top-N) o generar combinaciones con heap limitado. |
| B2 | Añadir `audience` y tolerancia de reloj al migrar a OIDC/JWKS; avisar que `JWT_SECRET` no se rota con datos existentes. |
| B3 | Documentar el efecto de escritura en el `@ApiOperation` del `GET hold/:id`. |
| B4 | Devolver `clientPassengerId` (o ambos) en el DTO del ticket. |
| B5 | Añadir limpieza de salidas pasadas y `upsert` por clave de negocio en seed; separar migraciones GDS/e-commerce. |

---

## 5. Pruebas que deberían repetirse después de corregir

### 5.1 Contrato y happy path

1. **Schemas OpenAPI** (`schemathesis`/`dredd`) contra Swagger vivo para las rutas GDS + e-commerce; `BookingDetail`, `TicketListResponse`, `FlightStatus`, `Oferta`, `Orden`, `Pago` byte a byte (A4).
2. **Happy path GDS:** `POST /search` (1 y 6 itinerarios) → `POST /offers/hold` (201) → `GET hold` → `POST /bookings` (201) → `GET tickets` → `GET /flights/:n/status`; `grandTotal == lockedPrice`; oferta/hold expirados → 404/410.
3. **Happy path e-commerce:** identidad (registro/login/invitado) → mercado/catálogo → `POST /ofertas` → `POST /ofertas/:id/compra` (`201 EMITIDA`) → historial/recuperación; mercado COP verifica `formatAmount` sin decimales.
4. **Errores tipados:** 400 (IATA, `origin==destination`, fingerprint/`segmentId`/`date` ausentes), 404 (recurso ajeno vs inexistente: 403 vs 404), 409 (`SEAT_TAKEN`, doble booking, key en curso), 410 (hold/oferta vencidos), 422 (infantes>adultos, edad≠tipo, key rehusada con otro body, `totalAceptado` con formato), 429 (login + nuevos limiters); `application/problem+json` con `code` correcto y `X-Correlation-Id`.

### 5.2 Dinero, inventario y concurrencia

5. **Pricing:** 2 adultos + 1 niño + 1 infante → Σ por tipo con factores; `lockedPrice` revalidado; `1234.5` vs `1234.50` aceptado igual (A6); sin fare families → error controlado.
6. **Doble booking mismo hold / mismo asiento** → un 201 + un 409; `asientosDisponibles` nunca negativo (`CHK`); holds paralelos con 1 asiento → un 201/`SEAT_TAKEN`; `releaseHold(CONSUMED)` → 409; expirados liberan inventario (sweeper 30 s + `SKIP LOCKED`).
7. **Saga:** `PRICE_CHANGED`/`OFFER_INCOMPLETE` no se almacenan bajo la key; outcomes (201/402/compensado) se replayean verbatim; `anular` que lanza → `FALLIDA_COMPENSADA` registrada (C2); `CAPTURA_PENDIENTE` → sweeper la confirma (C4); caída tras commit → outbox/republicación entrega el email (C5).
8. **Pasarela:** reinicio del adaptador + misma referencia → sin doble autorización (C3, dedup durable); `tok_review` → declive documentado R1; `marca` incoherente → 422 temprano o 402 aceptado.

### 5.3 Seguridad, PII y resiliencia

9. **Auth/propiedad:** sin token → 401; `alg:none`/firma ajena/caducado → 401; token sin scope en `hold/book` → 403 (C6); usuario A leyendo booking/orden de B → 403; `guest` sin roles rechazado en back-office (`mercados`, `notificaciones`); `historial` exige `kind=customer` e `id==ownerId`.
10. **PII:** `vuelos_passengers` y contacto/facturación cifrados en reposo (test de ciphertext, C1/A5); `Cliente.telefono` cifrado si se decide; log de desarrollo sin PII (A5); recuperación sin oráculo (mismo 404) y sin devolver `contacto` en vista pública.
11. **TTL/estados:** hold TTL corto → `HELD→EXPIRED`, `GET` 410, booking 410; `RELEASED` re-borrado = no-op sin doble devolución; `CONSUMED` → 409; `offer.cancelar` no deja hold muerto visible.
12. **Migraciones/seed:** `migration:run` desde cero sin `synchronize`, `revert` limpio, `migration:check:vuelos` exit 0 tras cambiar entidades; seed idempotente no destructivo (no sobrescribe edición admin); no regenerar `DATA_ENCRYPTION_KEY` con datos existentes.
13. **Carga/ruteo:** `POST /search` p95 `<3s`; `compra` con contención no vende de más; rutas `/api/v1/flights/*` + e-commerce sin colisión con otros dominios; `helmet`/CORS sin stack en 500; `Retry-After` presente en 409/429 (M2).

> **Criterio de cierre:** §5.1–5.2 en CI por PR (`npm test` + `TEST_DATABASE_URL` para `testing/*.integration.spec.ts` + validador OpenAPI); §5.3 antes de declarar RDA2. Guardar logs JUnit + reporte del validador junto a este informe.
