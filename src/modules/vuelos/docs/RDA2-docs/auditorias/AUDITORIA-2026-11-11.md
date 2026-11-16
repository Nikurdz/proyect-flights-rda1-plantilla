# Auditoría del proyecto RAM Alliance Vuelos — 2026-11-11

- **Alcance:** backend (`src/`), frontend (`frontend/`), contratos, CI y despliegue (`.github/`, `Dockerfile`, `deploy/`).
- **Commit auditado:** `1f4d2e9` (rama `vuelos`), el mismo que corre en Azure Container Apps.
- **Método:** lectura de código por tres exploraciones en paralelo (seguridad, corrección/datos/pruebas, frontend/despliegue). Los hallazgos crítico, alto y los medios marcados **[V]** fueron releídos en el código por el auditor principal; los marcados **[E]** provienen de la exploración y no se releyeron. No se modificó ningún archivo del proyecto.
- **No cubierto:** pruebas de penetración, carga, accesibilidad completa, configuración real de Netlify y de GHCR, contenido de `.env` y `.env.azure`, versiones actuales de dependencias en npm.

## 1. Resumen ejecutivo

El sistema está bien construido en lo estructural: JWT con algoritmo y emisor fijados, propiedad comprobada en las rutas por recurso, contraseñas con scrypt, datos personales cifrados con AES-256-GCM, protección SSRF en todas las salidas HTTP, transacciones e idempotencia cuidadas en hold, reserva y compra, y una CI que corre lint, build y pruebas de integración con Postgres.

Hay **un hallazgo crítico, confirmado en producción**: el feed `GET /api/v2/vuelos/eventos` devuelve los eventos de reservas de todos los dueños y lo puede leer cualquiera con un token de invitado, que se obtiene sin credenciales. Expone PNR, números de billete, identificador del dueño e importes. Debe corregirse antes que cualquier otra cosa.

El resto se agrupa en cuatro temas:

1. **Control de acceso por PNR y apellido** (alto): la recuperación pública permite reclamar una orden de invitado y actuar sobre ella.
2. **Fechas en UTC que quedaron fuera del arreglo de ayer** (medio): la reserva de experiencias rechaza "hoy" desde las 19:00 de Ecuador, y código, interfaz y documentación no coinciden sobre los filtros por día del listado de reservas.
3. **Cadena de entrega sin puerta de calidad** (medio): la imagen se publica aunque la CI falle, el despliegue es manual y no comprueba nada, y el frontend cae a un backend antiguo si falta una variable.
4. **Deuda de pruebas y documentación** (medio/bajo): un test inestable por carga, tests que dependen de la hora, flujos críticos del frontend sin test, la base local que no arranca y documentación que aún describe Railway.

| Severidad | Cantidad |
|---|---|
| Crítica | 1 |
| Alta | 1 |
| Media | 12 |
| Baja | 11 |

## 2–4. Hallazgos, evidencia y recomendación

### Crítico

#### C-1 · El feed de eventos v2 expone las reservas de todos los dueños a cualquier invitado **[V, confirmado en producción]**

- **Evidencia:**
  - `src/modules/vuelos/v2/outbox-v2.service.ts` — `list()`: `where: { seq: MoreThan(afterSeq), ...(query.type ? { type: query.type } : {}) }`, sin condición por dueño. `onModuleInit()` registra todos los eventos (`subscribeAll`).
  - `src/modules/vuelos/v2/vuelos-v2.controller.ts` — `listOutboxEvents(@Query() query)`: exige `flights:read` pero no recibe ni pasa la identidad.
  - `src/modules/vuelos/v2/auth/partner-auth.guard.ts` — un token que no es de servicio y no trae scopes recibe `USER_SCOPES`; `v2/auth/scopes.ts` incluye `flights:read` en `USER_SCOPES`.
  - `src/modules/vuelos/ecommerce/identidad/identidad.controller.ts` — `POST /auth/invitado` es público.
  - `src/modules/vuelos/common/cloud-events.ts` — `bookingData` incluye `bookingId`, `pnr`, `ownerId`, `grandTotal`; `booking.ticket_issued` añade `paymentReference` y `tickets`.
  - **Prueba en producción (2026-11-11):** con un token de `POST /api/v1/auth/invitado`, `GET /api/v2/vuelos/eventos?type=booking.ticket_issued&limit=3` respondió 200 con 3 eventos de un dueño `partner:…`, con los campos `pnr`, `tickets`, `bookingId`, `ownerId`, `grandTotal`. Solo se inspeccionaron nombres de campo y conteos.
- **Impacto:** cualquier persona sin cuenta puede recorrer todo el histórico de reservas (propias de la web y de Booking): localizadores, billetes, importes y estados. No incluye nombres, correos ni documentos. Facilita A-1.
- **Recomendación:** filtrar por la cuenta del token: para un socio, sus eventos (`partner:<clientId>` y `partner:<clientId>:user:*`, misma regla que `accountOf` en `services/webhooks.service.ts`); para un usuario o invitado, solo los suyos; todo únicamente para ADMIN. Requiere guardar el dueño del evento en `vuelos_outbox` como columna indexada (migración con relleno desde `cloudEvent.data.ownerId`). Valorar además retirar `flights:read` sobre `/eventos` de `USER_SCOPES`: es un feed pensado para socios.

### Alto

#### A-1 · Con PNR (o número de orden) y apellido se puede reclamar una orden de invitado **[V]**

- **Evidencia:** `src/modules/vuelos/ecommerce/ordenes/ordenes.service.ts` — `vincular`: si la orden es `guest:` y no tiene cliente, cambia `ownerId`/`clienteId` de la `Orden` y el `ownerId` del `Booking` a quien llama. Límite: `recoveryLimiter = new SlidingWindowLimiter(10, 60_000)` por IP. [E] La vista pública incluye nombres, e-ticket y `qr` de cada pasajero.
- **Impacto:** quien conoce PNR y apellido (datos impresos en cualquier pase de abordar) pasa a ser dueño de la orden: ve el contacto y puede cancelarla. C-1 entrega PNR válidos; el apellido no.
- **Recomendación:** exigir un segundo factor para reclamar (código enviado al correo de contacto de la orden) o permitir `vincular` solo cuando el correo de la cuenta coincide con el de contacto. Dejar la recuperación pública en solo lectura y revisar si debe devolver el `qr`.

### Medio

#### M-1 · La reserva de experiencias rechaza "hoy" desde las 19:00 de Ecuador **[V]**
- **Evidencia:** `src/modules/vuelos/ecommerce/integracion/reservas-externas.service.ts` — `const hoy = new Date().toISOString().slice(0, 10); if (dto.fecha < hoy) …`.
- **Recomendación:** usar `todayEcuador()` de `common/date.util.ts`. En el frontend, `lib/experiencias.ts` (`todayIso`) y `features/admin/admin-schemas.ts` usan el día del navegador [E]: alinearlos con `lib/dates.ts`.

#### M-2 · Filtros por día del listado de reservas: código, interfaz y documentación no coinciden **[V]**
- **Evidencia:** `src/modules/vuelos/ecommerce/admin/reservas-admin.service.ts` — `filtered()` filtra `createdAt` por día UTC (comentario: «A day bound covers the whole UTC day»). `CLAUDE.md` (Time) dice que los filtros de día del admin son días de Ecuador. [E] `frontend/src/features/admin/AdminReservationsPage.tsx` avisa «días UTC». [E] `services/bookings.service.ts` usa `utcDayRange` para `createdFrom/createdTo`.
- **Impacto:** una reserva hecha a las 20:00 de Ecuador no aparece al filtrar por ese día; el resto del back office (órdenes, conciliación, trazabilidad) sí usa día de Ecuador.
- **Recomendación:** pasar el mostrador a `ecuadorDayRange` y quitar el aviso de la interfaz, o dejarlo en UTC y corregir `CLAUDE.md`. Lo primero es lo coherente.

#### M-3 · La imagen se publica aunque la CI falle, y el despliegue no comprueba nada **[V]**
- **Evidencia:** `.github/workflows/container.yml` — `on: push: branches: [vuelos]`, sin dependencia de `ci.yml`; publica `:<sha>` y `:latest`. `deploy/azure/desplegar.sh` solo ejecuta `az containerapp update`. Observado el 2026-11-10: la imagen de `1f4d2e9` estuvo lista (1 min) y se desplegó con la CI aún en curso. [E] `deploy/azure/crear.sh` usa `:latest` por defecto.
- **Recomendación:** que la imagen se construya solo tras CI en verde (`workflow_run` con `conclusion == success`, o un job con `needs`); que `desplegar.sh` verifique con `gh run list` que CI e imagen del sha terminaron bien; `crear.sh` con sha, no `latest`.

#### M-4 · `SEAT_TAKEN` al guardar pasajeros no refresca el mapa ni limpia la selección **[V]**
- **Evidencia:** `frontend/src/features/checkout/PassengerForm.tsx` — el `catch` de `registrarPasajeros` solo hace `setSubmitError(err)`. [E] `frontend/src/api/problem-details.ts` muestra «vuelve a Pasajeros y elige otro asiento» estando ya en Pasajeros.
- **Impacto:** desde el cambio de asientos apartados (2026-11-10) este 409 llega al guardar pasajeros; el asiento perdido sigue marcado y el usuario reintenta lo mismo.
- **Recomendación:** ante 409 `SEAT_TAKEN`, invalidar la consulta `['asientos', …]`, quitar la selección rechazada y ajustar el texto al paso.

#### M-5 · El frontend de producción cae a un backend antiguo si falta `VITE_API_URL` **[V]**
- **Evidencia:** `frontend/src/api/client.ts` — `VITE_API_URL || (DEV ? '/api/v1' : 'https://proyect-flights-rda1-plantilla.onrender.com/api/v1')`. [E] Mismo host en `frontend/vite.config.ts`, `frontend/package.json` (`generate-api`) y `frontend/.env.example`.
- **Recomendación:** fallar el build de producción si falta la variable y apuntar ejemplos y `generate-api` a la API de Azure. No se pudo comprobar qué valor tiene hoy Netlify.

#### M-6 · Una orden que falla bloquea el reanuncio de las siguientes **[V]**
- **Evidencia:** `src/modules/vuelos/ecommerce/ordenes/reconciliacion.service.ts` — `for (const orden of huerfanas) { … await this.compras.publicarEmision(orden, mercado); }` sin `try/catch` por orden, con `.orderBy(creadaEn ASC).take(50)`.
- **Recomendación:** aislar cada orden con `try/catch` y registrar el fallo; una que falle siempre no debe ocupar la ventana indefinidamente.

#### M-7 · Bloqueo de cuentas por terceros y enumeración de correos **[E]**
- **Evidencia:** `src/modules/vuelos/ecommerce/identidad/identidad.service.ts` — 5 fallos bloquean la cuenta 15 min; el límite de login es solo por IP; `ACCOUNT_LOCKED` se responde antes de comprobar la contraseña; el alta responde 409 `EMAIL_ALREADY_REGISTERED` sin límite propio.
- **Recomendación:** bloquear por la pareja IP+cuenta o con retardo progresivo, responder igual a cuenta bloqueada y a credenciales inválidas, y limitar el alta por IP.

#### M-8 · La base local de desarrollo no arranca **[V, observado]**
- **Evidencia:** `npm run start` contra `booking_db` falla con «column "travellerId" of relation "vuelos_passengers" contains null values». `entities/passenger.entity.ts` declara `travellerId` obligatorio; `app.module.ts` usa `synchronize` fuera de producción; la migración `1793932853618-PassengerTravellers.ts` sí rellena antes de poner `NOT NULL`, pero en desarrollo no se ejecuta.
- **Impacto:** no se puede probar nada en navegador contra la base local (por eso el estado «apartado» del mapa sigue sin verificación visual).
- **Recomendación:** recrear la base de desarrollo y sembrarla; a medio plazo, desarrollo con migraciones en lugar de `synchronize`.

#### M-9 · Test de stock gRPC inestable en la pasada completa **[V, observado]**
- **Evidencia:** `src/modules/vuelos/testing/stock-grpc.integration.spec.ts` falla por «timed out waiting for the gRPC push» con `npm test` (2 de 2 pasadas, también en el commit anterior `eb3288d`), y pasa solo o con `--maxWorkers=2`. [E] `v2/stock-push.service.ts` envía por gRPC vuelo a vuelo en serie y el spec siembra todo el horizonte; usa `sync()` + espera activa en vez de `flush()`.
- **Recomendación:** sembrar pocos vuelos en ese spec, esperar con `stock.flush()`, y enviar gRPC con concurrencia acotada como ya hace HTTP.

#### M-10 · Tests que dependen de la hora del día **[E, un fallo observado]**
- **Evidencia:** `src/modules/vuelos/testing/booking-prueba.integration.spec.ts` (~223) calcula «hoy» con `new Date().toISOString().slice(0, 10)`; falló el 2026-11-10 a ~21:00 de Ecuador y pasó al día siguiente. El helper `dayAhead` en UTC se repite en unas 20 suites.
- **Recomendación:** un helper único de fechas de prueba basado en `todayEcuador()` (o reloj inyectado) y revisar las suites que comparan contra filtros por día.

#### M-11 · Flujos críticos del frontend sin pruebas **[E]**
- **Evidencia:** ninguno de los 40 tests de `frontend/tests/unit/` cubre `SeatMap`, `SeatSelector`, `PaymentForm`, `PassengerForm`, `CheckoutPage` ni las guardas de `routes/guards.tsx`. `frontend/tsconfig.json` incluye solo `src`, así que los tests no pasan por `tsc`.
- **Recomendación:** tests de componente para el mapa (AVAILABLE/HELD/OCCUPIED), el 409 al guardar pasajeros, el pago y las guardas; un `tsconfig` que incluya `tests`.

#### M-12 · `MIN_REPLICAS=0` detiene los trabajos periódicos sin aviso **[E, documentado]**
- **Evidencia:** `deploy/azure/generar-app.js` — `minReplicas: Number(process.env.MIN_REPLICAS ?? 0)`. Con la app dormida no hay envío de stock, reconciliación, entrega de webhooks ni barrido de holds.
- **Recomendación:** decidir explícitamente para la demo con Booking: `MIN_REPLICAS=1` mientras dure la integración, o un ping externo periódico. Hoy depende de pasarlo por línea de comandos.

### Bajo

| Id | Hallazgo | Evidencia | Recomendación |
|---|---|---|---|
| B-1 | Swagger público en producción, sin `helmet`, GraphQL sin límite de complejidad **[E]** | `src/main.ts` (`SwaggerModule.setup('api/docs' …)` sin condición), `package.json`, `gateway/gateway.module.ts` | Swagger solo fuera de producción o tras ADMIN; añadir `helmet`; límite de complejidad/alias |
| B-2 | Webhook de Booking sin ventana de tiempo (admite repetición) **[E]** | `v2/booking-inbound-v2.controller.ts` acepta firma del cuerpo sin timestamp | Exigir timestamp firmado y ventana de 5 min |
| B-3 | JWT sin revocación ni `audience` **[E]** | `auth/token.service.ts` | TTL corto con renovación o lista de revocación por `sub` |
| B-4 | Cabecera `X-User-Roles` aceptada de tokens de servicio (latente) **[V]** | `v2/auth/partner-auth.guard.ts` | Ignorarla para autorizar |
| B-5 | Sin cabeceras de seguridad para el SPA; token caducado no se borra **[E]** | no hay `frontend/public/_headers` ni `netlify.toml`; `frontend/src/lib/session.ts` | `_headers` con CSP y afines; limpiar el token al detectar expiración |
| B-6 | Acciones de GitHub sin fijar por SHA, con `packages: write` **[E]** | `.github/workflows/container.yml`, `ci.yml` | Fijar por SHA |
| B-7 | Revisión única en Azure: sin vuelta atrás rápida **[E]** | `deploy/azure/generar-app.js` (`activeRevisionsMode: 'Single'`) | Documentar el rollback por sha anterior |
| B-8 | `crear.sh` puede dejar secretos en un archivo temporal si falla **[E]** | `deploy/azure/crear.sh` (`.app.generada.json`, borrado solo al final) | `trap 'rm -f …' EXIT` |
| B-9 | Errores tragados y avisos que no llegan **[E]** | `reservas-externas.service.ts` (`.catch(() => undefined)` al publicar la cancelación); `compras.service.ts` (un error leyendo el hold cierra la oferta como `VENCIDA`); `offers.service.ts` `replaceHoldSeatsWithin` no avisa si el hold ya venció | Registrar el error; distinguir «no encontrado» de «error»; devolver si se apartó o no |
| B-10 | Documentación y restos desfasados **[V/E]** | `CLAUDE.md`: Railway con auto-deploy, «45-day rolling horizon» (hoy 180 días nacionales), `ecom_auditoria_cambios` (hoy `auditoria_administrativa`); `render.yaml`, `start:render`; `deploy/azure/README.md`; `frontend/README.md`; `frontend/src/api/schema.d.ts` («no implementado»); pantallas admin sin ruta (`AdminProvidersPage`, `AdminNodesHealthPage`) | Actualizar `CLAUDE.md` y READMEs, retirar o marcar como histórico lo de Render/Railway, regenerar `schema.d.ts`, borrar o reactivar las pantallas |
| B-11 | Detalles menores **[E]** | UTC en la nota de cambio de fecha (`date-change.service.ts`) y en la vigencia de promociones (`promotions-v2.service.ts`); `docker-compose.yml` publica 5432/8000 en todas las interfaces con contraseña por defecto; `Dockerfile` sin digest ni `HEALTHCHECK`; `VITE_SHOW_TEST_CARDS=true` en `.env.example`; sin `engines` en `package.json`; `migration:check` no corre en CI; archivos de más de 500 líneas (`AdminReservationsPage.tsx`, `api/endpoints/admin.ts`) | Corregir según convenga; ninguno urge |

### Revisado y sin hallazgo

JWT (HS256, emisor, `exp`, guard que falla cerrado); `@Roles('ADMIN')` en los controladores de administración; propiedad en reservas, holds, órdenes, ofertas y webhooks; scopes en las operaciones v2; scrypt con sal y comparación en tiempo constante; AES-256-GCM con IV aleatorio e índice ciego con clave derivada aparte; `DATA_ENCRYPTION_KEY` obligatoria en producción; `.env` y `.env.azure` ignorados por git y sin secretos reales en el repositorio; protección SSRF con IP resuelta fijada en webhooks, stock y proveedores; opciones de hosts privados rechazadas en producción; CSV con neutralización de fórmulas; `ValidationPipe` estricto; sin SQL con entrada de usuario interpolada; GraphQL con errores enmascarados y resolvers autorizados; frontend sin `dangerouslySetInnerHTML`, con `next` saneado e `Idempotency-Key` en las escrituras; imagen multi-etapa con usuario no root y secretos como `secretRef`; expiración de holds con `SKIP LOCKED` y transición condicional; asientos apartados con bloqueos ordenados.

## 5. Pruebas a repetir después de corregir

**Seguridad**
1. C-1: test de integración en `v2.integration.spec.ts` — un invitado y un cliente no ven eventos de otro dueño; un socio ve solo los de su cuenta (incluidos sus `user:*`); ADMIN ve todos; el cursor `after` sigue funcionando. Repetir en producción la llamada con token de invitado: debe devolver 0 eventos ajenos o 403.
2. C-1: migración del dueño en `vuelos_outbox` probada contra datos existentes, y `npm run migration:check:vuelos` en 0.
3. A-1: reclamar una orden de invitado con PNR y apellido correctos pero sin el segundo factor debe fallar; el titular legítimo sigue pudiendo recuperarla y verla.
4. M-7: 5 fallos desde una IP no bloquean el acceso legítimo desde otra; misma respuesta para cuenta bloqueada y credenciales inválidas; alta repetida limitada.
5. B-1/B-2/B-4: `/api/docs` no accesible en producción; webhook con timestamp antiguo rechazado; `X-User-Roles` sin efecto.

**Fechas** (con el reloj fijado a las 19:30 y a las 10:00 de Ecuador)
6. M-1: reservar una experiencia para «hoy» de Ecuador responde 201; para ayer, 400.
7. M-2: una reserva creada a las 20:00 de Ecuador aparece al filtrar el mostrador por ese día.
8. M-10: la suite completa en verde con el reloj en ambas horas.

**Backend**
9. M-6: dos órdenes huérfanas, la primera con fallo forzado: la segunda se anuncia igual.
10. M-9: `npm test` sin `--maxWorkers`, tres pasadas seguidas en verde.
11. M-8: `npm run start:dev` contra una base recreada y sembrada; después, verificación visual del estado «apartado» con dos ofertas.
12. Regresión general: `npm run lint`, `npm run build`, `npm test` (502 pruebas hoy), `contract-v2-build.spec`, `contract.integration.spec`.

**Frontend**
13. M-4: test que simule 409 `SEAT_TAKEN` en `registrarPasajeros`: se vuelve a pedir el mapa, se quita el asiento y el mensaje corresponde al paso.
14. M-5: `npm run build` sin `VITE_API_URL` falla; con la URL de Azure, las peticiones van a Azure.
15. M-11: nuevos tests de mapa, pago y guardas; `tsc` sobre `tests/`.
16. `npm run lint`, `npm run build`, `npm test` en `frontend/` (273 pruebas hoy).

**Entrega**
17. M-3: un commit con un test roto no produce imagen nueva en GHCR; `desplegar.sh` se niega a desplegar un sha sin CI en verde.
18. M-12: con el valor de réplicas elegido, comprobar tras una hora sin tráfico que el stock llega a Booking y que un hold vencido se libera.
19. Tras cada despliegue: `GET /api/v1/health`, y los pasos de Booking (hold con `assignedSeats` → 201/409, seatmap `HELD` → liberar → `AVAILABLE`, búsqueda de hoy después de las 19:00).
