# Auditoría — Envío de stock a Booking por HTTP — 2026-11-03

> Estado: **por transcribir**. Archivo preparado con datos de git y comprobaciones sugeridas; los hallazgos están vacíos a propósito.

- **Plan:** [`2026-11-03-stock-http.md`](../../planes/2026-11-03-stock-http.md) — Plan principal
- **Fecha del plan:** 2026-11-03
- **Objetivo del plan:** Añadir el transporte HTTP (POST /api/v2/inventory/stock de Booking) al envío de stock, que antes solo hablaba gRPC.
- **Commits auditados:** 2 (fecha y hora del autor en git, hora local -05:00; estadísticas de `git show --shortstat`).

  | Commit | Fecha | Asunto | Archivos | Inserciones | Borrados |
  |---|---|---|---|---|---|
  | `911c2b0` | 2026-11-03 18:44 | Send stock to Booking over HTTP (POST /api/v2/inventory/stock) | 11 | 430 | 68 |
  | `9f1f698` | 2026-11-03 19:46 | Log one summary line per HTTP stock push round | 1 | 2 | 0 |

- **Archivos principales tocados** (reales de git, agrupados; recortados si hay muchos):

- **Backend** (2): `src/modules/vuelos/common/vuelos-config.ts`, `src/modules/vuelos/v2/stock-push.service.ts`
- **Pruebas** (3): `src/modules/vuelos/services/search.service.spec.ts`, `src/modules/vuelos/testing/integration-app.ts`, `src/modules/vuelos/testing/stock-http.integration.spec.ts`
- **Docs** (3): `CLAUDE.md`, `src/modules/vuelos/docs/RDA2-docs/COMPARACION-CONTRATOS-V1-V2.md`, `src/modules/vuelos/docs/planes/2026-11-03-stock-http.md`
- **Contratos** (2): `contracts/overlay/vuelos-v2-ram-alliance.overlay.yaml`, `contracts/vuelos-openapi-v2-ram-alliance.yaml`
- **Infraestructura y configuración** (1): `.env.example`

- **Alcance:**
  - **Incluye:** Transporte HTTP en StockPushService, horizonte y frecuencia configurables, manejo de rechazos y caídas, prueba con servidor HTTP local, contrato y documentación.
  - **No incluye:** Los webhooks de Booking (/api/v2/webhooks/vuelos), que se activan después.
- **Método:** pendiente de transcribir. Marcas de la leyenda:
  - **[V]** releído en el código por quien audita.
  - **[E]** procede de una exploración y no se releyó.
  - **[observado]** visto al ejecutar o usar el sistema.
  - **[confirmado en producción]** comprobado contra el despliegue real.
- **No cubierto:** pruebas de penetración, carga, accesibilidad completa, configuración real de los servicios externos (Azure, Aiven, Netlify, GHCR), contenido de `.env` y `.env.azure`.
- **Por verificar** (dudas o contradicciones que los informes dejaron abiertas; no son hechos):
  - Contrato real de Booking para `date`/`time_slot` y para el 429: no está en el repositorio.
  - Que el POST real de un vuelo contra Azure devolvió `"success": true` (paso de verificación del plan, no reproducido aquí).
  - M-9 de AUDITORIA-2026-11-11 (`stock-grpc.integration.spec.ts` inestable): hallazgo de otra sesión, no verificado aquí.

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

- [E] ¿`BOOKING_STOCK_API_KEY` puede viajar sin TLS en producción? `v2/stock-push.service.ts:261` la envía en `X-API-Key` y `:260` usa `resolveSafeTarget(..., this.config.webhooks.allowPrivateHosts)`; en producción `common/vuelos-config.ts:150-152` impide `WEBHOOKS_ALLOW_PRIVATE_HOSTS=true`. Comprobar que no hay otra ruta a `http`.

### 2.2 Altos

| ID | Hallazgo | Estado |
|---|---|---|
| A-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Alto**

- [E] Resincronización completa cada hora: `v2/stock-push.service.ts:182-183` y `:192` reenvían todos los vuelos del horizonte (unos 1.400 POST según el plan). ¿Lo asume Booking? ¿Y con Azure escalando a cero, cada despertar lo repite?
- [E] ¿Una caída de Booking provoca una ronda completa cada 30 s? `v2/stock-push.service.ts:214` solo actualiza `lastFull` tras una ronda correcta y `:303-305` lanza error tras 5 fallos seguidos; mientras Booking esté caído, `full` sigue siendo cierto en cada `sync`.

### 2.3 Medios

| ID | Hallazgo | Estado |
|---|---|---|
| M-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Medio**

- [E] `v2/stock-push.service.ts:322`: un 429 se trata como error de red y se reintenta en el siguiente sync sin espera. ¿Debería tener backoff?
- [E] `v2/stock-push.service.ts:243-244`: `date` y `time_slot` salen en UTC. ¿Coincide con lo que Booking espera? (CLAUDE.md dice que el feed usa días UTC a propósito.)
- [E] `v2/stock-push.service.ts:260`: la IP se resuelve una vez por ronda y se fija (correcto frente a DNS rebinding). ¿Se revalida si la ronda dura minutos?

### 2.4 Bajos

| ID | Hallazgo | Estado |
|---|---|---|
| B-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Bajo**

- [E] `v2/stock-push.service.ts:182`: con `lastPushed.size === 0` cada ronda es completa (arranque sin envíos previos).
- [E] `v2/stock-push.service.ts:201-210` (ruta gRPC): envío en serie; M-9 de la auditoría previa pide acotar la concurrencia.

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

- `src/modules/vuelos/testing/stock-http.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/testing/stock-grpc.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/common/safe-http.spec.ts`
- `src/modules/vuelos/services/search.service.spec.ts`

### 5.2 Pruebas a repetir (sugeridas)

```bash
npx jest src/modules/vuelos/common/safe-http.spec.ts src/modules/vuelos/services/search.service.spec.ts
# requiere TEST_DATABASE_URL apuntando a una base desechable (p. ej. booking_test)
npx jest src/modules/vuelos/testing/stock-http.integration.spec.ts src/modules/vuelos/testing/stock-grpc.integration.spec.ts
npm run contract:v2:build  (documentación `x-stock-push`)
npm run lint
npm run build
```

_Ejecutar solo cuando se corrijan los hallazgos que se transcriban; añadir aquí una prueba por hallazgo corregido._
