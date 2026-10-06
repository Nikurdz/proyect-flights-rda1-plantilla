# Módulo de Vuelos (GDS Flight Core API)

Este microservicio centraliza la lógica de Búsqueda, Ofertas, Retención (Hold), Reservas, Emisión de Tickets, Postventa, Check-in y Estado de Vuelos.

## Estado de la implementación

El módulo tiene dos capas, ambas con lógica real contra Postgres (sin mocks):

1. **Núcleo de vuelos (contrato `contracts/vuelos-openapi.yaml`)**: búsqueda, seatmap, hold, reserva, tickets y estado de vuelo.
2. **E-commerce (SRS `docs/SRS_Plataforma_Ecommerce_LATAM.md`, liberación R1 "Compra de vuelo")**: identidad, mercados, búsqueda y precios, oferta/checkout, pagos, órdenes y notificaciones. Vive dentro de este módulo (`ecommerce/`) para respetar la regla de la plantilla: cada equipo habilita solo su módulo en `app.module.ts`.

### Núcleo de vuelos (GDS) — rutas bajo `/api/v1`

- **Real**: `POST /search`, `GET /offers/:offerId/seatmap`, `POST/GET/DELETE /offers/hold*`, `GET/POST /bookings`, `GET /bookings/:id`, `GET /bookings/:id/tickets*`, `GET /flights/:flightNumber/status`.
- **No implementado — responden `501` (`NOT_IMPLEMENTED`), nunca un 200 vacío**: equipaje, cambio de fecha, cancelación, check-in, boarding passes y webhooks. Son las liberaciones R2 del SRS (post-venta y check-in).
- **Autenticación**: toda ruta de datos exige un JWT `Bearer` con firma HS256 verificada; el `ownerId` sale del `sub` verificado, no hay fallback a un usuario por defecto, y lecturas/escrituras de holds, reservas y tickets exigen que el recurso sea del solicitante (`403` si no). `search`, `seatmap` y `flights/.../status` son públicas. No hay IdP externo en RDA1: el servicio de identidad de este módulo emite los tokens (`POST /auth/login`, `POST /auth/invitado`). Los *scopes* del contrato (`flights:book`, …) se documentan pero no se exigen.
- **Atomicidad e inventario**: crear un hold descuenta `asientosDisponibles` con un `UPDATE` condicional (nunca vende de más); liberar o expirar lo devuelve exactamente una vez. `POST /bookings` crea reserva, pasajeros, asientos y tickets y consume el hold en **una sola transacción** con bloqueo de fila: dos reservas simultáneas del mismo hold → una gana (201) y la otra recibe 409.
- **Idempotencia** (`Idempotency-Key`): una clave se reserva antes de ejecutar y se completa dentro de la misma transacción; un reintento devuelve la respuesta original, la misma clave con otro cuerpo da `422`, y otro usuario nunca puede reproducir la respuesta ajena.
- **Errores**: `application/problem+json` con el enum `code` del contrato. Para estados que el contrato no define se usan códigos propios (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`, `NOT_IMPLEMENTED`, `SERVICE_UNAVAILABLE` y los del e-commerce); los errores inesperados nunca devuelven el mensaje interno.

Simplificaciones deliberadas y documentadas (no omisiones silenciosas):

1. **Solo vuelos directos** y **solo cabina económica** — sin conexiones ni Premium.
2. **Sin Redis** — Offer/Hold son tablas Postgres con `expiresAt`; un barrido cada 30 s y la expiración perezosa liberan los asientos.
3. **Instantes en UTC**: `departureDate` se interpreta como día UTC (aún no se usa la zona horaria del aeropuerto, aunque el catálogo `ecom_localidades` ya la guarda).
4. **Tarifas**: `TAX_RATE` es un porcentaje plano y los factores por tipo de pasajero (adulto/joven 100 %, niño 75 %, infante 10 %) son un marcador de posición, no una tabla tarifaria real.
5. **Rangos de edad por tipo de pasajero** (RN-06) son un valor por defecto pendiente de definición del negocio.

### E-commerce R1 — rutas bajo `/api/v1`

| Dominio SRS | Rutas principales |
|---|---|
| D02/D19 Mercados y configuración | `GET /mercados/{pais}` · `PUT /admin/mercados/{pais}` (ADMIN, control optimista y auditoría) · `GET /admin/auditoria` |
| D01 Identidad | `POST /clientes` · `POST /auth/login` · `POST /auth/invitado` · `POST /auth/verificar-correo` · `GET /clientes/{id o me}` · `PUT /clientes/{id o me}/preferencias` |
| D04/D05 Búsqueda y precios | `GET /localidades?q=` · `GET /disponibilidad` (parámetros del enlace profundo) · `GET /itinerarios/{id}/tarifas` |
| D06/D07 Oferta y checkout | `POST /ofertas` · `GET/DELETE /ofertas/{id}` · `POST …/revalidacion` · `POST …/aceptacion-precio` · `PUT …/pasajeros` · `PUT …/facturacion` · `POST …/condiciones` · `GET …/medios-pago` |
| D08/D09 Pago y órdenes | `POST /ofertas/{id}/compra` (saga) · `GET /ordenes/{numero}` · `GET /ordenes?numero=` o `?pnr=` más `apellido=` (recuperación pública) · `GET /clientes/{id o me}/ordenes` |
| D16 Notificaciones | automático por eventos de dominio · `GET /admin/notificaciones` (ADMIN) |
| Back-office | `GET /admin/ordenes` (filtros y cursor) · `GET /admin/ordenes/:numero` · `GET /admin/vuelos` (inventario), solo ADMIN: es lo único que lee datos de otros clientes |

Flujo de compra (SRS §8.4), con `Idempotency-Key` en `POST /ofertas` y `POST /ofertas/{id}/compra`:

1. `POST /auth/invitado` (o login) → token.
2. `GET /disponibilidad` → elegir itinerarios.
3. `POST /ofertas` → **retiene inventario real** y fija mercado y moneda (RN-01).
4. `PUT pasajeros`, `PUT facturacion`, `POST condiciones`.
5. `POST /ofertas/{id}/compra` con un token de pasarela.

La compra **revalida el precio** (si cambió → `409 PRICE_CHANGED` hasta que el cliente acepte), **autoriza el pago** (antifraude + pasarela), **crea la orden y emite reserva y billetes en una sola transacción**, y **captura**. Si la emisión falla después de autorizar, la autorización se **anula automáticamente** (RN-19) y queda una orden `FALLIDA_COMPENSADA`; una tarjeta rechazada devuelve `402` y la oferta sigue vigente para otro medio. Un reintento nunca cobra dos veces: la misma clave devuelve el resultado original y una clave nueva retoma la orden ya emitida.

**Simulado en RDA1** (sin servicio real detrás, claramente marcado en los logs): la **pasarela de pago**, el **antifraude** y el **canal de correo**. Están detrás de puertos (`pagos/ports`, `notificaciones/ports`), de modo que un adaptador real los reemplaza sin tocar el dominio. Tokens de prueba de la pasarela: `tok_<visa|mastercard|amex|diners>_ok` aprueba; `tok_declined`, `tok_insufficient`, `tok_expired`, `tok_3ds` la rechazan; `tok_fraud` y `tok_review` los rechaza el antifraude; `tok_<marca>_capture_fail` aprueba pero falla la captura. Nunca se recibe ni guarda un número de tarjeta (RN-18).

**Datos sensibles**: pasajeros (también los de la reserva GDS, `vuelos_passengers`), contacto y facturación se guardan **cifrados en reposo** (AES-256-GCM, `DATA_ENCRYPTION_KEY`); las contraseñas con scrypt; los tokens de verificación solo como hash. La recuperación pública de una orden exige número o PNR **más** apellido, no devuelve datos de contacto y limita los intentos por IP. También tienen límite (en memoria, por instancia): el login, la sesión de invitado y la verificación de correo por IP, y armar ofertas y pagar por cliente.

**Reconciliación** (`ordenes/reconciliacion.service.ts`, cada 60 s): como no hay broker ni outbox en esta fase, cierra lo que un corte o una caída de la pasarela deja a medias: captura los pagos `CAPTURA_PENDIENTE`, anula las autorizaciones `ANULACION_PENDIENTE` (la saga registra la orden `FALLIDA_COMPENSADA` aunque la pasarela no pueda anular al instante) y vuelve a anunciar las órdenes emitidas cuya confirmación nunca se envió. Cada paso es idempotente.

**Fase actual**: solo se vende cabina `ECONOMY` y no se admite equipaje extra (se rechazan con 422 en vez de aceptarse en silencio); una reserva no se confirma si el vuelo ya despegó.

**Fuera de R1** (siguientes liberaciones del SRS): post-venta (cambios, devoluciones, retracto), check-in, adicionales, millas y Wallet, socios, atención y analítica; medios de pago locales y 3-D Secure; verificación en dos pasos; GraphQL BFF.

### Cómo correr y sembrar datos

```bash
docker-compose up -d              # o docker compose (ver docker-compose.override.yml si el puerto 5432 ya está en uso)
npm run start:dev                 # crea el esquema vía TypeORM synchronize (solo fuera de producción)
npm run seed:vuelos               # vuelos de los próximos 45 días, familias tarifarias, mercados, localidades y plantillas
```

El seed es idempotente: no duplica ni pisa lo que un administrador editó, y cada ejecución extiende el calendario de vuelos. Para crear un administrador defina `ADMIN_EMAIL` y `ADMIN_PASSWORD` (≥ 12 caracteres) al ejecutarlo; no existe ninguna cuenta por defecto. En desarrollo el cuerpo de los correos simulados se imprime en la consola y también se puede leer con `GET /admin/notificaciones?referencia=…`.

Swagger: `http://localhost:3000/api/docs` (use el botón *Authorize* con un token de `POST /auth/login` o `POST /auth/invitado`).

Variables relevantes (ver `.env.example`): `DATABASE_URL`, `JWT_SECRET` (≥ 32 caracteres, obligatoria), `DATA_ENCRYPTION_KEY` (obligatoria en producción), `TAX_RATE`, `DEFAULT_CURRENCY`, `OFFER_TTL_MINUTES`, `HOLD_TTL_MINUTES`, `OFFER_MAX_COMBINATIONS`, `MAX_PASSENGERS_PER_ORDER`, `TRUST_PROXY` (saltos de proxy; `1` en Render para que los límites por cliente vean la IP real). La configuración se valida al arrancar: un valor inválido detiene la app con un mensaje claro.

### Pruebas

```bash
npm test                          # unitarias; las de integración se omiten si no hay TEST_DATABASE_URL
```

Las pruebas de integración (`testing/*.integration.spec.ts`) levantan el módulo real contra Postgres, cada suite en su propio *schema*, y cubren concurrencia de reservas e inventario, expiración, idempotencia, propiedad, la saga de compra con compensación y el cifrado en reposo. Defina `TEST_DATABASE_URL` hacia una base **desechable** (p. ej. `booking_test`) en su `.env`.

### Migraciones y despliegue

En producción la app **no** sincroniza el esquema (así lo decide `app.module.ts`); el esquema llega por migraciones TypeORM versionadas en `migrations/`:

```bash
npm run migration:run:vuelos          # aplicar (desarrollo, ts-node)
npm run migration:generate:vuelos -- src/modules/vuelos/migrations/NombreDelCambio   # tras cambiar una entidad, contra una BD con el esquema anterior
npm run migration:check:vuelos        # falla si las entidades difieren de las migraciones (úsese contra una BD migrada)
```

`render.yaml` ejecuta `npm run start:render` (migrar → sembrar → iniciar). `JWT_SECRET` y `DATA_ENCRYPTION_KEY` los genera Render; **no regenere `DATA_ENCRYPTION_KEY`** en una base que ya tenga órdenes o los datos cifrados dejarían de poder leerse.

## Arquitectura y Límites de Dominio

La API de Vuelos actúa como un orquestador dentro de su propio dominio, pero **delega responsabilidades fundamentales** a otros microservicios mediante integración. No almacena información de tarjetas de crédito, ni gestiona perfiles complejos de clientes, ni emite facturas fiscales.

### Diagrama de Integración

```mermaid
graph TD
    %% Vuelos (Dominio Principal)
    subgraph Vuelos [Booking / Flight API]
        A[Search & Offers]
        B[Hold (Bloqueo)]
        C[Booking / PNR]
        D[Ticketing & Seats]
        E[Check-in & Boarding]
        F[Postventa: Fechas, Maletas, Cancelación]
    end

    %% Dominios Externos
    subgraph Pagos [Payment API]
        P1[3DS & Autorización]
        P2[Captura & Reembolso]
    end

    subgraph Clientes [Customer API]
        C1[Perfiles & Datos Personales]
        C2[Agenda de Contactos]
    end

    subgraph Facturacion [Billing API]
        B1[Facturación (Invoices)]
        B2[Notas de Crédito fiscales]
    end

    %% Relaciones
    Vuelos -->|paymentReference| Pagos
    Vuelos -->|Sub (JWT) / ownerId| Clientes
    Vuelos -->|Monto y Conceptos| Facturacion
```

### Flujo Típico (Happy Path)

1. **Autenticación (Identity Provider):** El usuario se autentica y obtiene un token JWT.
2. **Búsqueda (`/search`):** El cliente consulta vuelos. La API devuelve opciones (`offers`).
3. **Bloqueo (`/offers/hold`):** El usuario selecciona un vuelo. Se bloquea el cupo (Hold) por un tiempo determinado (ej. 15 minutos).
4. **Validación de Perfil:** (Fuera de esta API) El Frontend recupera del `Customer API` los datos de los pasajeros frecuentes.
5. **Procesamiento de Pago:** (Fuera de esta API) El Frontend se comunica con la `Payment API` para realizar el cobro (autorización de tarjeta, 3DS, etc.). Se obtiene un `paymentReference`.
6. **Reserva y Emisión (`/bookings`):** El Frontend llama a la API de Vuelos enviando el `holdId`, la lista de pasajeros y el `paymentReference`. 
7. **Confirmación:** La API de Vuelos (esta API) confirma el cupo, genera el PNR y (síncrona o asíncronamente) emite los Tickets. Opcionalmente dispara un Webhook y notifica a la `Billing API` para generar la factura.

## Notas Técnicas
- **Dueño de Reserva:** El usuario propietario se infiere del JWT (`sub`).
- **Idempotencia:** Endpoints críticos de escritura (`POST /bookings`, `POST /offers/hold`, pagos postventa, etc.) requieren el header `Idempotency-Key` para evitar transacciones duplicadas por reintentos de red.
- **Asíncronos:** Operaciones como emisión o cancelaciones pueden retornar un HTTP 202 (Accepted) y usar Webhooks (en `/webhooks`) para notificar al cliente cuando la operación termine de procesarse con el GDS (Global Distribution System).

> [!WARNING]
> **Aviso para el Equipo de Desarrollo (E-commerce / Integradores):**
> El núcleo de vuelos y el e-commerce R1 tienen lógica de negocio real (ver "Estado de la implementación"). Postventa, check-in y webhooks del contrato responden `501` hasta su liberación; la pasarela de pago, el antifraude y el correo son **simulados**.

> [!IMPORTANT]
> **Recordatorio (Fase RDA1):**
> Nos encontramos en la fase **RDA1**. En esta etapa **aún no hay integración** entre plataformas. 
> El archivo OpenAPI sirve actualmente solo como una **guía obligatoria** para que todos sigamos los mismos parámetros y estructuras.
> 
> **Objetivo Actual:** Cada equipo debe construir su aplicativo para que funcione de manera independiente y **subir su API correspondiente a Render**. La verdadera integración (la comunicación entre las APIs) se realizará en las siguientes fases (RDA2, etc.), una vez que se haya verificado que todas las aplicaciones individuales funcionan correctamente en la nube.
