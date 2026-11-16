# Auditoría — Ahorro de cómputo de la base de datos y traslado a Aiven — 2026-10-26

> Estado: **por transcribir**. Archivo preparado con datos de git y comprobaciones sugeridas; los hallazgos están vacíos a propósito.

- **Plan:** [`2026-10-26-ahorro-computo-bd.md`](../../planes/2026-10-26-ahorro-computo-bd.md) — Plan principal
- **Fecha del plan:** 2026-10-26
- **Objetivo del plan:** Que la API vuelva a funcionar sin pagar tras agotar el cupo de Neon y que no consuma cómputo de base de datos cuando nadie la usa (puerta de actividad, /health/live, pool y TLS con CA para Aiven).
- **Commits auditados:** 4 (fecha y hora del autor en git, hora local -05:00; estadísticas de `git show --shortstat`).

  | Commit | Fecha | Asunto | Archivos | Inserciones | Borrados |
  |---|---|---|---|---|---|
  | `05da7f0` | 2026-10-26 09:17 | Fix production build layout and migration guard; add deployment runbook | 3 | 40 | 3 |
  | `8525c80` | 2026-10-26 09:33 | Stop background jobs from keeping a serverless database awake; add /health/live | 18 | 201 | 6 |
  | `34d93f4` | 2026-10-26 17:42 | Use a configured CA for the database TLS connection (Aiven) | 7 | 39 | 3 |
  | `740697e` | 2026-10-26 17:54 | Drop sslmode from the database URL when a CA is configured | 5 | 29 | 7 |

  Estos cuatro commits son del 2026-10-26 por la mañana/tarde y quedan antes de 704956f en la historia; se agrupan aquí por el plan ahorro-computo-bd.

- **Archivos principales tocados** (reales de git, agrupados; recortados si hay muchos):

- **Backend** (14): `src/modules/vuelos/migrations/1792970623866-NormalizeSchema.ts`, `src/app.module.ts`, `src/modules/vuelos/common/activity-gate.ts`, `src/modules/vuelos/common/correlation.ts`, `src/modules/vuelos/common/domain-event-bus.ts`, `src/modules/vuelos/ecommerce/admin/observabilidad.controller.ts`, `src/modules/vuelos/ecommerce/integracion/salud-proveedores.service.ts`, `src/modules/vuelos/ecommerce/observabilidad/peticiones-http.service.ts`, `src/modules/vuelos/ecommerce/ordenes/reconciliacion.service.ts`, `src/modules/vuelos/services/holds-sweeper.service.ts`, `src/modules/vuelos/services/webhook-dispatcher.service.ts`, `src/modules/vuelos/common/db-ssl.ts`, `src/modules/vuelos/migrations/data-source.ts`, `src/modules/vuelos/seed/seed.ts`
- **Pruebas** (3): `src/modules/vuelos/common/activity-gate.spec.ts`, `src/modules/vuelos/testing/integracion.integration.spec.ts`, `src/modules/vuelos/common/db-ssl.spec.ts`
- **Docs** (3): `src/modules/vuelos/docs/DESPLIEGUE-NORMALIZACION.md`, `CLAUDE.md`, `src/modules/vuelos/docs/planes/2026-10-26-ahorro-computo-bd.md`
- **Contratos** (1): `contracts/vuelos-ecommerce-openapi.yaml`
- **Infraestructura y configuración** (3): `tsconfig.json`, `.env.example`, `render.yaml`

- **Alcance:**
  - **Incluye:** Puerta de actividad para las tareas de fondo, ruta de salud sin base de datos, pool y TLS configurables, guía de despliegue para Aiven.
  - **No incluye:** Crear cuentas ni tocar Railway, Netlify o Neon (los hace el usuario).
- **Método:** pendiente de transcribir. Marcas de la leyenda:
  - **[V]** releído en el código por quien audita.
  - **[E]** procede de una exploración y no se releyó.
  - **[observado]** visto al ejecutar o usar el sistema.
  - **[confirmado en producción]** comprobado contra el despliegue real.
- **No cubierto:** pruebas de penetración, carga, accesibilidad completa, configuración real de los servicios externos (Azure, Aiven, Netlify, GHCR), contenido de `.env` y `.env.azure`.
- **Por verificar** (dudas o contradicciones que los informes dejaron abiertas; no son hechos):
  - Estado real de Aiven y de la CA configurada en producción (fuera del repositorio).
  - Medición real de actividad en la base con la puerta inactiva (el plan cita 45 s sin transacciones; no repetida).

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

- [E] ¿La conexión a la base puede ir sin TLS en producción? `common/typeorm-config.ts:23` deja `ssl` en `undefined` si no hay `DB_SSL_CA` y `common/db-ssl.ts:14` solo fija TLS con CA; no se encontró en `common/vuelos-config.ts` ninguna comprobación de `DB_SSL_CA` ni de `sslmode` en producción.

### 2.2 Altos

| ID | Hallazgo | Estado |
|---|---|---|
| A-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Alto**

- [E] ¿Las autorizaciones pendientes se capturan o anulan a tiempo si la app duerme? `ecommerce/ordenes/reconciliacion.service.ts:41` solo reconcilia con `activityGate.isActive()`: `CAPTURA_PENDIENTE` y `ANULACION_PENDIENTE` esperan a la siguiente visita.
- [E] ¿Los holds vencidos se liberan a tiempo? `services/holds-sweeper.service.ts:39` no barre mientras duerme (disponibilidad subreportada).

### 2.3 Medios

| ID | Hallazgo | Estado |
|---|---|---|
| M-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Medio**

- [E] `GET /api/v1/health` (con base de datos) es público: `ecommerce/admin/observabilidad.controller.ts:69-73` consulta la base y `common/activity-gate.ts:32` no lo cuenta como uso. ¿Cualquiera puede despertar la base (coste)?
- [E] `ecommerce/common/global-rate-limit.middleware.ts:8`: `EXEMPT_PATHS` solo tiene `/api/v1/health` y `/api/v2/vuelos/health`. ¿Las sondas de `deploy/azure/generar-app.js:87-88` (`/api/v1/health/live`) cuentan contra las 300/min por IP?
- [E] `common/typeorm-config.ts:18`: `synchronize` depende de `NODE_ENV`; si falta, se activa. En Azure `deploy/azure/generar-app.js:28` fija `NODE_ENV=production`. ¿Algún otro despliegue lo omite?

### 2.4 Bajos

| ID | Hallazgo | Estado |
|---|---|---|
| B-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Bajo**

- [E] `common/activity-gate.ts:12`: el arranque cuenta como uso, así que cada reinicio despierta la base.
- [E] `common/activity-gate.ts:32`: `/\/health(\/|$)/` trata como sonda cualquier ruta con un segmento `health`. ¿Alguna ruta de negocio lo tiene?
- [E] `common/typeorm-config.ts:20`: pool por defecto de 5 frente a las 20 conexiones de Aiven.

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

- `src/modules/vuelos/common/activity-gate.spec.ts`
- `src/modules/vuelos/common/db-ssl.spec.ts`
- `src/modules/vuelos/testing/integracion.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/ecommerce/common/global-rate-limit.middleware.spec.ts`

### 5.2 Pruebas a repetir (sugeridas)

```bash
npx jest src/modules/vuelos/common/activity-gate.spec.ts src/modules/vuelos/common/db-ssl.spec.ts src/modules/vuelos/ecommerce/common/global-rate-limit.middleware.spec.ts
# requiere TEST_DATABASE_URL apuntando a una base desechable (p. ej. booking_test)
npx jest src/modules/vuelos/testing/integracion.integration.spec.ts
npm run migration:check:vuelos  (después de migrar contra una base de prueba)
npm run lint
npm run build
```

_Ejecutar solo cuando se corrijan los hallazgos que se transcriban; añadir aquí una prueba por hallazgo corregido._
