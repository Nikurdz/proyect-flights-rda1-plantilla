# Auditoría — Contrato v2 de Booking (adopción en /api/v2/vuelos) y contrato propio RAM Alliance — 2026-10-26

> Estado: **por transcribir**. Archivo preparado con datos de git y comprobaciones sugeridas; los hallazgos están vacíos a propósito.

- **Plan:** 
  - [`2026-10-26-contrato-v2.md`](../../planes/2026-10-26-contrato-v2.md) — Plan principal (adopción del contrato)
  - [`2026-10-27-contrato-v2-propio.md`](../../planes/2026-10-27-contrato-v2-propio.md) — Plan del contrato propio (2026-10-27)
- **Fecha del plan:** 2026-10-26
- **Objetivo del plan:** Cumplir el contrato oficial v2 de Booking sin cambiar v1 (versionado por URI, OAuth2 de socio, CloudEvents, stock por gRPC, eventos entrantes) y entregar un YAML propio generado y fiel al comportamiento real del nodo.
- **Commits auditados:** 3 (fecha y hora del autor en git, hora local -05:00; estadísticas de `git show --shortstat`).

  | Commit | Fecha | Asunto | Archivos | Inserciones | Borrados |
  |---|---|---|---|---|---|
  | `fa138ae` | 2026-10-26 19:20 | Adopt contract v2 (/api/v2/vuelos) alongside v1; gRPC stock push, CloudEvents, OAuth2 partner | 82 | 7900 | 114 |
  | `aeaa125` | 2026-10-27 20:33 | Generate our own contract v2 for Booking; Booking env integration; v2 fixes | 33 | 5541 | 64 |
  | `147d397` | 2026-10-27 20:48 | Receive Booking events over HTTP (signed CloudEvents); listen on 0.0.0.0; update Tailscale IP | 11 | 288 | 34 |

- **Archivos principales tocados** (reales de git, agrupados; recortados si hay muchos):

- **Backend** (56): `src/main.ts`, `src/modules/vuelos/auth/token.service.ts`, `src/modules/vuelos/common/business-rules.ts`, `src/modules/vuelos/common/cloud-events.ts`, `src/modules/vuelos/common/correlation.ts`, `src/modules/vuelos/common/problem-details.exception.ts`, `src/modules/vuelos/common/problem-details.filter.ts`, `src/modules/vuelos/common/safe-http.ts`, `src/modules/vuelos/common/vuelos-config.ts`, `src/modules/vuelos/dto/booking.dto.ts`, `src/modules/vuelos/dto/hold.dto.ts`, `src/modules/vuelos/dto/postventa.dto.ts`, `src/modules/vuelos/ecommerce/admin/admin.module.ts`, `src/modules/vuelos/entities/booking.entity.ts` … y 42 más
- **Pruebas** (9): `src/modules/vuelos/common/event-schemas.spec.ts`, `src/modules/vuelos/services/search.service.spec.ts`, `src/modules/vuelos/testing/contract-v2.integration.spec.ts`, `src/modules/vuelos/testing/integration-app.ts`, `src/modules/vuelos/testing/stock-grpc.integration.spec.ts`, `src/modules/vuelos/testing/v2.integration.spec.ts`, `src/modules/vuelos/ecommerce/common/global-rate-limit.middleware.spec.ts`, `src/modules/vuelos/testing/contract-v2-build.spec.ts`, `src/modules/vuelos/testing/contract-v2-validator.ts`
- **Docs** (9): `CLAUDE.md`, `src/modules/vuelos/docs/RDA2-docs/COMPARACION-CONTRATOS-V1-V2.md`, `src/modules/vuelos/docs/RDA2-docs/CONTRATOS-DE-EVENTOS.md`, `src/modules/vuelos/docs/RDA2-docs/README.md`, `src/modules/vuelos/docs/arquitectura-completa-vuelos-HD.png`, `src/modules/vuelos/docs/arquitectura-completa-vuelos.mermaid`, `src/modules/vuelos/docs/arquitectura-completa-vuelos.svg`, `src/modules/vuelos/docs/planes/2026-10-26-contrato-v2.md`, `src/modules/vuelos/docs/planes/2026-10-27-contrato-v2-propio.md`
- **Contratos** (15): `contracts/eventos/booking.cancelled.v1.schema.json`, `contracts/eventos/booking.confirmed.v1.schema.json`, `contracts/eventos/booking.seat_changed.v1.schema.json`, `contracts/eventos/booking.ticket_issued.v1.schema.json`, `contracts/eventos/booking.ticket_issuing.v1.schema.json`, `contracts/eventos/flight.status_changed.v1.schema.json`, `contracts/eventos/hold.created.v1.schema.json`, `contracts/eventos/hold.expired.v1.schema.json`, `contracts/eventos/pagos.payment.confirmed.v1.schema.json`, `contracts/eventos/pagos.payment.failed.v1.schema.json`, `contracts/eventos/paquetes.package.cancelled.v1.schema.json`, `contracts/vuelos-eventos-asyncapi.yaml`, `contracts/vuelos-openapi-v2.yaml`, `contracts/overlay/vuelos-v2-ram-alliance.overlay.yaml` … y 1 más
- **Infraestructura y configuración** (5): `.env.example`, `nest-cli.json`, `package-lock.json`, `package.json`, `scripts/build-contract-v2.js`

- **Alcance:**
  - **Incluye:** Versionado por URI, OAuth2 de socio con scopes, ProblemDetails v2, 8 operaciones nuevas, CloudEvents (webhooks y feed), eventos entrantes de Booking (también por HTTP firmado), push de stock por gRPC. Generador del contrato (plantilla + parche RFC 7386), pruebas de validez, de sincronía y de fidelidad.
  - **No incluye:** Cobro con tarjeta, facturación y cuentas de cliente de Booking. Cambiar la plantilla de Booking o el comportamiento de /api/v1.
- **Método:** pendiente de transcribir. Marcas de la leyenda:
  - **[V]** releído en el código por quien audita.
  - **[E]** procede de una exploración y no se releyó.
  - **[observado]** visto al ejecutar o usar el sistema.
  - **[confirmado en producción]** comprobado contra el despliegue real.
- **No cubierto:** pruebas de penetración, carga, accesibilidad completa, configuración real de los servicios externos (Azure, Aiven, Netlify, GHCR), contenido de `.env` y `.env.azure`.
- **Por verificar** (dudas o contradicciones que los informes dejaron abiertas; no son hechos):
  - Si el scope `flights:admin` del cliente de Booking en producción coincide con el del seed.
  - Pruebas de repetición (replay) del webhook de Booking: el explorador solo encontró 401 y 200 (`testing/v2.integration.spec.ts:661-681`).
  - Limitador propio de `/api/v2/oauth2/token`: no encontrado, solo el global.
  - Contenido de `contract-v2.integration.spec.ts` (solo el nombre): si exige el scope de cada operación del YAML.

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

- [E] ¿El cliente de Booking necesita `flights:admin`? `seed/seed.ts:71` guarda `scopes: PARTNER_SCOPES.join(' ')` y `v2/auth/partner-auth.service.ts:68` usa `PARTNER_SCOPES` por defecto; `v2/auth/scopes.ts:8-10` hace que `flights:admin` valga por todos los scopes (incluye `PUT promociones/contrato` y `PATCH flights/:n/status`). Mínimo privilegio y alcance de un secreto filtrado.
- [E] ¿Un secreto de socio filtrado puede revocarse sin reiniciar? `v2/auth/partner-auth.service.ts:52` comprueba `activo` solo al emitir el token y `v2/auth/partner-auth.guard.ts:33-68` no consulta la base al validar.

### 2.2 Altos

| ID | Hallazgo | Estado |
|---|---|---|
| A-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Alto**

- [E] ¿Un cliente desactivado sigue operando hasta que expira el token? El TTL por defecto es 3600 s (`common/vuelos-config.ts:130`).
- [E] ¿El webhook de Booking se puede repetir con la misma firma? `v2/booking-inbound-v2.controller.ts:34-35` y `:41`: `X-Webhook-Timestamp` es opcional y no se comprueba su antigüedad; la idempotencia de cancelación (`v2/inbound-events-v2.service.ts:66-68` → `services/cancellation.service.ts:79`, clave `keyFor(event.id)`) mitiga repeticiones del mismo id. Coincide con B-2 de AUDITORIA-2026-11-11.

### 2.3 Medios

| ID | Hallazgo | Estado |
|---|---|---|
| M-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Medio**

- [E] `v2/auth/partner-auth.guard.ts:57-58` acepta `X-User-Roles` de tokens de servicio. Hoy no concede permisos (`:60` usa solo los scopes del token) y `common/correlation.ts:78` clasifica el servicio como PARTNER antes de mirar roles. ¿Algún uso futuro de `claims.roles` lo convertiría en escalada? (B-4 de la auditoría previa).
- [E] Operaciones sin scope y públicas: `v2/vuelos-v2.controller.ts:69-75` (health), `:105-116` (search), `:118-123` (seatmap), `:125-129` (estado de vuelo). ¿El límite global de 300/min por IP (`ecommerce/common/global-rate-limit.middleware.ts:5`) cubre su coste y abuso?
- [E] `v2/oauth2.controller.ts:16-41`: el token no tiene límite propio por cliente, solo el global. ¿Basta contra fuerza bruta del secreto?
- [E] `v2/auth/partner-auth.guard.ts:15,47-56` y `v2/auth/scopes.ts:6`: un socio puede actuar como cualquier usuario con `X-User-Id` y sus webhooks oyen a todos sus usuarios. ¿Es intencionado y está documentado?

### 2.4 Bajos

| ID | Hallazgo | Estado |
|---|---|---|
| B-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Bajo**

- [E] `common/cloud-events.ts:116-131`: `id`, `correlationid` y `subject` del remitente se aceptan sin validar formato ni longitud.
- [E] `v2/auth/oauth2.controller.ts:23-30`: `decodeURIComponent` sobre credenciales Basic mal formadas. ¿Responde 500 o 401?

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

- `src/modules/vuelos/testing/v2.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/testing/contract-v2.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/testing/contract-v2-build.spec.ts`
- `src/modules/vuelos/testing/v2-offset.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/testing/v2-rendimiento.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/testing/booking-plan.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/testing/booking-prueba.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/testing/stock-grpc.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/common/safe-http.spec.ts`
- `src/modules/vuelos/ecommerce/common/global-rate-limit.middleware.spec.ts`

### 5.2 Pruebas a repetir (sugeridas)

```bash
npx jest src/modules/vuelos/testing/contract-v2-build.spec.ts src/modules/vuelos/common/safe-http.spec.ts src/modules/vuelos/ecommerce/common/global-rate-limit.middleware.spec.ts
# requiere TEST_DATABASE_URL apuntando a una base desechable (p. ej. booking_test)
npx jest src/modules/vuelos/testing/v2.integration.spec.ts src/modules/vuelos/testing/contract-v2.integration.spec.ts src/modules/vuelos/testing/v2-offset.integration.spec.ts src/modules/vuelos/testing/v2-rendimiento.integration.spec.ts src/modules/vuelos/testing/booking-plan.integration.spec.ts src/modules/vuelos/testing/booking-prueba.integration.spec.ts src/modules/vuelos/testing/stock-grpc.integration.spec.ts
npm run contract:v2:build  (debe terminar sin diferencias en el contrato generado)
npm run migration:check:vuelos  (migración ContractV2)
npm run lint
npm run build
```

_Ejecutar solo cuando se corrijan los hallazgos que se transcriban; añadir aquí una prueba por hallazgo corregido._
