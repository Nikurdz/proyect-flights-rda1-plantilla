# Auditoría — Velocidad de la API v2, offsets reales de hora, holds reemplazables y /health sin base de datos — 2026-11-12

> Estado: **por transcribir**. Archivo preparado con datos de git y comprobaciones sugeridas; los hallazgos están vacíos a propósito.

- **Plan:** [`2026-11-12-booking-velocidad-y-holds.md`](../../planes/2026-11-12-booking-velocidad-y-holds.md) — Plan principal
- **Fecha del plan:** 2026-11-12
- **Objetivo del plan:** Atender las medidas de Booking (búsqueda de 2,3 s y mapa de 1,1 s frente a la meta de 1 s): ofertas en una transacción, caché de tarifas, offsets reales en las horas v2, holds reemplazables, /health sin base de datos y /eventos por índice.
- **Commits auditados:** 1 (fecha y hora del autor en git, hora local -05:00; estadísticas de `git show --shortstat`).

  | Commit | Fecha | Asunto | Archivos | Inserciones | Borrados |
  |---|---|---|---|---|---|
  | `dc25c37` | 2026-11-12 17:35 | Speed up v2 search and seat map, real UTC offsets in v2, replaceable holds, DB-free health | 33 | 1104 | 101 |

- **Archivos principales tocados** (reales de git, agrupados; recortados si hay muchos):

- **Backend** (18): `src/modules/vuelos/common/airport-zones.ts`, `src/modules/vuelos/common/date.util.ts`, `src/modules/vuelos/common/held-seats.ts`, `src/modules/vuelos/common/vuelos-config.ts`, `src/modules/vuelos/common/zoned-time.ts`, `src/modules/vuelos/entities/outbox-event.entity.ts`, `src/modules/vuelos/entities/ticket.entity.ts`, `src/modules/vuelos/migrations/1794441600000-PerformanceIndexes.ts`, `src/modules/vuelos/services/offers.service.ts`, `src/modules/vuelos/services/search.service.ts`, `src/modules/vuelos/services/webhook-dispatcher.service.ts`, `src/modules/vuelos/v2/booking-view-v2.service.ts`, `src/modules/vuelos/v2/health-v2.service.ts`, `src/modules/vuelos/v2/outbox-v2.service.ts` … y 4 más
- **Pruebas** (10): `src/modules/vuelos/common/zoned-time.spec.ts`, `src/modules/vuelos/services/search.service.spec.ts`, `src/modules/vuelos/testing/booking-plan.integration.spec.ts`, `src/modules/vuelos/testing/ecuador-time.integration.spec.ts`, `src/modules/vuelos/testing/hold-reholding.integration.spec.ts`, `src/modules/vuelos/testing/integration-app.ts`, `src/modules/vuelos/testing/stock-grpc.integration.spec.ts`, `src/modules/vuelos/testing/v2-offset.integration.spec.ts`, `src/modules/vuelos/testing/v2-rendimiento.integration.spec.ts`, `src/modules/vuelos/testing/v2.integration.spec.ts`
- **Docs** (2): `CLAUDE.md`, `src/modules/vuelos/docs/planes/2026-11-12-booking-velocidad-y-holds.md`
- **Contratos** (2): `contracts/overlay/vuelos-v2-ram-alliance.overlay.yaml`, `contracts/vuelos-openapi-v2-ram-alliance.yaml`
- **Infraestructura y configuración** (1): `.env.example`

- **Alcance:**
  - **Incluye:** search.service.ts (ofertas en una transacción, caché de tarifas 60 s), common/zoned-time.ts, v2/health-v2.service.ts (foto cada 30 s), v2/outbox-v2.service.ts, índices (migración PerformanceIndexes), re-hold del mismo dueño y oferta.
  - **No incluye:** Cambios en v1 ni en el stock enviado a Booking; el filtro por dueño de /eventos (propuesto aparte, ver C-1 de AUDITORIA-2026-11-11).
- **Método:** pendiente de transcribir. Marcas de la leyenda:
  - **[V]** releído en el código por quien audita.
  - **[E]** procede de una exploración y no se releyó.
  - **[observado]** visto al ejecutar o usar el sistema.
  - **[confirmado en producción]** comprobado contra el despliegue real.
- **No cubierto:** pruebas de penetración, carga, accesibilidad completa, configuración real de los servicios externos (Azure, Aiven, Netlify, GHCR), contenido de `.env` y `.env.azure`.
- **Por verificar** (dudas o contradicciones que los informes dejaron abiertas; no son hechos):
  - Si Booking verifica la firma del webhook sobre el payload convertido o sobre el UTC: no está en este repositorio.
  - Que el plan describa 1f4d2e9 como «aún no desplegada» en su línea 16, contra AUDITORIA-2026-11-11 (línea 4) que dice que corría en Azure: sin resolver.
  - Mediciones de tiempos de Booking (2,3 s / 1,1 s) y su mejora: no reproducidas aquí; `v2-rendimiento.integration.spec.ts` no se leyó.

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

- [E] `/eventos` sin filtro por dueño: `v2/vuelos-v2.controller.ts:77-82` solo exige `flights:read` y `v2/outbox-v2.service.ts:47-75` no recibe ni usa el dueño. ¿Un partner (o un invitado) con `flights:read` ve los eventos de otros dueños (`partnerOrderId`, PNR)? (Es C-1 de AUDITORIA-2026-11-11; el plan lo excluye de su alcance.)

### 2.2 Altos

| ID | Hallazgo | Estado |
|---|---|---|
| A-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Alto**

- [E] Cursor y retardo: `outbox-v2.service.ts:52` solo lee filas con más de 2 s (`OUTBOX_FEED_DELAY_MS`). ¿Una transacción más lenta de 2 s que confirma después de un evento posterior hace que ese evento se salte para siempre? ¿Es el riesgo que cubre el comentario de la línea 50?
- [E] Firma sobre el cuerpo convertido: `services/webhook-dispatcher.service.ts:118-128` firma el cuerpo ya convertido a `-05:00`. ¿Booking verifica la firma con el payload guardado (UTC)? Si lo hace, fallaría.
- [E] `v2/health-v2.service.ts:69` llama `refresh()` dentro de la petición si el snapshot tiene más de 120 s, pero el comentario de la línea 41 dice «A request never queries the database», y `:104` (`SELECT 1`) no tiene timeout: ¿un `/health` sin token se cuelga si la base no responde?

### 2.3 Medios

| ID | Hallazgo | Estado |
|---|---|---|
| M-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Medio**

- [E] `health-v2.service.ts:106`: `vuelos_programados_hoy` usa el día UTC (`utcDayRange(todayUtc())`): después de las 19:00 de Ecuador cuenta los vuelos del día siguiente. ¿Es intencional?
- [E] `common/zoned-time.ts:59` convierte cualquier cadena UTC, no solo las de aeropuerto: ¿un cliente que compara las horas como texto con `Z` deja de funcionar?
- [E] Retención: `ecommerce/observabilidad/retencion-auditoria.service.ts:48` borra `vuelos_outbox` a los 180 días: ¿qué pasa con un cursor `evt-…` antiguo (`outbox-v2.service.ts:69`)?

### 2.4 Bajos

| ID | Hallazgo | Estado |
|---|---|---|
| B-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Bajo**

- [E] El snapshot de `/health` puede tardar hasta 30 s en mostrar que la base cayó (`health-v2.service.ts:27,59`).
- [E] La caché de familias (`services/search.service.ts:33,173-178`) no tiene invalidación.
- [E] Ausencia de tests de `outbox-v2` y `health-v2`.

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
- `src/modules/vuelos/common/zoned-time.spec.ts`
- `src/modules/vuelos/common/safe-http.spec.ts`
- `src/modules/vuelos/testing/v2-offset.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/testing/v2-rendimiento.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/testing/hold-reholding.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/testing/contract-v2-build.spec.ts`

_Sin cobertura automática:_ El explorador no encontró spec propio de `v2/outbox-v2.service.ts` ni de `v2/health-v2.service.ts`.

### 5.2 Pruebas a repetir (sugeridas)

```bash
npx jest src/modules/vuelos/common/activity-gate.spec.ts src/modules/vuelos/common/zoned-time.spec.ts src/modules/vuelos/common/safe-http.spec.ts src/modules/vuelos/testing/contract-v2-build.spec.ts
# requiere TEST_DATABASE_URL apuntando a una base desechable (p. ej. booking_test)
npx jest src/modules/vuelos/testing/v2-offset.integration.spec.ts src/modules/vuelos/testing/v2-rendimiento.integration.spec.ts src/modules/vuelos/testing/hold-reholding.integration.spec.ts
npm run migration:check:vuelos  (migración PerformanceIndexes)
npm run contract:v2:build
npm run lint
npm run build
```

_Ejecutar solo cuando se corrijan los hallazgos que se transcriban; añadir aquí una prueba por hallazgo corregido._
