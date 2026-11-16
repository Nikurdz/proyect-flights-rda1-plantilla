# Auditoría — Aeropuertos de Ecuador (Loja) y hora de Ecuador (UTC-5) — 2026-11-08

> Estado: **por transcribir**. Archivo preparado con datos de git y comprobaciones sugeridas; los hallazgos están vacíos a propósito.

- **Plan:** 
  - [`2026-11-08-aeropuertos-ecuador.md`](../../planes/2026-11-08-aeropuertos-ecuador.md) — Plan principal (backend)
  - [`2026-11-08-hora-ecuador.md`](../../planes/2026-11-08-hora-ecuador.md) — Plan de la hora de Ecuador
  - [`2026-11-08-aeropuertos-ui.md`](../../planes/2026-11-08-aeropuertos-ui.md) — Plan menor fusionado (diseño de pantallas)
  - [`2026-11-08-aeropuertos-frontend.md`](../../planes/2026-11-08-aeropuertos-frontend.md) — Plan menor fusionado (frontend)
- **Fecha del plan:** 2026-11-08
- **Objetivo del plan:** Cargar todos los aeropuertos de Ecuador con código IATA (incluido Loja), permitir al administrador crear códigos con confirmación y mostrar y leer las horas del web y del back office en hora de Ecuador (UTC-5).
- **Commits auditados:** 2 (fecha y hora del autor en git, hora local -05:00; estadísticas de `git show --shortstat`).

  | Commit | Fecha | Asunto | Archivos | Inserciones | Borrados |
  |---|---|---|---|---|---|
  | `90f98f9` | 2026-11-08 19:27 | Add Ecuador's airports (Loja) and admin creation of airport codes | 23 | 1296 | 9 |
  | `a952ac7` | 2026-11-08 19:51 | Show and read all times in Ecuador time (UTC-5) | 33 | 300 | 140 |

- **Archivos principales tocados** (reales de git, agrupados; recortados si hay muchos):

- **Backend** (13): `src/modules/vuelos/ecommerce/admin/admin-aeropuertos.dto.ts`, `src/modules/vuelos/ecommerce/admin/admin.module.ts`, `src/modules/vuelos/ecommerce/admin/aeropuertos-admin.controller.ts`, `src/modules/vuelos/ecommerce/admin/aeropuertos-admin.service.ts`, `src/modules/vuelos/ecommerce/catalogo/catalogo.service.ts`, `src/modules/vuelos/ecommerce/seed/ecommerce.seed.ts`, `src/modules/vuelos/seed/flights.seed.ts`, `src/modules/vuelos/common/date.util.ts`, `src/modules/vuelos/ecommerce/admin/admin.service.ts`, `src/modules/vuelos/ecommerce/notificaciones/notificaciones.service.ts`, `src/modules/vuelos/gateway/gateway.service.ts`, `src/modules/vuelos/services/search.service.ts`, `src/modules/vuelos/vuelos.controller.ts`
- **Frontend** (23): `frontend/src/api/endpoints/admin.ts`, `frontend/src/api/endpoints/catalog.ts`, `frontend/src/features/admin/AdminAirportsPage.tsx`, `frontend/src/features/admin/AdminLayout.tsx`, `frontend/src/features/admin/admin-errors.ts`, `frontend/src/features/admin/admin-schemas.ts`, `frontend/src/lib/airports.ts`, `frontend/src/routes/index.tsx`, `frontend/src/features/admin/AdminAuditPage.tsx`, `frontend/src/features/admin/AdminFlightDialogs.tsx`, `frontend/src/features/admin/AdminFlightsPage.tsx`, `frontend/src/features/admin/AdminInvoicesPage.tsx`, `frontend/src/features/admin/AdminOrdersPage.tsx`, `frontend/src/features/admin/AdminProvidersPage.tsx` … y 9 más
- **Pruebas** (9): `frontend/tests/unit/admin-airports-page.test.tsx`, `frontend/tests/unit/airports-timezones.test.ts`, `src/modules/vuelos/testing/admin-aeropuertos.integration.spec.ts`, `frontend/tests/unit/admin-schemas.test.ts`, `frontend/tests/unit/dates.test.ts`, `frontend/tests/unit/labels.test.ts`, `frontend/tests/unit/reservas.test.ts`, `src/modules/vuelos/common/date.util.spec.ts`, `src/modules/vuelos/testing/ecuador-time.integration.spec.ts`
- **Docs** (5): `CLAUDE.md`, `src/modules/vuelos/docs/planes/2026-11-08-aeropuertos-ecuador.md`, `src/modules/vuelos/docs/planes/2026-11-08-aeropuertos-frontend.md`, `src/modules/vuelos/docs/planes/2026-11-08-aeropuertos-ui.md`, `src/modules/vuelos/docs/planes/2026-11-08-hora-ecuador.md`
- **Contratos** (1): `contracts/vuelos-ecommerce-openapi.yaml`

- **Alcance:**
  - **Incluye:** Seed de aeropuertos y rutas UIO/GYE–LOH, API y pantalla de alta, zonas horarias, días de Ecuador en la búsqueda v1, formato de fechas en el frontend.
  - **No incluye:** Editar o borrar aeropuertos, horarios reales, horario de verano.
- **Método:** pendiente de transcribir. Marcas de la leyenda:
  - **[V]** releído en el código por quien audita.
  - **[E]** procede de una exploración y no se releyó.
  - **[observado]** visto al ejecutar o usar el sistema.
  - **[confirmado en producción]** comprobado contra el despliegue real.
- **No cubierto:** pruebas de penetración, carga, accesibilidad completa, configuración real de los servicios externos (Azure, Aiven, Netlify, GHCR), contenido de `.env` y `.env.azure`.
- **Por verificar** (dudas o contradicciones que los informes dejaron abiertas; no son hechos):
  - `frontend/src/lib/airports.ts` y `services/search.service.ts` no se leyeron (el segundo confirma o descarta el riesgo de Galápagos).
  - Accesibilidad de las pantallas admin (confirmaciones, estados vacíos, contraste): no revisada.

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

- [E] ¿La búsqueda v1 usa el día de Ecuador (UTC-5) también para Galápagos (UTC-6)? `common/date.util.ts:34-37` solo aplica `ECUADOR_UTC_OFFSET_HOURS = -5`; un GPS a las 23:30 locales son las 05:30 UTC del día siguiente. Comprobar `services/search.service.ts` (no leído).

### 2.2 Altos

| ID | Hallazgo | Estado |
|---|---|---|
| A-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Alto**

- [E] ¿`MCH` y `PVO`, marcados «(cerrado)», son seleccionables como origen o destino? `ecommerce/seed/ecommerce.seed.ts:71` y `:73`; el nombre no los bloquea.
- [E] ¿Los vuelos nuevos LA2470/LA2480 entran al stock enviado a Booking? `seed/flights.seed.ts:126,139` y plan (Riesgos): si Booking no conoce el `item_id`, se reintenta cada ronda.

### 2.3 Medios

| ID | Hallazgo | Estado |
|---|---|---|
| M-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Medio**

- [E] ¿El alta valida que la zona coincida con el país? `ecommerce/admin/aeropuertos-admin.service.ts:59-62` valida solo que sea IANA; `paisNombre` es texto libre.
- [E] ¿Las «Creadas desde/hasta» de Reservas en día UTC confunden al administrador? (plan hora-ecuador, Decisiones; relacionado con M-2 de AUDITORIA-2026-11-11).

### 2.4 Bajos

| ID | Hallazgo | Estado |
|---|---|---|
| B-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Bajo**

- [E] ¿La carrera entre dos altas del mismo código está cubierta? `aeropuertos-admin.service.ts:74` (`existsBy`) y `:91` (23505 → 409).
- [E] ¿El desplegable de «Crear vuelo» sin buscador funciona con 200 aeropuertos? (plan aeropuertos-frontend, Catálogo público).

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

- `src/modules/vuelos/testing/admin-aeropuertos.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/testing/ecuador-time.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/common/date.util.spec.ts`
- `src/modules/vuelos/common/zoned-time.spec.ts`
- `src/modules/vuelos/seed/flights.seed.spec.ts`
- `frontend/tests/unit/admin-airports-page.test.tsx`
- `frontend/tests/unit/airports-timezones.test.ts`
- `frontend/tests/unit/airport-picker.test.tsx`

### 5.2 Pruebas a repetir (sugeridas)

```bash
npx jest src/modules/vuelos/common/date.util.spec.ts src/modules/vuelos/common/zoned-time.spec.ts src/modules/vuelos/seed/flights.seed.spec.ts
# requiere TEST_DATABASE_URL apuntando a una base desechable (p. ej. booking_test)
npx jest src/modules/vuelos/testing/admin-aeropuertos.integration.spec.ts src/modules/vuelos/testing/ecuador-time.integration.spec.ts
cd frontend && npx vitest run tests/unit/admin-airports-page.test.tsx tests/unit/airports-timezones.test.ts tests/unit/airport-picker.test.tsx
npm run seed:vuelos  (contra una base de prueba; debe ser idempotente)
npm run lint
npm run build
```

_Ejecutar solo cuando se corrijan los hallazgos que se transcriban; añadir aquí una prueba por hallazgo corregido._
