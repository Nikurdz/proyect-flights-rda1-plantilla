# Plan de implementación: un contenedor por microservicio (local/demo)

- **Fecha:** 2026-11-13
- **Agente:** Claude Code Desktop
- **Área:** backend/BD (la infraestructura de contenedores, Kong y la documentación de RDA2-docs las hace otro agente en paralelo)
- **Rama:** `vuelos`

## Objetivo
El profesor pide separar «el docker único» en un contenedor por microservicio. La app sigue siendo una sola base de código Nest: se separa el **núcleo** (venta, holds, órdenes, pagos, API v2 de Booking, stock push) de tres **satélites** que ya eran consumidores de eventos (auditoría, notificaciones, webhooks), que corren en su propio proceso y reciben los eventos por RabbitMQ.

## Alcance
- Incluye: rol del proceso (`SERVICE_ROLE`), interruptores de suscriptores y jobs, cola por servicio en RabbitMQ (`RABBITMQ_SERVICE_QUEUE`), puntos de entrada `src/servicios/<nombre>/main.ts`, scripts `start:<nombre>`, pruebas.
- No incluye: Dockerfiles, `docker-compose.microservicios.yml`, Kong, scripts de smoke y documentación (otro agente); el frontend; una base de datos por servicio.

## Garantía para producción
Azure corre la app **sin** `SERVICE_ROLE`, `RABBITMQ_SERVICE_QUEUE` ni `RABBITMQ_URL`. Sin esas variables el rol es `monolith` (todos los suscriptores y jobs, eventos en memoria) y la topología RabbitMQ es la de hoy. No se tocan rutas, contratos (v1, v2, eventos), OAuth, el `Dockerfile` de la raíz, `.github/workflows` ni `deploy/azure`. La suite completa corre en modo monolito y debe quedar verde.

## Contexto y referencias
- Plan aprobado: `C:\Users\david\.claude\plans\eager-puzzling-pebble.md`.
- La compra corre en una sola transacción (`ecommerce/ordenes/compras.service.ts`), por eso el núcleo no se parte.
- Costura existente: `DomainEventBus` + `RabbitMqTransport`; propuesta en `docs/RDA2-docs/DESCOMPOSICION-MICROSERVICIOS.md`.

## Roles (`common/service-role.ts`)
`SERVICE_ROLE` = `monolith` (por defecto, también vacío) | `api` | `auditoria` | `notificaciones` | `webhooks`. Un valor inválido detiene el arranque con un mensaje legible (validado en `loadVuelosConfig`). Ayudantes: `runsCore()` (monolith o api) y `runsDomain('<dominio>')` (monolith o ese rol). Se leen al arrancar cada suscriptor/job, no al importar.

## Clasificación de suscriptores y jobs
| Pieza | Archivo | Qué hace | Dominio / interruptor |
|-------|---------|----------|-----------------------|
| `AuditoriaTransaccionesService` — `subscribeAll` | `ecommerce/observabilidad/auditoria-transacciones.service.ts` | Escribe cada evento en `auditoria_transacciones` | `runsDomain('auditoria')` |
| `AuditoriaTransaccionesService` — `setAccionSink` | idem | Sumidero de `registrarAccion` (login, oauth2, stock push, entregas) | **`runsCore()`** (las acciones ocurren en el núcleo) |
| `RetencionAuditoriaService` (job 6 h) | `ecommerce/observabilidad/retencion-auditoria.service.ts` | Purga la traza, feed y entregas liquidadas | `runsDomain('auditoria')` |
| `NotificacionesService` (4 suscripciones) | `ecommerce/notificaciones/notificaciones.service.ts` | OrdenEmitida, OrdenFallidaCompensada, ClienteRegistrado, CuentaBloqueada → mensajes | `runsDomain('notificaciones')` |
| `WebhooksService` (suscripciones por tipo) | `services/webhooks.service.ts` | Encola entregas de webhook | `runsDomain('webhooks')` |
| `WebhookDispatcherService` (job 15 s) | `services/webhook-dispatcher.service.ts` | Envía las entregas | `runsDomain('webhooks')` |
| `OutboxV2Service` — `subscribeAll` | `v2/outbox-v2.service.ts` | Alimenta `vuelos_outbox` (la lectura `/eventos` sigue en el núcleo) | `runsDomain('webhooks')` |
| `OrdenesService` (booking.cancelled, PagoReembolsado, booking.changed) | `ecommerce/ordenes/ordenes.service.ts` | La orden sigue a la posventa | `runsCore()` |
| `PagosService` (booking.cancelled) | `ecommerce/pagos/pagos.service.ts` | Reembolso por cancelación | `runsCore()` |
| `OfertasService` (hold.expired) | `ecommerce/ofertas/ofertas.service.ts` | Vence las ofertas del hold | `runsCore()` |
| `InboundEventsV2Service` (pagos.*, paquetes.*) | `v2/inbound-events-v2.service.ts` | Eventos entrantes de Booking | `runsCore()` |
| `GatewayEventBridge` — `subscribeAll` | `gateway/gateway.pubsub.ts` | Suscripciones GraphQL | `runsCore()` |
| `StockPushService` (suscripciones + timer) | `v2/stock-push.service.ts` | Empuja stock a Booking | `runsCore()` |
| `HoldsSweeper` (job) | `services/holds-sweeper.service.ts` | Barre holds vencidos | `runsCore()` |
| `ReconciliacionService` (job 60 s) | `ecommerce/ordenes/reconciliacion.service.ts` | Capturas/anulaciones pendientes | `runsCore()` |
| `SaludProveedoresService` (job 60 s) | `ecommerce/integracion/salud-proveedores.service.ts` | Ping a proveedores | `runsCore()` |
| `HealthV2Service` (job 30 s) | `v2/health-v2.service.ts` | Snapshot de salud v2 | `runsCore()` |
| `BookingBootstrapV2Service` | `v2/booking-bootstrap-v2.service.ts` | Registra a Booking como suscriptor v2 | `runsCore()` |
| `PeticionesHttpService` (flush/purga + sink HTTP) | `ecommerce/observabilidad/peticiones-http.service.ts` | Muestra de tráfico HTTP (solo el núcleo sirve HTTP de negocio) | `runsCore()` |

Quedan sin interruptor (no son suscriptores ni jobs de dominio): `AirportZones`, `GatewayService` (cargas al arrancar), `AuditoriaCambioSubscriber` (suscriptor de TypeORM, solo actúa con cambios administrativos del núcleo), `RabbitMqTransport` (se activa solo con `RABBITMQ_URL`).

## RabbitMQ (`esb/rabbitmq.transport.ts`)
- Sin `RABBITMQ_SERVICE_QUEUE`: igual que hoy (`q.ordenes.confirmadas`, `q.sagas.compensacion`, `q.general`, `q.vuelos.entrantes`).
- Con `RABBITMQ_SERVICE_QUEUE=q.svc.<nombre>`: el proceso declara **su** cola durable (mismo DLX `booking.dlx`), la enlaza al exchange `booking.events` con todas las claves (`TODAS_LAS_CLAVES`: las tres de categoría y las de eventos entrantes de Booking) y consume solo esa. Cada servicio recibe una copia de cada evento; réplicas del mismo servicio compiten. Los eventos de Booking de esa cola se convierten por routing key. Los reintentos (`x-retries`, 3) vuelven a la cola propia (exchange por defecto) para no duplicar entregas en los otros servicios; al tercer fallo, `q.dead_letter`.
- `DomainEventBus.publish` con transporte activo no despacha en local (ya era así); el satélite que recibe llama a `bus.despachar` con sus handlers.

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `common/service-role.ts` (nuevo) | Rol y ayudantes |
| `common/vuelos-config.ts` | Valida `SERVICE_ROLE` |
| Servicios de la tabla | `if (!runs…) return;` al inicio de `onModuleInit`/`onApplicationBootstrap` |
| `esb/rabbitmq.transport.ts` | Cola por servicio, reintentos a cola propia |
| `src/common/typeorm-config.ts` (nuevo) | Config TypeORM compartida; `app.module.ts` la usa sin cambiar su resultado |
| `src/servicios/comun/*` (nuevo) | Base de satélites (config, TypeORM `synchronize: false`, transporte), arranque, `GET /health` |
| `src/servicios/{auditoria,notificaciones,webhooks}/` (nuevo) | `main.ts` + módulo |
| `package.json` | `start:auditoria`, `start:notificaciones`, `start:webhooks` |
| `testing/integration-app.ts` | Limpia `SERVICE_ROLE` y `RABBITMQ_SERVICE_QUEUE` |
| Specs nuevos | `common/service-role.spec.ts`, ampliación de `esb/rabbitmq.transport.spec.ts`, `testing/service-role.integration.spec.ts` |

## Satélites
| Servicio | Ruta compilada | Puerto por defecto | Salud |
|----------|----------------|--------------------|-------|
| auditoría | `dist/servicios/auditoria/main.js` | 3001 | `GET /health` → `{status:'UP', servicio:'auditoria'}` |
| notificaciones | `dist/servicios/notificaciones/main.js` | 3002 | idem |
| webhooks | `dist/servicios/webhooks/main.js` | 3003 | idem |

`/health` no lleva prefijo `api` (los satélites no tienen API pública) y no toca la base. Cada uno fuerza `SERVICE_ROLE` a su nombre (otro valor es un error de arranque). El núcleo es el único dueño del esquema: los satélites usan `synchronize: false`.

## Impacto en la API / contrato
Ninguno (rutas, contratos v1/v2 y esquemas de eventos intactos).

## Pasos
1. Plan (este documento).
2. `service-role.ts` + validación + limpieza en `integration-app.ts`.
3. Interruptores en suscriptores y jobs.
4. Cola por servicio en el transporte RabbitMQ.
5. Config TypeORM compartida y puntos de entrada de los satélites.
6. Pruebas unitarias e integración; lint, build y suite completa.

## Riesgos y decisiones abiertas
- Base compartida: los satélites escriben en la misma base (una por servicio queda como paso siguiente).
- Las acciones (`registrarAccion`) que ocurren en el satélite de webhooks (entregas `llamada.*`) no llegan a la traza: el sumidero vive solo en el núcleo.
- `NotificacionesModule` trae su controlador administrativo; en el satélite queda sin exponer (Kong solo enruta `/health`).
- Sin broker, un satélite no recibe nada (los eventos del núcleo se entregan en proceso al núcleo); los satélites requieren `RABBITMQ_URL`.

## Verificación
`npm run lint`, `npm run build`, specs nuevos y `npx jest --maxWorkers=4` completo (modo monolito) en verde; integración: con `SERVICE_ROLE=api` un evento no escribe auditoría/notificación/entrega/feed, con el rol por defecto sí; cada módulo satélite arranca contra la base de pruebas y procesa un evento con `bus.despachar`.
