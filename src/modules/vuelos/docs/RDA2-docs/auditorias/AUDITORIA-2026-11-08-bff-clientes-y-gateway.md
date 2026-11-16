# Auditoría — BFF por cliente (móvil, web, admin) y API Gateway local (Kong) — 2026-11-08

> Estado: **por transcribir**. Archivo preparado con datos de git y comprobaciones sugeridas; los hallazgos están vacíos a propósito.

- **Plan:** [`2026-11-08-bff-clientes-y-gateway.md`](../../planes/2026-11-08-bff-clientes-y-gateway.md) — Plan principal
- **Fecha del plan:** 2026-11-08
- **Objetivo del plan:** Dar a móvil, web y admin la forma de orden que necesitan (vistas de solo lectura) y poner reglas de borde (JWT, límite de peticiones, tamaño, Content-Type, formato de Idempotency-Key) en un Kong local.
- **Commits auditados:** 2 (fecha y hora del autor en git, hora local -05:00; estadísticas de `git show --shortstat`).

  | Commit | Fecha | Asunto | Archivos | Inserciones | Borrados |
  |---|---|---|---|---|---|
  | `027b470` | 2026-11-08 18:19 | Add read-only BFF views of the order for mobile, web and back office | 16 | 1568 | 64 |
  | `30ce024` | 2026-11-08 18:19 | Add a local Kong API gateway for the edge rules, with a smoke test | 9 | 280 | 3 |

- **Archivos principales tocados** (reales de git, agrupados; recortados si hay muchos):

- **Backend** (10): `src/modules/vuelos/ecommerce/bff/acciones.ts`, `src/modules/vuelos/ecommerce/bff/bff-ordenes.service.ts`, `src/modules/vuelos/ecommerce/bff/bff.controller.ts`, `src/modules/vuelos/ecommerce/bff/bff.module.ts`, `src/modules/vuelos/ecommerce/bff/dto/bff.dto.ts`, `src/modules/vuelos/ecommerce/bff/mapeos.ts`, `src/modules/vuelos/ecommerce/common/enmascarar.ts`, `src/modules/vuelos/ecommerce/ecommerce.module.ts`, `src/modules/vuelos/ecommerce/ordenes/dto/ordenes.dto.ts`, `src/modules/vuelos/ecommerce/ordenes/ordenes.service.ts`
- **Pruebas** (4): `src/modules/vuelos/ecommerce/bff/acciones.spec.ts`, `src/modules/vuelos/ecommerce/bff/mapeos.spec.ts`, `src/modules/vuelos/ecommerce/common/enmascarar.spec.ts`, `src/modules/vuelos/testing/bff.integration.spec.ts`
- **Docs** (5): `src/modules/vuelos/README.md`, `CLAUDE.md`, `src/modules/vuelos/docs/ARQUITECTURA-CAPAS.md`, `src/modules/vuelos/docs/RDA2-docs/MAPEO-GUIA-RDA2.md`, `src/modules/vuelos/docs/planes/2026-11-08-bff-clientes-y-gateway.md`
- **Contratos** (1): `contracts/vuelos-ecommerce-openapi.yaml`
- **Infraestructura y configuración** (5): `.env.example`, `deploy/gateway/kong.yml`, `docker-compose.yml`, `package.json`, `scripts/gateway-smoke.js`

- **Alcance:**
  - **Incluye:** ecommerce/bff (solo GET), enmascarado, conEstadoVuelo, deploy/gateway/kong.yml, scripts/gateway-smoke.js.
  - **No incluye:** Kong en Railway/Azure, frontend, migraciones, sagas, eventos ni contrato v2.
- **Método:** pendiente de transcribir. Marcas de la leyenda:
  - **[V]** releído en el código por quien audita.
  - **[E]** procede de una exploración y no se releyó.
  - **[observado]** visto al ejecutar o usar el sistema.
  - **[confirmado en producción]** comprobado contra el despliegue real.
- **No cubierto:** pruebas de penetración, carga, accesibilidad completa, configuración real de los servicios externos (Azure, Aiven, Netlify, GHCR), contenido de `.env` y `.env.azure`.
- **Por verificar** (dudas o contradicciones que los informes dejaron abiertas; no son hechos):
  - Este gateway no está desplegado (solo local); cualquier conclusión sobre producción queda fuera.
  - Si las rutas `/api/v1/movil|web|admin` son las que usa hoy el frontend (CLAUDE.md dice que la web sigue usando `/api/v1/ordenes`).

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

- [E] ¿El secreto está solo como placeholder? `deploy/gateway/kong.yml:19` (`secret: __JWT_SECRET__`) y `kong.microservicios.yml:16`. El explorador no encontró secreto real en esos archivos.
- [E] ¿La sustitución del placeholder escapa bien el secreto? `docker-compose.yml:38-39` (`sed` con escape de `\`, `&`, `|`): revisar secretos con caracteres como `'` o saltos de línea.

### 2.2 Altos

| ID | Hallazgo | Estado |
|---|---|---|
| A-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Alto**

- [E] ¿`expediente` expone datos de otros clientes además del contacto? `ecommerce/bff/bff-ordenes.service.ts:69-91` (`vista`, `auditoria`, `pago.referencia`); el explorador no leyó `vista()` en detalle.
- [E] ¿`movilListado` filtra por dueño? `bff-ordenes.service.ts:38-40` usa `historial(auth,'me',…)`: comprobar en `ordenes.service.ts` que `'me'` sale de `auth.ownerId`. El texto dice que los invitados reciben 403 (`bff.controller.ts:24`); no verificado en código.
- [E] ¿Kong valida solo firma y `exp` (`kong.yml:43-48`)? El rol lo decide la API; si un controlador olvida el guard, el borde no lo cubre.

### 2.3 Medios

| ID | Hallazgo | Estado |
|---|---|---|
| M-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Medio**

- [E] ¿El rate limit es local por nodo? `kong.yml:58-63` (`policy: local`, `fault_tolerant: true`): no es global con varias instancias.
- [E] ¿Las reglas duplicadas en `kong.yml` y `kong.microservicios.yml` pueden divergir?
- [E] ¿`enmascararTelefono` deja solo 3 dígitos suficientes para identificar? `ecommerce/common/enmascarar.ts:9-13`.

### 2.4 Bajos

| ID | Hallazgo | Estado |
|---|---|---|
| B-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Bajo**

- [E] ¿`Idempotency-Key` se valida solo por formato en el borde? `kong.yml:94-97`; el replay lo hace la API.
- [E] Upstream `host.docker.internal:3000` (`kong.yml:35`): solo local, como dice el plan.

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

- `src/modules/vuelos/testing/bff.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/ecommerce/bff/mapeos.spec.ts`
- `src/modules/vuelos/ecommerce/bff/acciones.spec.ts`
- `src/modules/vuelos/ecommerce/common/enmascarar.spec.ts`

_Sin cobertura automática:_ `scripts/gateway-smoke.js` no tiene spec (se ejecuta con `npm run gateway:smoke`).

### 5.2 Pruebas a repetir (sugeridas)

```bash
npx jest src/modules/vuelos/ecommerce/bff/mapeos.spec.ts src/modules/vuelos/ecommerce/bff/acciones.spec.ts src/modules/vuelos/ecommerce/common/enmascarar.spec.ts
# requiere TEST_DATABASE_URL apuntando a una base desechable (p. ej. booking_test)
npx jest src/modules/vuelos/testing/bff.integration.spec.ts
docker compose --profile gateway up -d kong  (con TRUST_PROXY=1)
npm run gateway:smoke  (consume el cupo por IP durante un minuto y crea una cuenta de prueba)
npm run lint
npm run build
```

_Ejecutar solo cuando se corrijan los hallazgos que se transcriban; añadir aquí una prueba por hallazgo corregido._
