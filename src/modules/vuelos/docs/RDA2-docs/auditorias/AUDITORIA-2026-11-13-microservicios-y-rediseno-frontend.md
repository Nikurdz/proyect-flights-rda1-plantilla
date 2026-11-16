# Auditoría — Un contenedor por microservicio (demo local) y rediseño del frontend con heurísticas de Nielsen — 2026-11-13

> Estado: **por transcribir**. Archivo preparado con datos de git y comprobaciones sugeridas; los hallazgos están vacíos a propósito.

- **Plan:** 
  - [`2026-11-13-contenedores-por-microservicio.md`](../../planes/2026-11-13-contenedores-por-microservicio.md) — Plan de contenedores
  - [`2026-11-13-rediseno-frontend-nielsen.md`](../../planes/2026-11-13-rediseno-frontend-nielsen.md) — Plan del rediseño del frontend
- **Fecha del plan:** 2026-11-13
- **Objetivo del plan:** Separar el núcleo y tres satélites (auditoría, notificaciones, webhooks) en contenedores propios alimentados por RabbitMQ, solo como demostración local, y rehacer el frontend con tokens de diseño, tema claro/oscuro, contraste AA y las heurísticas de Nielsen.
- **Commits auditados:** 3 (fecha y hora del autor en git, hora local -05:00; estadísticas de `git show --shortstat`).

  | Commit | Fecha | Asunto | Archivos | Inserciones | Borrados |
  |---|---|---|---|---|---|
  | `7e52601` | 2026-11-13 09:59 | Run each microservice in its own container (local/demo), production unchanged | 51 | 1462 | 28 |
  | `35b0b5c` | 2026-11-13 14:37 | Redesign the frontend: premium look, light/dark theme, simpler navigation, Nielsen heuristics | 152 | 7694 | 4937 |
  | `3c9d4b4` | 2026-11-13 14:51 | Make the admin menu groups collapsible with indented links | 2 | 103 | 26 |

- **Archivos principales tocados** (reales de git, agrupados; recortados si hay muchos):

- **Backend** (31): `src/app.module.ts`, `src/common/typeorm-config.ts`, `src/modules/vuelos/common/service-role.ts`, `src/modules/vuelos/common/vuelos-config.ts`, `src/modules/vuelos/ecommerce/integracion/salud-proveedores.service.ts`, `src/modules/vuelos/ecommerce/notificaciones/notificaciones.service.ts`, `src/modules/vuelos/ecommerce/observabilidad/auditoria-transacciones.service.ts`, `src/modules/vuelos/ecommerce/observabilidad/peticiones-http.service.ts`, `src/modules/vuelos/ecommerce/observabilidad/retencion-auditoria.service.ts`, `src/modules/vuelos/ecommerce/ofertas/ofertas.service.ts`, `src/modules/vuelos/ecommerce/ordenes/ordenes.service.ts`, `src/modules/vuelos/ecommerce/ordenes/reconciliacion.service.ts`, `src/modules/vuelos/ecommerce/pagos/pagos.service.ts`, `src/modules/vuelos/esb/rabbitmq.transport.ts` … y 17 más
- **Frontend** (118): `frontend/.dockerignore`, `frontend/.env.example`, `frontend/eslint.config.js`, `frontend/index.html`, `frontend/package-lock.json`, `frontend/package.json`, `frontend/scripts/contrast.mjs`, `frontend/src/App.tsx`, `frontend/src/components/common/Countdown.tsx`, `frontend/src/components/common/ErrorBoundary.tsx`, `frontend/src/components/common/ProblemAlert.tsx`, `frontend/src/components/common/ThemeProvider.tsx`, `frontend/src/components/common/TicketQr.tsx`, `frontend/src/components/common/WakeUpBanner.tsx` … y 104 más
- **Pruebas** (34): `src/modules/vuelos/common/service-role.spec.ts`, `src/modules/vuelos/esb/rabbitmq.transport.spec.ts`, `src/modules/vuelos/testing/integration-app.ts`, `src/modules/vuelos/testing/service-role.integration.spec.ts`, `frontend/tests/unit/admin-airports-page.test.tsx`, `frontend/tests/unit/admin-audit-page.test.tsx`, `frontend/tests/unit/admin-booking-billing-page.test.tsx`, `frontend/tests/unit/admin-flights-page.test.tsx`, `frontend/tests/unit/admin-guard.test.tsx`, `frontend/tests/unit/admin-invoices-page.test.tsx`, `frontend/tests/unit/admin-layout.test.tsx`, `frontend/tests/unit/admin-reservations-page.test.tsx`, `frontend/tests/unit/admin-users-page.test.tsx`, `frontend/tests/unit/best-value.test.ts` … y 20 más
- **Docs** (6): `CLAUDE.md`, `src/modules/vuelos/docs/RDA2-docs/CONTENEDORES-POR-MICROSERVICIO.md`, `src/modules/vuelos/docs/planes/2026-11-13-contenedores-por-microservicio.md`, `frontend/README.md`, `src/modules/vuelos/docs/RDA2-docs/HEURISTICAS-NIELSEN.md`, `src/modules/vuelos/docs/planes/2026-11-13-rediseno-frontend-nielsen.md`
- **Infraestructura y configuración** (13): `.gitignore`, `deploy/gateway/kong.microservicios.yml`, `docker-compose.microservicios.yml`, `docker/.env.microservicios.example`, `docker/auditoria/Dockerfile`, `docker/frontend/Dockerfile`, `docker/frontend/nginx.conf`, `docker/notificaciones/Dockerfile`, `docker/vuelos-api/Dockerfile`, `docker/webhooks/Dockerfile`, `package.json`, `scripts/micro-smoke.js`, `.claude/launch.json`

- **Alcance:**
  - **Incluye:** common/service-role.ts, cola por servicio en esb/rabbitmq.transport.ts, src/servicios/*, interruptores en suscriptores y jobs, Dockerfiles, docker-compose.microservicios.yml, Kong de microservicios; tokens CSS, ThemeProvider, Toast, BoardingPass, puente de estilos y menú de administración plegable (3c9d4b4, sin plan propio).
  - **No incluye:** Producción (Azure) no cambia; base de datos por servicio.
- **Método:** pendiente de transcribir. Marcas de la leyenda:
  - **[V]** releído en el código por quien audita.
  - **[E]** procede de una exploración y no se releyó.
  - **[observado]** visto al ejecutar o usar el sistema.
  - **[confirmado en producción]** comprobado contra el despliegue real.
- **No cubierto:** pruebas de penetración, carga, accesibilidad completa, configuración real de los servicios externos (Azure, Aiven, Netlify, GHCR), contenido de `.env` y `.env.azure`.
- **Por verificar** (dudas o contradicciones que los informes dejaron abiertas; no son hechos):
  - Configuración real de Azure (`SERVICE_ROLE`, `RABBITMQ_URL`): no accesible.
  - Contenido de `docker-compose.microservicios.yml`, los Dockerfiles y `kong.microservicios.yml`: no leídos por el explorador.
  - Cobertura real de los tests de frontend (por ejemplo accesibilidad de `TraceFlowGraph`): se confirmaron nombres de archivo, no el contenido.
  - El commit 35b0b5c es el mayor del rango (152 archivos): los archivos listados abajo se muestran recortados; usar `git show --stat 35b0b5c` para la lista completa.

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

- [E] Producción no debe depender de las variables del modo microservicios: `common/service-role.ts:24` (vacío = `monolith`) y `common/vuelos-config.ts:218`. ¿Azure no tiene `SERVICE_ROLE` ni `RABBITMQ_URL` definidas? El plan lo afirma; la configuración real no se consultó.

### 2.2 Altos

| ID | Hallazgo | Estado |
|---|---|---|
| A-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Alto**

- [E] Pérdida de eventos si cae el broker: `esb/rabbitmq.transport.ts:92` lanza si no hay canal y el bus entrega en proceso; con `SERVICE_ROLE=api` los satélites no reciben nada (lo admite el plan, línea 94). ¿Es aceptable en la demo?
- [E] Primer arranque sin cola: `rabbitmq.transport.ts:116-118` declara la cola del satélite solo al conectar; un evento publicado antes no tiene cola enlazada y se pierde. ¿Hay que declarar la cola en el núcleo?
- [E] Esquema: `src/servicios/comun/satelite.ts:30` usa `synchronize: false`: ¿qué pasa si un satélite arranca antes de que el núcleo migre una base nueva?

### 2.3 Medios

| ID | Hallazgo | Estado |
|---|---|---|
| M-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Medio**

- [E] `ecommerce/observabilidad/auditoria-transacciones.service.ts:33`: el sumidero de acciones solo existe en el núcleo; las entregas de webhook (`llamada.webhook`) hechas en el satélite no llegan a la traza (lo admite el plan, línea 92).
- [E] Puente de estilos: `frontend/tailwind.config.js:6-7,39,51-52,55-56` sigue activo; el explorador vio `slate-*`/`bg-white`/`brand-*` en 5 archivos de `features/admin/` (`AdminProvidersPage.tsx`, `AdminNodesHealthPage.tsx`, `LatencyChart.tsx`, `LedStatus.tsx`, `dashboard/charts.tsx`); el plan (`rediseno…:165-166`) lista 15, así que su lista está desfasada.
- [E] `frontend/scripts/contrast.mjs:26-50` no cubre `on-chrome` sobre `chrome` (texto blanco), `muted` sobre `gold-soft` ni `line`, y no está en `npm test`.
- [E] Checkout: `CheckoutPage.tsx:68-72,88-91,216-221`: volver a resultados no libera el cupo y pide «Seguir comprando». ¿Se pierde el progreso de pasajeros o de facturación? (M-4 y M-11 de AUDITORIA-2026-11-11 tratan flujos cercanos).

### 2.4 Bajos

| ID | Hallazgo | Estado |
|---|---|---|
| B-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Bajo**

- [E] `testing/stock-grpc.integration.spec.ts:20-24,69-71,93,97`: espera activa de 60 s con `sync()` en vez de `flush()` (lo señala AUDITORIA-2026-11-11, M-9).
- [E] `frontend/src/routes/index.tsx:90`: la pantalla de proveedores redirige pero el backend sigue activo. ¿Hay enlaces de navegación que lleven a la ruta antigua?

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

- `src/modules/vuelos/common/service-role.spec.ts`
- `src/modules/vuelos/esb/rabbitmq.transport.spec.ts`
- `src/modules/vuelos/testing/service-role.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/testing/stock-grpc.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `frontend/tests/unit/problem-alert.test.tsx`
- `frontend/tests/unit/countdown.test.tsx`
- `frontend/tests/unit/toast.test.tsx`
- `frontend/tests/unit/theme.test.tsx`
- `frontend/tests/unit/tabs.test.tsx`
- `frontend/tests/unit/stepper.test.tsx`
- `frontend/tests/unit/confirm-dialog.test.tsx`
- `frontend/tests/unit/boarding-pass.test.tsx`
- `frontend/tests/unit/dialog.test.tsx`
- `frontend/tests/unit/admin-layout.test.tsx`

_Sin cobertura automática:_ `frontend/scripts/contrast.mjs` no tiene spec ni forma parte de `npm test`: es un script que sale con 1 si falla.

### 5.2 Pruebas a repetir (sugeridas)

```bash
npx jest src/modules/vuelos/common/service-role.spec.ts src/modules/vuelos/esb/rabbitmq.transport.spec.ts
# requiere TEST_DATABASE_URL apuntando a una base desechable (p. ej. booking_test)
npx jest src/modules/vuelos/testing/service-role.integration.spec.ts src/modules/vuelos/testing/stock-grpc.integration.spec.ts
cd frontend && npx vitest run tests/unit/problem-alert.test.tsx tests/unit/countdown.test.tsx tests/unit/toast.test.tsx tests/unit/theme.test.tsx tests/unit/tabs.test.tsx tests/unit/stepper.test.tsx tests/unit/confirm-dialog.test.tsx tests/unit/boarding-pass.test.tsx tests/unit/dialog.test.tsx tests/unit/admin-layout.test.tsx
npm run micro:build && npm run micro:up && npm run micro:smoke
node frontend/scripts/contrast.mjs
cd frontend && npm run lint && npm run build && npm test
npm run lint
npm run build
```

_Ejecutar solo cuando se corrijan los hallazgos que se transcriban; añadir aquí una prueba por hallazgo corregido._
