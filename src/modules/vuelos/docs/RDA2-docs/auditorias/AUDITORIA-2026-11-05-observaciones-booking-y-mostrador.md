# Auditoría — Observaciones de Booking (plan de pruebas del 04-nov) y mostrador del back office — 2026-11-05

> Estado: **por transcribir**. Archivo preparado con datos de git y comprobaciones sugeridas; los hallazgos están vacíos a propósito.

- **Plan:** 
  - [`2026-11-05-observaciones-booking.md`](../../planes/2026-11-05-observaciones-booking.md) — Plan principal
  - [`2026-11-05-mostrador-ui.md`](../../planes/2026-11-05-mostrador-ui.md) — Plan menor fusionado (diseño de pantallas)
  - [`2026-11-05-mostrador-frontend.md`](../../planes/2026-11-05-mostrador-frontend.md) — Plan menor fusionado (frontend)
- **Fecha del plan:** 2026-11-05
- **Objetivo del plan:** Atender las observaciones y el plan de pruebas de Booking (A-01…A-16, P-01…P-08): desglose de precio, cursor del feed, partnerOrderId, 404 de reserva ajena, webhooks del socio, cédula, pasajero único por índice ciego, API y pantallas del mostrador y estado del vuelo.
- **Commits auditados:** 3 (fecha y hora del autor en git, hora local -05:00; estadísticas de `git show --shortstat`).

  | Commit | Fecha | Asunto | Archivos | Inserciones | Borrados |
  |---|---|---|---|---|---|
  | `22ee288` | 2026-11-05 22:05 | Address Booking's test-plan observations | 52 | 1780 | 64 |
  | `41ce5c1` | 2026-11-05 22:23 | Backfill travellers in set-based statements | 1 | 19 | 7 |
  | `a5bee7f` | 2026-11-05 22:43 | Add the counter screens (reservations, flight status) and show the flight state | 17 | 1203 | 9 |

- **Archivos principales tocados** (reales de git, agrupados; recortados si hay muchos):

- **Backend** (33): `src/modules/vuelos/common/business-rules.ts`, `src/modules/vuelos/common/cifrado.ts`, `src/modules/vuelos/common/money.util.ts`, `src/modules/vuelos/common/travellers.ts`, `src/modules/vuelos/dto/booking.dto.ts`, `src/modules/vuelos/ecommerce/admin/admin.module.ts`, `src/modules/vuelos/ecommerce/admin/reservas-admin.controller.ts`, `src/modules/vuelos/ecommerce/admin/reservas-admin.dto.ts`, `src/modules/vuelos/ecommerce/admin/reservas-admin.service.ts`, `src/modules/vuelos/ecommerce/ofertas/ofertas.service.ts`, `src/modules/vuelos/entities/booking.entity.ts`, `src/modules/vuelos/entities/passenger.entity.ts`, `src/modules/vuelos/entities/traveller.entity.ts`, `src/modules/vuelos/migrations/1793932853618-PassengerTravellers.ts` … y 19 más
- **Frontend** (10): `frontend/src/api/endpoints/admin.ts`, `frontend/src/api/schema.d.ts`, `frontend/src/features/admin/AdminFlightDialogs.tsx`, `frontend/src/features/admin/AdminFlightsPage.tsx`, `frontend/src/features/admin/AdminLayout.tsx`, `frontend/src/features/admin/AdminReservationsPage.tsx`, `frontend/src/features/admin/admin-errors.ts`, `frontend/src/features/admin/admin-schemas.ts`, `frontend/src/features/admin/reservas.ts`, `frontend/src/routes/index.tsx`
- **Pruebas** (8): `src/modules/vuelos/common/business-rules.spec.ts`, `src/modules/vuelos/services/bookings.service.spec.ts`, `src/modules/vuelos/testing/admin-reservas.integration.spec.ts`, `src/modules/vuelos/testing/booking-plan.integration.spec.ts`, `src/modules/vuelos/testing/v2.integration.spec.ts`, `src/modules/vuelos/testing/vuelos.integration.spec.ts`, `frontend/tests/unit/admin-reservations-page.test.tsx`, `frontend/tests/unit/reservas.test.ts`
- **Docs** (5): `CLAUDE.md`, `src/modules/vuelos/docs/MODELO-DE-DATOS.md`, `src/modules/vuelos/docs/planes/2026-11-05-mostrador-frontend.md`, `src/modules/vuelos/docs/planes/2026-11-05-observaciones-booking.md`, `src/modules/vuelos/docs/planes/2026-11-05-mostrador-ui.md`
- **Contratos** (10): `contracts/eventos/booking.baggage_added.v1.schema.json`, `contracts/eventos/booking.cancelled.v1.schema.json`, `contracts/eventos/booking.changed.v1.schema.json`, `contracts/eventos/booking.checked_in.v1.schema.json`, `contracts/eventos/booking.confirmed.v1.schema.json`, `contracts/eventos/booking.ticket_issued.v1.schema.json`, `contracts/eventos/booking.ticket_issuing.v1.schema.json`, `contracts/overlay/vuelos-v2-ram-alliance.overlay.yaml`, `contracts/vuelos-ecommerce-openapi.yaml`, `contracts/vuelos-openapi-v2-ram-alliance.yaml`
- **Infraestructura y configuración** (2): `.env.example`, `scripts/export-modelo-datos.ts`

- **Alcance:**
  - **Incluye:** Backend, base de datos (migración PassengerTravellers) y contrato v2; suite propia A-01…A-16; pantallas del mostrador (reservas y estado de vuelo).
  - **No incluye:** Diagnóstico en producción de los webhooks (requiere autorización para consultar la base de Aiven).
- **Método:** pendiente de transcribir. Marcas de la leyenda:
  - **[V]** releído en el código por quien audita.
  - **[E]** procede de una exploración y no se releyó.
  - **[observado]** visto al ejecutar o usar el sistema.
  - **[confirmado en producción]** comprobado contra el despliegue real.
- **No cubierto:** pruebas de penetración, carga, accesibilidad completa, configuración real de los servicios externos (Azure, Aiven, Netlify, GHCR), contenido de `.env` y `.env.azure`.
- **Por verificar** (dudas o contradicciones que los informes dejaron abiertas; no son hechos):
  - Que la migración PassengerTravellers se probó con datos del esquema anterior (el plan lo declara; el commit 41ce5c1 la reescribió después en sentencias por conjuntos).
  - Diagnóstico de webhooks en producción (excluido del plan).

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

- [E] ¿`asAdmin` salta el ownership sin comprobar rol? `services/booking-context.service.ts:45` solo mira `!options.asAdmin`; la barrera es `RolesGuard` del controlador (`ecommerce/admin/reservas-admin.controller.ts:19-21`). ¿Un llamador nuevo con `asAdmin: true` evitaría la propiedad?
- [E] ¿`ownedBy` con LIKE sin escapar? `services/webhooks.service.ts:119-120` usa `Like` con el patrón cuenta + «:%» sin escapar: un clientId con `_` o `%` podría casar suscripciones de otro socio.
- [E] ¿La migración carga todos los pasajeros de una vez? `migrations/1793932853618-PassengerTravellers.ts:55-58` no tiene LIMIT (sí hay CHUNK de 2000 en `:67`). Riesgo en Aiven con muchas filas.

### 2.2 Altos

| ID | Hallazgo | Estado |
|---|---|---|
| A-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Alto**

- [E] ¿Qué pasa si `decrypt` falla en la migración? `PassengerTravellers.ts:23-30` y `:85` (`SET NOT NULL`): un fallo aborta la migración a medio camino.
- [E] ¿El check-in del mostrador no tiene `Idempotency-Key`? `reservas-admin.controller.ts:60` no lleva `IdempotencyKeyGuard`; la cancelación sí (`:79`).

### 2.3 Medios

| ID | Hallazgo | Estado |
|---|---|---|
| M-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Medio**

- [E] ¿`GET /admin/reservas/export.csv` trunca en silencio a 5000? `reservas-admin.service.ts:81` (`CSV_EXPORT_MAX`) sin aviso en la cabecera (`:83`).
- [E] ¿Reintentar una entrega (`ecommerce/admin/webhooks-admin.service.ts:92-104`) reenvía eventos de reservas ya canceladas?
- [E] ¿Un pasaporte con nacionalidad EC pasa por la regla de cédula? `common/business-rules.ts:252-254` solo aplica a NATIONAL_ID con EC.

### 2.4 Bajos

| ID | Hallazgo | Estado |
|---|---|---|
| B-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Bajo**

- [E] Las respuestas 200 de `/admin/reservas` no tienen esquema en el OpenAPI (plan 2026-11-05-mostrador-frontend, sección Contexto).
- [E] Filtros «Creadas desde/hasta» en día UTC mientras la pantalla usa hora de Ecuador (plan 2026-11-08-hora-ecuador, Decisiones; coincide con M-2 de AUDITORIA-2026-11-11).

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

- `src/modules/vuelos/testing/booking-plan.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/testing/admin-reservas.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/common/business-rules.spec.ts`
- `src/modules/vuelos/testing/contract-v2.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/testing/contract-v2-build.spec.ts`
- `src/modules/vuelos/common/event-schemas.spec.ts`
- `frontend/tests/unit/admin-reservations-page.test.tsx`
- `frontend/tests/unit/reservas.test.ts`

### 5.2 Pruebas a repetir (sugeridas)

```bash
npx jest src/modules/vuelos/common/business-rules.spec.ts src/modules/vuelos/testing/contract-v2-build.spec.ts src/modules/vuelos/common/event-schemas.spec.ts
# requiere TEST_DATABASE_URL apuntando a una base desechable (p. ej. booking_test)
npx jest src/modules/vuelos/testing/booking-plan.integration.spec.ts src/modules/vuelos/testing/admin-reservas.integration.spec.ts src/modules/vuelos/testing/contract-v2.integration.spec.ts
cd frontend && npx vitest run tests/unit/admin-reservations-page.test.tsx tests/unit/reservas.test.ts
npm run migration:check:vuelos
npm run contract:events:check
npm run lint
npm run build
```

_Ejecutar solo cuando se corrijan los hallazgos que se transcriban; añadir aquí una prueba por hallazgo corregido._
