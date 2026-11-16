# Auditoría — Contratos de eventos (JSON Schema, AsyncAPI) y división en microservicios — 2026-10-26

> Estado: **por transcribir**. Archivo preparado con datos de git y comprobaciones sugeridas; los hallazgos están vacíos a propósito.

- **Plan:** [`2026-10-26-eventos-contratos-microservicios.md`](../../planes/2026-10-26-eventos-contratos-microservicios.md) — Plan principal
- **Fecha del plan:** 2026-10-26
- **Objetivo del plan:** Aplicar las semanas 6 y 7 de la guía RDA2 (EDA y contratos verificables): esquemas por evento validados con ajv en el bus, AsyncAPI, política de compatibilidad con CI, y documentar qué grupos de tablas pasan a microservicios, sin cambiar el despliegue.
- **Commits auditados:** 1 (fecha y hora del autor en git, hora local -05:00; estadísticas de `git show --shortstat`).

  | Commit | Fecha | Asunto | Archivos | Inserciones | Borrados |
  |---|---|---|---|---|---|
  | `704956f` | 2026-10-26 18:35 | Add event contracts, schema compatibility check and CI; split RDA1/RDA2 docs | 73 | 2578 | 61 |

- **Archivos principales tocados** (reales de git, agrupados; recortados si hay muchos):

- **Backend** (3): `src/modules/vuelos/common/domain-event-bus.ts`, `src/modules/vuelos/common/event-schemas.ts`, `src/modules/vuelos/common/schema-compat.ts`
- **Pruebas** (3): `src/modules/vuelos/common/event-schemas.spec.ts`, `src/modules/vuelos/common/schema-compat.spec.ts`, `src/modules/vuelos/esb/rabbitmq.transport.spec.ts`
- **Docs** (28): `CLAUDE.md`, `contracts/eventos/README.md`, `src/modules/vuelos/docs/RDA1-docs/AUDITORIA-10-6-2026-Backend.md`, `src/modules/vuelos/docs/RDA1-docs/AUDITORIA-10-6-2026-Frontend.md`, `src/modules/vuelos/docs/RDA1-docs/AUDITORIA-VUELOS-10-4-2026(1).md`, `src/modules/vuelos/docs/RDA1-docs/AUDITORIA-VUELOS-10-4-2026.md`, `src/modules/vuelos/docs/RDA1-docs/AUDITORIA.md`, `src/modules/vuelos/docs/RDA1-docs/ESTADO-HALLAZGOS-AUDITORIAS.md`, `src/modules/vuelos/docs/RDA1-docs/README.md`, `src/modules/vuelos/docs/RDA1-docs/resume/AUDITORIA-10-6-2026-Backend.md`, `src/modules/vuelos/docs/RDA1-docs/resume/AUDITORIA-10-6-2026-Frontend.md`, `src/modules/vuelos/docs/RDA1-docs/resume/AUDITORIA-VUELOS-10-4-2026(1).md`, `src/modules/vuelos/docs/RDA1-docs/resume/AUDITORIA-VUELOS-10-4-2026.md`, `src/modules/vuelos/docs/RDA1-docs/resume/AUDITORIA.md` … y 14 más
- **Contratos** (34): `contracts/eventos/ClienteRegistrado.v1.schema.json`, `contracts/eventos/ConfiguracionMercadoPublicada.v1.schema.json`, `contracts/eventos/ConsentimientoActualizado.v1.schema.json`, `contracts/eventos/CuentaBloqueada.v1.schema.json`, `contracts/eventos/OfertaCreada.v1.schema.json`, `contracts/eventos/OfertaVencida.v1.schema.json`, `contracts/eventos/OrdenEmitida.v1.schema.json`, `contracts/eventos/OrdenFallidaCompensada.v1.schema.json`, `contracts/eventos/PagoAnulado.v1.schema.json`, `contracts/eventos/PagoAutorizado.v1.schema.json`, `contracts/eventos/PagoRechazado.v1.schema.json`, `contracts/eventos/PagoReembolsado.v1.schema.json`, `contracts/eventos/ReservaExternaCancelada.v1.schema.json`, `contracts/eventos/ReservaExternaConfirmada.v1.schema.json` … y 20 más
- **Infraestructura y configuración** (5): `.env.example`, `.github/workflows/ci.yml`, `package-lock.json`, `package.json`, `scripts/check-schema-compat.ts`

- **Alcance:**
  - **Incluye:** JSON Schema por evento, validación con ajv al publicar y al despachar, AsyncAPI, política SemVer, script de compatibilidad, CI, log de recepción, documentos en RDA2-docs/ y reorganización de las auditorías en RDA1-docs/.
  - **No incluye:** Esquemas PostgreSQL por servicio, outbox y extracción de servicios (Fases B–D, solo documentadas); semanas 8–11.
- **Método:** pendiente de transcribir. Marcas de la leyenda:
  - **[V]** releído en el código por quien audita.
  - **[E]** procede de una exploración y no se releyó.
  - **[observado]** visto al ejecutar o usar el sistema.
  - **[confirmado en producción]** comprobado contra el despliegue real.
- **No cubierto:** pruebas de penetración, carga, accesibilidad completa, configuración real de los servicios externos (Azure, Aiven, Netlify, GHCR), contenido de `.env` y `.env.azure`.
- **Por verificar** (dudas o contradicciones que los informes dejaron abiertas; no son hechos):
  - Si `EVENT_SCHEMA_MODE` está fijado o no en Azure (no se pudo consultar la configuración real).
  - Cobertura del AsyncAPI sobre todos los esquemas (solo se comprobaron 5).

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

- [E] ¿En producción un CloudEvent de Booking con payload inválido llega igual a los handlers que cancelan reservas? `common/domain-event-bus.ts:106-113` solo registra el error en modo `warn` y sigue despachando; `v2/inbound-events-v2.service.ts:49-68` cancela con `pagos.payment.failed` y `paquetes.package.cancelled`.
- [E] ¿El modo de validación en Azure es `warn`? `common/event-schemas.ts:28-32` lo deja en `warn` si `NODE_ENV=production` y `deploy/azure/generar-app.js:28` no fija `EVENT_SCHEMA_MODE`.
- [E] ¿El `publish` de un productor falla solo en `strict`? `common/domain-event-bus.ts:129-135`: en producción un payload incorrecto solo deja un log.

### 2.2 Altos

| ID | Hallazgo | Estado |
|---|---|---|
| A-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Alto**

- [E] ¿`common/schema-compat.ts:30-77` detecta cambios de restricciones? Solo comprueba `type`, `required`, `properties`, `items`, `enum` y `additionalProperties`: ¿un cambio de `pattern`, `minLength`, `maximum`, `format`, `const`, `$ref` u `oneOf` pasa `scripts/check-schema-compat.ts:49-54` sin marcarse?
- [E] ¿`contracts/vuelos-eventos-asyncapi.yaml` referencia todos los esquemas (39 archivos `*.schema.json` al explorar; el plan decía 33)? El explorador solo comprobó `ClienteRegistrado` (línea 125), `OfertaCreada` (201), `PagoAutorizado` (296), `booking.confirmed` (487) y `pagos.payment.confirmed` (715).

### 2.3 Medios

| ID | Hallazgo | Estado |
|---|---|---|
| M-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Medio**

- [E] `common/event-schemas.ts:80`: un tipo sin esquema pasa siempre (`major: null`). ¿Hay algún evento publicado sin `.schema.json`? `event-schemas.spec.ts` debería fallar en ese caso.
- [E] `.github/workflows/ci.yml:41-44`: si `github.event.before` es ceros (primer push o push forzado) el check de compatibilidad se salta con un `echo`. ¿Es aceptable?
- [E] Nombres mixtos: `ClienteRegistrado.v1.schema.json` y `OfertaCreada.v1.schema.json` (PascalCase) frente a `booking.confirmed.v1.schema.json` (con puntos). ¿Son coherentes con `common/topologia.ts` y los consumidores?

### 2.4 Bajos

| ID | Hallazgo | Estado |
|---|---|---|
| B-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Bajo**

- [E] `common/schema-compat.ts:73`: añadir `additionalProperties: false` se marca como ruptura. ¿Es lo que se quiere?
- [E] ¿`docs/RDA2-docs/CONTRATOS-DE-EVENTOS.md` sigue coherente con la demostración de cambio incompatible que hace el script?

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

- `src/modules/vuelos/common/schema-compat.spec.ts`
- `src/modules/vuelos/common/event-schemas.spec.ts`
- `src/modules/vuelos/esb/rabbitmq.transport.spec.ts`
- `src/modules/vuelos/common/topologia.spec.ts`

### 5.2 Pruebas a repetir (sugeridas)

```bash
npx jest src/modules/vuelos/common/schema-compat.spec.ts src/modules/vuelos/common/event-schemas.spec.ts src/modules/vuelos/esb/rabbitmq.transport.spec.ts src/modules/vuelos/common/topologia.spec.ts
npm run contract:events:check
npm run contract:events:check -- 704956f^
npm run lint
npm run build
```

_Ejecutar solo cuando se corrijan los hallazgos que se transcriban; añadir aquí una prueba por hallazgo corregido._
