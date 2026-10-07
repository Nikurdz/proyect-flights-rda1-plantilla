# Guía de defensa del e-commerce de Vuelos desde Swagger

Guía para recorrer en vivo, sin tocar código ni datos a mano, todo lo que hace el e-commerce de vuelos.
Cada paso dice **qué pulsar**, **qué escribir** y **qué decir**. Imprímela o ábrela en otra pantalla.

- **Swagger:** `https://proyect-flights-rda1-plantilla-production.up.railway.app/api/docs` (en local: `http://localhost:3000/api/docs`).
- **Frontend:** la URL de Netlify (para mostrar la misma compra con interfaz).
- Las secciones del Swagger están **numeradas en el orden de esta guía** (1 a 6). La 7 (núcleo GDS) y las `⛔ No implementado` no se usan para comprar.

---

## 0. Antes de empezar (5 minutos)

1. Abre `/api/v1/health` y comprueba que responde `{"status":"UP","db":"UP"}`. Si el servidor estaba dormido, la primera llamada tarda ~40 s: hazla **antes** de la defensa.
2. Ten a mano:
   - El **correo y la contraseña del ADMIN** (`ADMIN_EMAIL` / `ADMIN_PASSWORD` de las variables de entorno).
   - Una **fecha de salida** entre mañana y dentro de 40 días (el seed publica vuelos 45 días hacia adelante). Abajo se escribe `<SALIDA>` y `<VUELTA>` (una semana después).
3. **Idempotency-Key:** dos pasos la piden (crear oferta y pagar). Es cualquier UUID v4. Genéralo en la consola del navegador con `crypto.randomUUID()`. Usa uno nuevo en cada operación nueva.
4. **Token:** cada llamada protegida necesita el `accessToken` en **Authorize** (arriba a la derecha). Swagger lo recuerda aunque recargues. Al cambiar de usuario (invitado → admin) pulsa **Authorize → Logout** y pega el nuevo.

> Datos de la ruta de ejemplo: **BOG → SCL**, vuelo `LA800` (42 asientos libres por día) y `LA1500` (solo 5, sirve para mostrar agotamiento). Vuelta: `LA801`.

---

## 1. Acceso — sección `1 · Acceso (empieza aquí)`

**Qué decir:** "Se puede comprar sin cuenta (invitado) o con cuenta. Ambos reciben un JWT firmado; el dueño de cada recurso es siempre el `sub` del token, nunca un dato que mande el cliente."

### Paso 1A · `POST /auth/invitado`
Sin cuerpo. Copia `accessToken` → **Authorize**. (`kind: guest`.)

### Paso 1B · `POST /clientes` (opcional: comprar con cuenta)
```json
{
  "correo": "defensa@example.com",
  "contrasena": "Defensa-2026-ok",
  "nombres": "María José",
  "apellidos": "Pérez Gómez",
  "fechaNacimiento": "1990-04-01",
  "telefono": "+593999999999",
  "aceptaTerminos": true
}
```
Respuesta `201`. Reglas a mencionar: contraseña de 10 o más caracteres con letra y número, términos obligatorios, **no** hace falta verificar el correo para comprar.

### Paso 1C · `POST /auth/login`
```json
{ "correo": "defensa@example.com", "contrasena": "Defensa-2026-ok" }
```
Copia el `accessToken`. **Demo de seguridad:** 5 contraseñas malas seguidas bloquean la cuenta temporalmente (`423`).

---

## 2. Buscar vuelos — sección `2 · Buscar vuelos`

**Qué decir:** "El buscador lee el inventario real del núcleo de vuelos; los precios se calculan con enteros (centavos), nunca con decimales flotantes. Un solo mercado, `ec`, en USD."

### Paso 2A · `GET /localidades`
`q=bog` → Bogotá `BOG`. (Sin acentos ni mayúsculas.)

### Paso 2B · `GET /disponibilidad`
| Campo | Valor |
|-------|-------|
| `origin` | `BOG` |
| `destination` | `SCL` |
| `outbound` | `<SALIDA>` (AAAA-MM-DD) |
| `inbound` | `<VUELTA>` (para ida y vuelta) |
| `adt` / `chd` / `inf` | `2` / `0` / `1` |
| `sort` | `MAS_BARATOS` |
| `mercado` | `ec` |

Copia de `trayectos[0].itinerarios[0].itinerarioId` el **id de la ida**, y de `trayectos[1]…` el **de la vuelta**.
**Qué mostrar:** el aviso "últimos asientos" en `LA1500`, las `fechasAlternativas` y que el precio ya incluye impuestos.

### Paso 2C · `GET /itinerarios/{id}/tarifas`
Pega el id de la ida, `adt=2&inf=1`. Muestra las 3 familias: **BASIC**, **LIGHT**, **FULL** con equipaje, cambios y devoluciones (salen de la familia, no del texto libre).

*(Opcional)* `GET /mercados/ec` → moneda USD, medios de pago y **versiones de los textos legales** (`2026-10`), que se usan en el paso 3D.

---

## 3. Oferta y checkout — sección `3 · Oferta y checkout`

**Qué decir:** "Armar la oferta **retiene** el inventario en el núcleo durante 15 minutos con un hold. Si no se paga, el barredor devuelve los asientos solo."

### Paso 3A · `POST /ofertas`  — header `Idempotency-Key: <uuid-1>`
```json
{
  "mercado": "ec",
  "selecciones": [
    { "itinerarioId": "<ID_IDA>",    "familia": "LIGHT" },
    { "itinerarioId": "<ID_VUELTA>", "familia": "LIGHT" }
  ],
  "pasajeros": { "adultos": 2, "ninos": 0, "infantes": 1 }
}
```
Guarda `ofertaId` y `trayectos[].itinerarioId` (el de cada tramo). **Qué mostrar:** `venceEn`, `segundosRestantes`, `total` y `faltantes` (lo que falta antes de pagar).
**Demo de idempotencia:** repite la misma llamada con la misma clave → devuelve la **misma** oferta, no crea otra.

### Paso 3B · `PUT /ofertas/{id}/pasajeros`
Un adulto, un segundo adulto y un bebé (el bebé viaja en brazos de `a1`). El **tipo debe coincidir con la edad el día del primer vuelo**.
```json
{
  "pasajeros": [
    { "id": "a1", "tipo": "ADULT", "nombres": "María José", "apellidos": "Pérez Gómez",
      "fechaNacimiento": "1990-04-01", "genero": "F", "nacionalidad": "EC",
      "documento": { "tipo": "PASSPORT", "numero": "AB1234567", "vencimiento": "2035-01-01" },
      "asientos": [ { "trayectoId": "<ID_IDA>", "asiento": "12A" } ] },
    { "id": "a2", "tipo": "ADULT", "nombres": "Luis", "apellidos": "Pérez Gómez",
      "fechaNacimiento": "1988-03-02", "genero": "M", "nacionalidad": "EC",
      "documento": { "tipo": "PASSPORT", "numero": "AB7654321", "vencimiento": "2035-01-01" },
      "asientos": [ { "trayectoId": "<ID_IDA>", "asiento": "12B" } ] },
    { "id": "i1", "tipo": "INFANT", "asociadoA": "a1", "nombres": "Sofía", "apellidos": "Pérez Gómez",
      "fechaNacimiento": "2026-01-15", "genero": "F", "nacionalidad": "EC",
      "documento": { "tipo": "PASSPORT", "numero": "AB1111111", "vencimiento": "2035-01-01" } }
  ],
  "contacto": { "correo": "defensa@example.com", "telefono": "+593999999999" }
}
```
- En un vuelo **internacional** (BOG→SCL) el `vencimiento` del documento es obligatorio y debe ser posterior al fin del viaje.
- Los nombres se normalizan (acentos, mayúsculas) y el servidor avisa en `advertencias`.
- **Qué decir:** "Los datos personales se guardan **cifrados** (AES-256-GCM); en la base solo se ve texto cifrado."

### Paso 3B+ · `GET /ofertas/{id}/asientos?trayectoId=<ID_IDA>` (antes del 3B si quieres elegir viendo el mapa)
Cabina de 6 columnas con asientos libres y ocupados. El asiento es **opcional**, gratis en este prototipo y un bebé en brazos no ocupa asiento (`INFANT_SEAT_NOT_ALLOWED`).

### Paso 3C · `PUT /ofertas/{id}/facturacion`
```json
{ "tipoIdentificacion": "CEDULA", "numeroIdentificacion": "1712345678",
  "razonSocial": "María José Pérez", "direccion": "Av. Amazonas N24-03", "pais": "EC" }
```

### Paso 3D · `POST /ofertas/{id}/condiciones`
```json
{ "versionTerminos": "2026-10", "versionCondicionesTransporte": "2026-10" }
```
Si mandas otra versión → error de versión: solo se acepta la vigente. Ahora `GET /ofertas/{id}` debe mostrar `faltantes: []`.

*(Opcional)* **3E** `GET /ofertas/{id}/medios-pago`: marcas aceptadas (VISA, MASTERCARD, AMEX, DINERS) y cuotas.

---

## 4. Pagar y emitir — sección `4 · Pagar y emitir`

**Qué decir:** "Es una **saga**: revalida el precio, autoriza el pago, y en **una sola transacción** crea la orden, la reserva, los billetes y consume el hold; después captura el cobro. Si la emisión falla, se anula la autorización y se registra una orden `FALLIDA_COMPENSADA`. Un reintento nunca cobra dos veces."

### Paso 4 · `POST /ofertas/{id}/compra` — header `Idempotency-Key: <uuid-2>`
```json
{ "medio": { "tipo": "TARJETA", "token": "tok_visa_ok", "marca": "VISA" }, "cuotas": 1 }
```
`201` con `numeroOrden` (`ORD-…`), `pnr` (6 caracteres), un billete de 13 dígitos por pasajero, asientos y un **`qr`** por pasajero. Guarda `numeroOrden`, `pnr` y un `qr`.
Nunca se manda el número de tarjeta: solo un **token** de la pasarela simulada.

---

## 5. Mis viajes y billetes — sección `5 · Mis viajes y billetes (QR)`

- **5A · `GET /ordenes/{numero}`** (con el mismo token): la orden con su historial `PENDIENTE_PAGO → PAGADA → EMITIDA`.
- **5B · `GET /ordenes?pnr=<PNR>&apellido=Pérez`** (**sin** token): recuperar un viaje con código y apellido. Limitado por IP. Muestra que **no** devuelve el contacto.
- **5C · `GET /tickets/verificar?codigo=<qr>`** (sin token): pega el `qr` de un pasajero → `valido: true`, vuelo y estado, **sin nombres**. Cambia un carácter del final → `valido: false`.
  **Qué decir:** "El QR lleva `v1.<billete>.<PNR>.<firma HMAC>`. Sin la clave del servidor no se puede fabricar uno válido."
- `GET /clientes/me/ordenes`: historial (con cuenta). `POST /clientes/me/ordenes`: agregar a la cuenta un viaje comprado como invitado (`pnr` + `apellido`).

**Con la interfaz:** abre la confirmación en Netlify: cada pasajero tiene su QR; al escanearlo se abre `/verificar/<código>`.

---

## 6. Gestionar la reserva — sección `6 · Gestionar la reserva`

Con el token del comprador. El `bookingId` sale de `GET /ordenes/{numero}` (campo `bookingId`, o el enlace `_links.reserva`). Reglas por defecto (configurables, ver el plan `docs/planes/2026-10-07-posventa-checkin-webhooks.md`): hasta **3 h antes** de la salida; el pago extra usa una `paymentReference` opaca y **de un solo uso**.

| Paso | Ruta | Qué mostrar |
|------|------|-------------|
| 6A | `GET /bookings/{id}/baggage-options` | Por pasajero y tramo: 40 USD por maleta, máximo 2 extra, las ya compradas. El bebé en brazos no compra. |
| 6B | `POST /bookings/{id}/baggage` — `Idempotency-Key` | `{ passengerId, itineraryId, quantity, payment: { paymentReference } }` → `totalBaggage`. Repetir la clave devuelve lo mismo; una tercera maleta da `409 BAGGAGE_LIMIT_EXCEEDED`; reutilizar la referencia, `409 PAYMENT_REFERENCE_INVALID`. |
| 6C | `POST /bookings/{id}/date-change/search` | `{ changes: [{ itineraryId, newDepartureDate }] }`. Solo tarifa **FULL** (cambiable); las demás dan `409`. Devuelve vuelos directos con cupo, la diferencia de tarifa e impuestos y el cargo de 30 USD. Cada opción vive 15 min. |
| 6D | `POST /bookings/{id}/date-change` — `Idempotency-Key` | `{ changeOfferId, payment: { paymentReference } }` (el pago es obligatorio si hay algo que pagar; una diferencia negativa no se devuelve). En **una transacción** toma el cupo del vuelo nuevo y devuelve el del viejo; la reserva muestra el cambio en `changes`. |
| 6E | `GET /bookings/{id}/cancellation-quote` | FULL: total − 10 %. BASIC/LIGHT: solo los impuestos (`isRefundable: false`). El equipaje extra se devuelve completo. Vive 15 min. |
| 6F | `POST /bookings/{id}/cancel` — `Idempotency-Key` | `{ quoteId, reason }`. La reserva pasa a `CANCELLED`, los billetes a `REFUNDED`/`VOIDED`, los cupos vuelven al inventario, **la pasarela devuelve el dinero** y la orden pasa a `DEVOLUCION_EN_CURSO` → `REEMBOLSADA` (compruébalo con `GET /ordenes/{numero}`). |

**Qué decir:** "Cada operación es una transacción con su Idempotency-Key; el reembolso lo hace el módulo de pagos al recibir el evento `booking.cancelled`, y si la pasarela falla queda `REEMBOLSO_PENDIENTE` para el reconciliador."

---

## 7. Check-in y pases de abordar — sección `7 · Check-in y pases de abordar`

- **7A · `POST /bookings/{id}/check-in`**: abre **48 h** antes y cierra **1 h** antes de la salida de cada tramo (fuera de ese rango, `409 CHECK_IN_NOT_AVAILABLE`). Usa el asiento elegido o asigna el primero libre; el bebé en brazos no lleva asiento; grupo de embarque por tarifa (FULL=A, LIGHT=B, BASIC=C). Repetirlo no cambia nada.
- **7B · `GET /bookings/{id}/boarding-passes`**: antes del check-in, `404 BOARDING_PASS_NOT_AVAILABLE`. Después, un pase por pasajero y tramo con `barcode` `bp1.<billete>.<PNR>.<vuelo>.<asiento>.<firma>` (QR firmado, sin datos personales).

**Para la demo:** los vuelos del seed salen en días, así que el check-in aún no está abierto. Muestra el `409` de "ventana cerrada" y, si necesitas el caso feliz, usa una reserva cuyo vuelo salga en menos de 48 h.

---

## 8. Webhooks — sección `8 · Webhooks`

- **8B · `POST /webhooks`**: `{ url, events, secret }` (secreto de 16 a 200 caracteres). Solo **https** y solo hosts **públicos**: `localhost`, `10.x`, `192.168.x`, `169.254.x`… dan `400` (defensa SSRF; la dirección se valida también al entregar). Máximo 10 por cuenta.
- **8A · `GET /webhooks`** lista las tuyas, **sin el secreto** (solo se escribe). **8C · `DELETE /webhooks/{id}`** la desactiva (404 si es de otro).
- **Entrega:** `POST` con `X-Webhook-Id`, `X-Webhook-Event`, `X-Webhook-Timestamp` y `X-Webhook-Signature: sha256=HMAC(secret, timestamp + "." + cuerpo)`. Si el receptor no responde 2xx se reintenta a 1 min, 5 min, 30 min, 2 h y 6 h, y luego queda `DEAD` (se ve en **Observabilidad → webhooks**).
- **Eventos:** `booking.confirmed`, `booking.ticket_issuing`, `booking.ticket_issued`, `booking.failed`, `booking.ticket_failed`, `booking.changed`, `booking.cancelled`, `hold.expired` y, por acciones del administrador, `flight.cancelled` y `flight.schedule_changed`. Los cuerpos no llevan datos personales.

---

## 9. Administración — sección `9 · Administración (solo ADMIN)`

Haz **Logout** en Authorize, inicia sesión (`POST /auth/login`) con el ADMIN y pega su token.
**Demo de permisos:** con el token de invitado o de cliente, estas rutas responden `403`; sin token, `401`.

| Ruta | Qué mostrar |
|------|-------------|
| `GET /admin/ordenes` | Todas las órdenes (filtros `estado`, `pnr`, fechas). |
| `GET /admin/ordenes/{numero}` | Detalle con contacto, **QR y asientos de cada pasajero**. |
| `GET /admin/vuelos` | Inventario y cuántos asientos numerados están reservados. |
| `GET /admin/vuelos/{vueloId}/asientos` | Mapa de la cabina y lista de reservados con su PNR (sin nombres). |
| `GET /admin/observabilidad/resumen?ventana=24h` | Órdenes por estado, ingresos, tasas de rechazo/antifraude/compensación, **pendientes de reconciliación**, notificaciones, holds, ocupación. |
| `GET /admin/observabilidad/runtime` | Tráfico por ruta, errores, eventos y último ciclo del reconciliador. Es en memoria: parte de cero al reiniciar. |
| `GET /admin/notificaciones` | El correo de confirmación enviado (simulado). |
| `POST /admin/vuelos/{vueloId}/cancelar` | Cancela el vuelo: las reservas confirmadas se cancelan con **reembolso total sin penalidad** y se emiten `flight.cancelled` y `booking.cancelled`. |
| `POST /admin/vuelos/{vueloId}/reprogramar` | `{ nuevaSalida, motivo }`: conserva la duración, actualiza las reservas y emite `flight.schedule_changed` y `booking.changed`. |

**Con la interfaz:** entra con el admin en Netlify → *Administración* → Órdenes, Vuelos (clic en un vuelo para ver el mapa) y Observabilidad.

---

## 10. Casos de error para demostrar (cada uno con su resultado)

Repite desde el **paso 3A** con una oferta nueva salvo que se indique otra cosa.

| # | Qué haces | Resultado esperado | Qué decir |
|---|-----------|--------------------|-----------|
| 1 | Pago con `tok_declined` | `402 PAYMENT_DECLINED`. La oferta **sigue vigente**. | "Probar otra tarjeta no obliga a rehacer el checkout." |
| 2 | Luego pagar con `tok_visa_ok` y **otra** `Idempotency-Key` | `201`, orden emitida. | |
| 3 | `tok_insufficient` / `tok_expired` / `tok_3ds` | `402 PAYMENT_DECLINED` (fondos, vencida, 3DS no soportado). | Códigos de rechazo distintos de la pasarela simulada. |
| 4 | `tok_fraud` o `tok_review` | `402 PAYMENT_REJECTED_BY_FRAUD`. | "Reglas antifraude simuladas: bloqueo por token, revisión manual (no disponible en esta fase, así que se rechaza) y montos mayores a 5,000 USD." |
| 5 | **Tres** pagos rechazados sobre la misma oferta (por ejemplo tres `tok_declined`) y luego un cuarto con `tok_visa_ok` | El cuarto también se rechaza (`402 PAYMENT_REJECTED_BY_FRAUD`, motivo `too_many_failed_attempts`) aunque la tarjeta sea buena. Hay que armar una oferta nueva. | Límite de intentos por oferta contra prueba de tarjetas. |
| 6 | `tok_visa_ok` con `"marca": "MASTERCARD"` | `402` (marca no coincide). | |
| 7 | **Idempotencia:** repetir la compra (paso 4) con la **misma** clave y cuerpo | Devuelve la **misma** orden; un solo cobro. | "Exactly-once por clave, ruta y dueño." |
| 8 | Misma clave pero **otro cuerpo** | `422 Idempotency-Key reused with a different request`. | |
| 9 | Pagar una oferta **a medias** (sin facturación o sin aceptar condiciones) | `422 OFFER_INCOMPLETE` con la lista de lo que falta. | "El servidor valida el estado, no confía en la interfaz." |
| 10 | Esperar 15 min sin pagar y luego pagar | `410 OFFER_EXPIRED`; los asientos ya volvieron al inventario. | Retención con vencimiento. |
| 11 | **Asiento ocupado:** arma **dos** ofertas para las mismas fechas y elige el mismo asiento (ej. `15A`); compra la primera; compra la segunda | `409 SEAT_TAKEN` **antes de cobrar** (no queda pago). Elige otro asiento (3B) y vuelve a comprar → `201`. | "El asiento se bloquea al emitir; la restricción única de la base lo garantiza aunque dos compras lleguen a la vez." |
| 11b | **Vuelo lleno:** busca BOG→SCL a **+3 días** (`LA800` sale «Agotado», al final y sin distintivos) y crea la oferta con su `itinerarioId` (3A) | `409 SEAT_TAKEN`; no queda oferta, retención ni pago. | "El inventario es un `UPDATE` condicional: no se puede vender lo que no hay. El vuelo se muestra agotado en vez de esconderlo." |
| 11c | **Grupo que no cabe:** BOG→SCL a **+5 días** con 3 adultos (`LA1500` tiene 2 libres) | `LA1500` sale «Agotado» para 3 y reservable para 2. | Casi lleno: depende del tamaño del grupo. |
| 12 | Asiento inexistente (`999F`) | `422 SEAT_CABIN_MISMATCH`. | |
| 13 | Bebé con asiento | `422 INFANT_SEAT_NOT_ALLOWED`. | |
| 14 | Pasajero con tipo que no coincide con su edad (ADULT nacido en 2020) | `422 VALIDATION_FAILED`. | Regla de negocio RN-14. |
| 15 | Recuperar un viaje con apellido equivocado | `404 ORDER_NOT_FOUND` (igual que si no existe: no revela nada). | |
| 16 | **Tarjeta que emite pero no cobra:** `tok_visa_capture_fail` | `201` (billetes emitidos); el pago queda `CAPTURA_PENDIENTE`. | "El reconciliador lo reintenta cada minuto." Muéstralo en **Observabilidad → Pendientes: capturas pendientes = 1**. |
| 17 | Cancelar fuera de plazo (vuelo a menos de 3 h o ya salido) / check-in cerrado / tercera maleta extra | `409` con `CUTOFF_PASSED`, `FLIGHT_ALREADY_DEPARTED`, `CHECK_IN_NOT_AVAILABLE`… / `BAGGAGE_LIMIT_EXCEEDED` | "Las reglas de plazo y límites se validan en el servidor y están en configuración." |
| 17b | Registrar un webhook a `https://127.0.0.1/…` o `http://…` | `400 VALIDATION_FAILED` con el motivo | "Defensa SSRF: solo https y solo direcciones públicas." |
| 18 | Una ruta de admin con token de invitado o cliente | `403`; sin token `401`. | Control de acceso por rol. |

Todos los errores salen como `application/problem+json` con `code`, `title` y `invalidParams`, y llevan el encabezado `X-Correlation-Id` para rastrear la petición en los registros.

---

## 11. Preguntas probables y cómo responder

- **¿Por qué una saga y no una transacción?** El cobro es un sistema externo que no participa en la transacción de la base. Se autoriza antes, se emite todo en una transacción local y se compensa (anulación) si falla. El estado se puede reanudar: un reintento no cobra ni emite dos veces.
- **¿Qué pasa si el servidor cae entre emitir y capturar?** La orden queda emitida con el pago `CAPTURA_PENDIENTE` o `AUTORIZADO`; el reconciliador (cada 60 s) captura lo pendiente, anula lo que quedó por anular y reenvía la confirmación si no se envió.
- **¿Cómo evitan vender dos veces el mismo asiento o cupo?** El inventario solo lo modifica un servicio con `UPDATE` condicional; la reserva bloquea la fila del hold y la consume con `WHERE status='HELD'`; y el asiento tiene clave única `(vuelo, asiento)`.
- **¿Cómo protegen los datos personales?** Pasajeros, contacto y facturación van cifrados en la base (AES-256-GCM); no se pueden consultar por SQL, así que las búsquedas usan columnas indexadas (número de orden, PNR) y comparan el apellido en la aplicación. Nunca se guarda ni se envía el número de tarjeta.
- **¿Qué evita que un cliente vea órdenes ajenas?** Cada recurso guarda su dueño; el dueño es el `sub` verificado del JWT. Solo el rol ADMIN lee entre clientes, y tiene pruebas de 401, 403 y 200.
- **¿Qué es el QR?** Un texto firmado con HMAC (clave derivada de `JWT_SECRET`) con billete y PNR; sin datos personales. La verificación pública responde válido o inválido sin nombres.
- **¿Qué falta?** Cabinas distintas de economía, vuelos con escalas y pagos reales; la interfaz web de posventa, check-in y webhooks (el contrato completo ya está activo y se usa desde Swagger). Son simplificaciones documentadas de esta fase. Los montos y plazos de la posventa son decisiones del equipo, en configuración.
- **¿Cómo lo observan en producción?** `/health` para el balanceador; el panel de Observabilidad con cifras desde la base (sobreviven reinicios) y contadores en vivo del proceso (se reinician).
- **¿Y los otros dominios (Alojamientos, Autos, Atracciones)?** Son de otros equipos. En este despliegue solo está montado Vuelos, por eso no aparecen en Swagger; la integración real entre equipos es de la siguiente fase.

---

## 12. Lista rápida de 10 minutos

1. `GET /api/v1/health` → UP.
2. 1A invitado → Authorize.
3. 2B buscar BOG→SCL ida y vuelta, 2 adultos y 1 bebé; anotar los dos `itinerarioId`.
4. 3A crear oferta (UUID nuevo).
5. 3B pasajeros con asientos `12A` y `12B`.
6. 3C facturación, 3D condiciones.
7. Error 1: `tok_declined` → `402`, la oferta sigue viva.
8. Paso 4 con `tok_visa_ok` (UUID nuevo) → `201`.
9. Repetir el paso 4 con la misma clave → misma orden.
10. 5C verificar el QR (válido y alterado).
11. Cambiar a ADMIN: detalle de la orden (QR y asientos), vuelo (mapa) y Observabilidad.
12. 6A–6F: equipaje, cotizar y cancelar (orden `REEMBOLSADA`); 7B antes del check-in (`404`); 8B con una URL privada (`400`).
13. Una ruta de admin con token de cliente (`403`).
