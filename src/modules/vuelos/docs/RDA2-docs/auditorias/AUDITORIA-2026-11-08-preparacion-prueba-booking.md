# Auditoría — Preparación de la prueba de extremo a extremo con Booking — 2026-11-08

> Estado: **por transcribir**. Archivo preparado con datos de git y comprobaciones sugeridas; los hallazgos están vacíos a propósito.

- **Plan:** [`2026-11-08-preparacion-prueba-booking.md`](../../planes/2026-11-08-preparacion-prueba-booking.md) — Plan principal
- **Fecha del plan:** 2026-11-08
- **Objetivo del plan:** Cerrar lo necesario para la sesión de pruebas con Booking: política de reembolso (penalidad por configuración), campos de booking.cancelled, administración de webhooks, estado del push de stock, desglose y CSV del mostrador y runbook.
- **Commits auditados:** 2 (fecha y hora del autor en git, hora local -05:00; estadísticas de `git show --shortstat`).

  | Commit | Fecha | Asunto | Archivos | Inserciones | Borrados |
  |---|---|---|---|---|---|
  | `b737d23` | 2026-11-08 18:19 | Treat an empty documentExpiryDate as absent so passports can omit it | 4 | 37 | 2 |
  | `bb252fe` | 2026-11-08 19:22 | Prepare the end-to-end test session with Booking | 39 | 1953 | 39 |

- **Archivos principales tocados** (reales de git, agrupados; recortados si hay muchos):

- **Backend** (16): `src/modules/vuelos/dto/booking.dto.ts`, `src/modules/vuelos/common/cloud-events.ts`, `src/modules/vuelos/common/runtime-metrics.ts`, `src/modules/vuelos/ecommerce/admin/admin.module.ts`, `src/modules/vuelos/ecommerce/admin/admin.service.ts`, `src/modules/vuelos/ecommerce/admin/reservas-admin.controller.ts`, `src/modules/vuelos/ecommerce/admin/reservas-admin.dto.ts`, `src/modules/vuelos/ecommerce/admin/reservas-admin.service.ts`, `src/modules/vuelos/ecommerce/admin/webhooks-admin.controller.ts`, `src/modules/vuelos/ecommerce/admin/webhooks-admin.dto.ts`, `src/modules/vuelos/ecommerce/admin/webhooks-admin.service.ts`, `src/modules/vuelos/entities/booking.entity.ts`, `src/modules/vuelos/migrations/1794182400000-BookingRefundAmounts.ts`, `src/modules/vuelos/services/cancellation.service.ts` … y 2 más
- **Frontend** (11): `frontend/src/api/client.ts`, `frontend/src/api/endpoints/admin.ts`, `frontend/src/features/admin/AdminDashboardPage.tsx`, `frontend/src/features/admin/AdminLayout.tsx`, `frontend/src/features/admin/AdminObservabilityPage.tsx`, `frontend/src/features/admin/AdminReservationsPage.tsx`, `frontend/src/features/admin/AdminWebhooksPage.tsx`, `frontend/src/features/admin/admin-errors.ts`, `frontend/src/features/admin/reservas.ts`, `frontend/src/lib/observability.ts`, `frontend/src/routes/index.tsx`
- **Pruebas** (3): `src/modules/vuelos/testing/v2.integration.spec.ts`, `src/modules/vuelos/testing/booking-prueba.integration.spec.ts`, `src/modules/vuelos/testing/integration-app.ts`
- **Docs** (6): `deploy/azure/README.md`, `src/modules/vuelos/docs/GUIA-DEFENSA-SWAGGER.md`, `src/modules/vuelos/docs/MODELO-DE-DATOS.md`, `src/modules/vuelos/docs/RDA2-docs/GUIA-PRUEBA-BOOKING.md`, `src/modules/vuelos/docs/RDA2-docs/README.md`, `src/modules/vuelos/docs/planes/2026-11-08-preparacion-prueba-booking.md`
- **Contratos** (3): `contracts/overlay/vuelos-v2-ram-alliance.overlay.yaml`, `contracts/vuelos-openapi-v2-ram-alliance.yaml`, `contracts/vuelos-ecommerce-openapi.yaml`
- **Infraestructura y configuración** (2): `.env.example`, `deploy/azure/.env.azure.example`

- **Alcance:**
  - **Incluye:** Política de reembolso, campos de booking.cancelled, administración de webhooks, estado del push de stock, desglose/CSV del mostrador, runbook (GUIA-PRUEBA-BOOKING.md); documentExpiryDate vacío tratado como ausente (b737d23).
  - **No incluye:** Tarifas por aerolínea, stock por tarifa, facturar v2 y liquidación de Booking.
- **Método:** pendiente de transcribir. Marcas de la leyenda:
  - **[V]** releído en el código por quien audita.
  - **[E]** procede de una exploración y no se releyó.
  - **[observado]** visto al ejecutar o usar el sistema.
  - **[confirmado en producción]** comprobado contra el despliegue real.
- **No cubierto:** pruebas de penetración, carga, accesibilidad completa, configuración real de los servicios externos (Azure, Aiven, Netlify, GHCR), contenido de `.env` y `.env.azure`.
- **Por verificar** (dudas o contradicciones que los informes dejaron abiertas; no son hechos):
  - `b737d23` (documentExpiryDate vacío): el explorador no localizó el cambio en el código; git muestra que toca `src/modules/vuelos/dto/booking.dto.ts` y `v2.integration.spec.ts` (releer el diff).
  - `docs/RDA2-docs/GUIA-PRUEBA-BOOKING.md`, `v2/stock-push.service.ts` (`estado()`) y `ecommerce/admin/admin.service.ts` (`reasonCode: 'FLIGHT_CANCELLED'`) no se leyeron.
  - Los commits `b737d23`, `30ce024` y `027b470` comparten la misma hora de autor (2026-11-08 18:19, posible rebase o amend); `bb252fe` es posterior (19:22).

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

- [E] ¿Penalidad 0 para toda reembolsable, también en la web? `common/postsale-rules.ts:45-47` devuelve `total − penalidad + equipaje` y `common/vuelos-config.ts:140` tiene por defecto 10 %: el cambio depende de la variable de entorno. ¿El despliegue se dejó en 0 por error?

### 2.2 Altos

| ID | Hallazgo | Estado |
|---|---|---|
| A-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Alto**

- [E] ¿El CSV de reservas trunca a 5000 sin avisar? `ecommerce/admin/reservas-admin.service.ts:81` (`take(CSV_EXPORT_MAX)`), sin campo de truncado; el «cuadre final» del plan depende de él.
- [E] ¿Las entregas muestran `bookingId`, `pnr` y `partnerOrderId` a ADMIN sin filtrar? `ecommerce/admin/webhooks-admin.service.ts:54-80` (`referenciaDe`, línea 83). Comprobar que nunca se incluye el secreto del webhook.

### 2.3 Medios

| ID | Hallazgo | Estado |
|---|---|---|
| M-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Medio**

- [E] ¿`reintentar` (`webhooks-admin.service.ts:92-104`) no comprueba el estado PENDING antes de reiniciar? Solo bloquea DELIVERED (`:96`).
- [E] ¿El rechazo por datos inválidos no libera el hold (plan, Riesgos)? Los asientos quedan retenidos hasta el barredor de 5 min.
- [E] ¿`booking.cancelled` declara `reason` en el pick (`common/cloud-events.ts:78`) pero nadie lo rellena? Revisar el origen.

### 2.4 Bajos

| ID | Hallazgo | Estado |
|---|---|---|
| B-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Bajo**

- [E] ¿El CSV de reservas excluye nombres y documentos? El explorador vio que solo cuenta `pasajeros` (`reservas-admin.service.ts:102`); comprobar en pruebas.
- [E] ¿El estado del push de stock solo vive en memoria (plan, Riesgos)? Sin verificar en código.

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

- `src/modules/vuelos/testing/booking-prueba.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/common/postsale-rules.spec.ts`
- `src/modules/vuelos/testing/trazabilidad.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/testing/v2.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)

### 5.2 Pruebas a repetir (sugeridas)

```bash
npx jest src/modules/vuelos/common/postsale-rules.spec.ts
# requiere TEST_DATABASE_URL apuntando a una base desechable (p. ej. booking_test)
npx jest src/modules/vuelos/testing/booking-prueba.integration.spec.ts src/modules/vuelos/testing/trazabilidad.integration.spec.ts src/modules/vuelos/testing/v2.integration.spec.ts
npm run contract:events:check
npm run contract:v2:build
npm run lint
npm run build
```

_Ejecutar solo cuando se corrijan los hallazgos que se transcriban; añadir aquí una prueba por hallazgo corregido._
