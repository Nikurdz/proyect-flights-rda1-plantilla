# Auditoría — Trazabilidad unificada (backend y frontend) y respuestas a Booking sobre asientos y cotización — 2026-11-09

> Estado: **por transcribir**. Archivo preparado con datos de git y comprobaciones sugeridas; los hallazgos están vacíos a propósito.

- **Plan:** [`2026-11-09-trazabilidad-frontend.md`](../../planes/2026-11-09-trazabilidad-frontend.md) — Plan de la pantalla de trazabilidad (única documentación de plan del bloque)
  - _Nota:_ No existe un plan de backend de trazabilidad en docs/planes/: el plan enlazado es el del frontend. Las respuestas a Booking (SEAT_TAKEN, cotización) viajan en el mismo commit 3c8f85c sin plan propio.
- **Fecha del plan:** 2026-11-09
- **Objetivo del plan:** Dar al administrador una línea de tiempo única (eventos, sagas y cambios administrativos) con diagrama de flujo y mapa de componentes, corregir las respuestas de asiento y de cotización pedidas por Booking y ocultar las pantallas de proveedores y salud de nodos.
- **Commits auditados:** 2 (fecha y hora del autor en git, hora local -05:00; estadísticas de `git show --shortstat`).

  | Commit | Fecha | Asunto | Archivos | Inserciones | Borrados |
  |---|---|---|---|---|---|
  | `3c8f85c` | 2026-11-09 08:58 | Add unified traceability with component flow graph and fix Booking seat/quote answers | 45 | 2826 | 368 |
  | `1a1a2e6` | 2026-11-09 09:12 | Hide the Providers and Node health screens from the admin panel | 4 | 7 | 74 |

- **Archivos principales tocados** (reales de git, agrupados; recortados si hay muchos):

- **Backend** (29): `src/modules/vuelos/common/correlation.ts`, `src/modules/vuelos/common/db-errors.ts`, `src/modules/vuelos/common/domain-event-bus.ts`, `src/modules/vuelos/common/problem-details.exception.ts`, `src/modules/vuelos/common/topologia.ts`, `src/modules/vuelos/common/traza-acciones.ts`, `src/modules/vuelos/ecommerce/admin/admin.module.ts`, `src/modules/vuelos/ecommerce/admin/trazabilidad.controller.ts`, `src/modules/vuelos/ecommerce/admin/trazabilidad.dto.ts`, `src/modules/vuelos/ecommerce/admin/trazabilidad.service.ts`, `src/modules/vuelos/ecommerce/identidad/identidad.service.ts`, `src/modules/vuelos/ecommerce/mercados/entities/auditoria-cambio.entity.ts`, `src/modules/vuelos/ecommerce/observabilidad/auditoria-cambio.subscriber.ts`, `src/modules/vuelos/ecommerce/observabilidad/auditoria-transacciones.service.ts` … y 15 más
- **Frontend** (10): `frontend/src/api/endpoints/auditoria.ts`, `frontend/src/api/endpoints/trazabilidad.ts`, `frontend/src/features/admin/AdminAuditPage.tsx`, `frontend/src/features/admin/TraceEstadoBadge.tsx`, `frontend/src/features/admin/TraceFlowGraph.tsx`, `frontend/src/lib/trace-layout.ts`, `frontend/src/lib/trazabilidad.ts`, `frontend/src/features/admin/AdminDashboardPage.tsx`, `frontend/src/features/admin/AdminLayout.tsx`, `frontend/src/routes/index.tsx`
- **Pruebas** (5): `frontend/tests/unit/admin-audit-page.test.tsx`, `src/modules/vuelos/common/db-errors.spec.ts`, `src/modules/vuelos/common/topologia.spec.ts`, `src/modules/vuelos/testing/trazabilidad.integration.spec.ts`, `frontend/tests/unit/admin-nodes-health.test.tsx`
- **Docs** (3): `CLAUDE.md`, `frontend/README.md`, `src/modules/vuelos/docs/planes/2026-11-09-trazabilidad-frontend.md`
- **Contratos** (1): `contracts/vuelos-ecommerce-openapi.yaml`
- **Infraestructura y configuración** (1): `.env.example`

- **Alcance:**
  - **Incluye:** Endpoints /admin/trazabilidad*, página AdminAuditPage con grafo SVG, topologia.ts, ocultar Proveedores y Salud de nodos; (commit 3c8f85c) SEAT_TAKEN y cotización de cancelación.
  - **No incluye:** La cotización de cancelación y SEAT_TAKEN/seatmap no tienen plan propio en docs/planes/ (según el explorador).
- **Método:** pendiente de transcribir. Marcas de la leyenda:
  - **[V]** releído en el código por quien audita.
  - **[E]** procede de una exploración y no se releyó.
  - **[observado]** visto al ejecutar o usar el sistema.
  - **[confirmado en producción]** comprobado contra el despliegue real.
- **No cubierto:** pruebas de penetración, carga, accesibilidad completa, configuración real de los servicios externos (Azure, Aiven, Netlify, GHCR), contenido de `.env` y `.env.azure`.
- **Por verificar** (dudas o contradicciones que los informes dejaron abiertas; no son hechos):
  - Asunto, estadísticas y archivos de 3c8f85c vienen de git (ver tabla); el alcance «respuestas a Booking» se infiere del asunto del commit, no de un plan.
  - Si los enlaces de navegación apuntan aún a la ruta antigua de Proveedores (`frontend/src/routes/index.tsx:90` solo la redirige) mientras el backend sigue activo.

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

- [E] ¿Puede alguien que no sea ADMIN llegar a `/admin/trazabilidad` o a `/export.csv`? `ecommerce/admin/trazabilidad.controller.ts:14-15` declara el guard: ¿la ruta de CSV hereda el decorador de la clase?
- [E] ¿Un token de partner (`PartnerAuthGuard`) llega a `auditoria_transacciones` por algún camino? `ecommerce/observabilidad/auditoria-transacciones.service.ts:79-108` escribe `accion.actor ?? currentActor()` sin filtro.

### 2.2 Altos

| ID | Hallazgo | Estado |
|---|---|---|
| A-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Alto**

- [E] ¿Se guarda la IP y el user agent de quien cambia datos (`ecommerce/observabilidad/auditoria-cambio.subscriber.ts:27-28`) durante 180 días (`retencion-auditoria.service.ts:14,47`)? Es dato personal: ¿hay base para conservarlo?
- [E] `oauth2.token_fallido` guarda `agregadoId: clientId.slice(0, 60)` tomado del llamante sin validar (`v2/auth/partner-auth.service.ts:53`): ¿es texto arbitrario en la traza?

### 2.3 Medios

| ID | Hallazgo | Estado |
|---|---|---|
| M-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Medio**

- [E] Cursor `antes` con comparación estricta `<` (`ecommerce/admin/trazabilidad.service.ts:160`) y `siguiente` = `en` de la última fila (`:68`): ¿se pierden filas con la misma marca de tiempo entre páginas?
- [E] `correlacionesDe` limita a 50 correlaciones (`trazabilidad.service.ts:153`) sin indicar que se cortó: ¿un PNR con más de 50 peticiones muestra una historia incompleta sin aviso?
- [E] `estado` se deduce de `resumen.startsWith('estado=ERROR')` (`trazabilidad.service.ts:184`): ¿un evento que cambie ese texto cambia de color sin aviso?

### 2.4 Bajos

| ID | Hallazgo | Estado |
|---|---|---|
| B-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Bajo**

- [E] `TraceFlowGraph.tsx`: ¿el grafo tiene `tabIndex` y `aria-label` en las flechas, como pide el plan? (no verificado línea a línea).
- [E] `AdminAuditPage` usa `useFlujoTraza` y `useMapaTraza` con `refetchInterval` (`frontend/src/api/endpoints/trazabilidad.ts:126-127,138-139`): ¿el sondeo se detiene con la pestaña oculta, como pide el plan?
- [E] `csvField` (`reservas-admin.service.ts:42-46`) ya neutraliza fórmulas en CSV (`=+-@`): confirmar que el CSV de trazabilidad hace lo mismo.

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

- `src/modules/vuelos/testing/trazabilidad.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/common/topologia.spec.ts`
- `src/modules/vuelos/common/db-errors.spec.ts`
- `src/modules/vuelos/testing/v2.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `frontend/tests/unit/admin-audit-page.test.tsx`
- `frontend/tests/unit/auditoria.test.ts`
- `frontend/tests/unit/admin-providers-page.test.tsx`
- `frontend/tests/unit/admin-nodes-health.test.tsx`

### 5.2 Pruebas a repetir (sugeridas)

```bash
npx jest src/modules/vuelos/common/topologia.spec.ts src/modules/vuelos/common/db-errors.spec.ts
# requiere TEST_DATABASE_URL apuntando a una base desechable (p. ej. booking_test)
npx jest src/modules/vuelos/testing/trazabilidad.integration.spec.ts src/modules/vuelos/testing/v2.integration.spec.ts
cd frontend && npx vitest run tests/unit/admin-audit-page.test.tsx tests/unit/auditoria.test.ts tests/unit/admin-providers-page.test.tsx tests/unit/admin-nodes-health.test.tsx
npm test -- topologia  (falla si un evento o paso de saga no tiene entrada en topologia.ts)
npm run lint
npm run build
```

_Ejecutar solo cuando se corrijan los hallazgos que se transcriban; añadir aquí una prueba por hallazgo corregido._
