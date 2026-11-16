# Auditoría — Backend en Azure Container Apps (coste mínimo) — 2026-11-05

> Estado: **por transcribir**. Archivo preparado con datos de git y comprobaciones sugeridas; los hallazgos están vacíos a propósito.

- **Plan:** [`2026-11-05-azure-container-apps.md`](../../planes/2026-11-05-azure-container-apps.md) — Plan principal
- **Fecha del plan:** 2026-11-05
- **Objetivo del plan:** Preparar el backend para correr en Azure Container Apps (plan de consumo, imagen pública en GHCR) con la cuenta de estudiante, dejando la base en Aiven y el frontend en Netlify.
- **Commits auditados:** 4 (fecha y hora del autor en git, hora local -05:00; estadísticas de `git show --shortstat`).

  | Commit | Fecha | Asunto | Archivos | Inserciones | Borrados |
  |---|---|---|---|---|---|
  | `bb47941` | 2026-11-05 16:41 | Prepare Azure Container Apps deployment (Dockerfile, GHCR image, deploy scripts) | 14 | 371 | 11 |
  | `cffa9bb` | 2026-11-05 16:42 | Keep LF line endings for shell scripts and the Dockerfile | 1 | 4 | 0 |
  | `d99ceb6` | 2026-11-05 17:23 | Start the container API without waiting for the seed | 8 | 47 | 14 |
  | `ed3992e` | 2026-11-05 18:08 | Default the Azure deploy to westus and document the database latency | 3 | 3 | 3 |

- **Archivos principales tocados** (reales de git, agrupados; recortados si hay muchos):

- **Backend** (1): `src/modules/vuelos/seed/seed.ts`
- **Docs** (3): `CLAUDE.md`, `deploy/azure/README.md`, `src/modules/vuelos/docs/planes/2026-11-05-azure-container-apps.md`
- **Infraestructura y configuración** (12): `.dockerignore`, `.github/workflows/container.yml`, `.gitignore`, `Dockerfile`, `deploy/azure/.env.azure.example`, `deploy/azure/crear.sh`, `deploy/azure/desplegar.sh`, `deploy/azure/generar-app.js`, `eslint.config.mjs`, `package-lock.json`, `package.json`, `.gitattributes`

- **Alcance:**
  - **Incluye:** Dockerfile, workflow que publica la imagen en GHCR, scripts az y generador de la definición de la app, documentación; arranque del contenedor sin esperar al seed; región por defecto westus.
  - **No incluye:** Cambios de lógica, crear los recursos en la cuenta del usuario, mover datos, tocar Railway.
- **Método:** pendiente de transcribir. Marcas de la leyenda:
  - **[V]** releído en el código por quien audita.
  - **[E]** procede de una exploración y no se releyó.
  - **[observado]** visto al ejecutar o usar el sistema.
  - **[confirmado en producción]** comprobado contra el despliegue real.
- **No cubierto:** pruebas de penetración, carga, accesibilidad completa, configuración real de los servicios externos (Azure, Aiven, Netlify, GHCR), contenido de `.env` y `.env.azure`.
- **Por verificar** (dudas o contradicciones que los informes dejaron abiertas; no son hechos):
  - Si Azure ejecutaba `1f4d2e9` el 2026-11-11: AUDITORIA-2026-11-11 (línea 4) lo afirma; el plan 2026-11-12-booking-velocidad-y-holds (línea 16) dice que la búsqueda por día local «aún no está desplegada». Contradicción sin resolver.
  - Si `/api/docs` es accesible en producción: AUDITORIA-2026-11-11 (línea 132) lo da por cerrado «no accesible», pero `src/main.ts:62-63` lo registra sin condición. No se comprobó el despliegue real.
  - Si `deploy/azure/desplegar.sh` comprueba la CI: AUDITORIA-2026-11-11 (línea 152) dice que «se niega a desplegar un sha sin CI en verde», pero el explorador leyó el script completo y no encontró ninguna comprobación. Releerlo antes de transcribir.
  - Estado real de Azure, GHCR, Aiven y Netlify (fuera del alcance).

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

- [E] ¿Todas las credenciales de `deploy/azure/.env.azure` están en la lista de secretos? `deploy/azure/generar-app.js:15-26` lista `DATABASE_URL`, `DB_SSL_CA`, `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `PARTNER_CLIENT_SECRET`, `ADMIN_PASSWORD`, `BOOKING_WEBHOOK_SECRET`, `BOOKING_STOCK_API_KEY`, `BOOKING_PAGOS_API_KEY` y `RABBITMQ_URL`; cualquier otra variable con credenciales (por ejemplo `MIGRATIONS_DATABASE_URL`, que lee `migrations/data-source.ts:17`) se escribe como `value` en claro (`generar-app.js:63`). `.env.azure` está en `.gitignore:57`; su contenido no se leyó.

### 2.2 Altos

| ID | Hallazgo | Estado |
|---|---|---|
| A-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Alto**

- [E] ¿Puede publicarse una imagen rota? `.github/workflows/container.yml:5-7` y `:31-33` construyen y publican `:sha` y `:latest` en cada push sin depender de `ci.yml` (M-3 de la auditoría previa).
- [E] ¿Escalar a cero detiene trabajos críticos? `deploy/azure/generar-app.js:95` (`minReplicas` por defecto 0) y `:97` (`maxReplicas: 1`): mientras duerme no hay reconciliación de capturas, webhooks ni stock.

### 2.3 Medios

| ID | Hallazgo | Estado |
|---|---|---|
| M-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Medio**

- [E] Swagger público en producción: `src/main.ts:62-63` registra `/api/docs` sin condición y `:68` registra `/api/docs-v2` (B-1 de la auditoría previa).
- [E] `package.json:31`: `(node dist/modules/vuelos/seed/seed.js &)` ejecuta el seed en segundo plano sin supervisión; si falla solo queda en los logs. ¿Qué pasa si se interrumpe a mitad?
- [E] `deploy/azure/crear.sh:34` escribe `.app.generada.json` con los secretos y lo borra solo en `:41` (con `set -euo pipefail`, si falla queda en disco; `.gitignore:58` lo excluye de git) (B-8 de la auditoría previa).
- [E] Revisión única: `deploy/azure/generar-app.js:74` (`activeRevisionsMode: 'Single'`), `crear.sh:16` y `desplegar.sh:5` (`:latest` no crea revisión nueva). ¿Cómo se hace rollback rápido? (B-7).
- [E] Memoria: `Dockerfile:19` usa `--max-old-space-size=384` y `generar-app.js:83` asigna 0,5 GiB. ¿Margen suficiente con el seed y el stock en la misma instancia?

### 2.4 Bajos

| ID | Hallazgo | Estado |
|---|---|---|
| B-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Bajo**

- [E] `Dockerfile:25` ejecuta como `USER node` y `.dockerignore:4,16` excluye `.env` y `deploy`: comprobar.
- [E] `deploy/azure/desplegar.sh:13` fija el repositorio de GHCR en el script (público, pero ata el script al nombre del repo).

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

- (ninguna encontrada)

_Sin cobertura automática:_ El explorador no encontró specs que cubran Dockerfile, generar-app.js ni start:container (búsqueda de `generar-app|start:container|Dockerfile` en `src/**/*.spec.ts` sin resultados). La verificación del plan fue manual (docker build/run, `bash -n`, generador con un `.env.azure` de ejemplo).

### 5.2 Pruebas a repetir (sugeridas)

```bash
docker build -t ram-vuelos-test .  y ejecutar con un .env de prueba; comprobar /api/v1/health/live
bash -n deploy/azure/crear.sh deploy/azure/desplegar.sh
node deploy/azure/generar-app.js  (con un .env.azure de ejemplo, sin credenciales reales)
npm run lint
npm run build
```

_Ejecutar solo cuando se corrijan los hallazgos que se transcriban; añadir aquí una prueba por hallazgo corregido._
