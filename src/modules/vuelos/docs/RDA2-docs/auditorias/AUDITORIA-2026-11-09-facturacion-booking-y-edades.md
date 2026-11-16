# Auditoría — Conciliación de facturas de Booking, validaciones de edad y jóvenes (yth) — 2026-11-09

> Estado: **por transcribir**. Archivo preparado con datos de git y comprobaciones sugeridas; los hallazgos están vacíos a propósito.

- **Plan:** 
  - [`2026-11-09-facturacion-booking-y-edades.md`](../../planes/2026-11-09-facturacion-booking-y-edades.md) — Plan principal
  - [`2026-11-09-facturacion-booking-ui.md`](../../planes/2026-11-09-facturacion-booking-ui.md) — Plan menor fusionado (diseño de pantallas)
  - [`2026-11-09-facturacion-booking-frontend.md`](../../planes/2026-11-09-facturacion-booking-frontend.md) — Plan menor fusionado (frontend)
  - [`2026-11-09-edades-ui.md`](../../planes/2026-11-09-edades-ui.md) — Plan menor fusionado (diseño de pantallas)
  - [`2026-11-09-edades-frontend.md`](../../planes/2026-11-09-edades-frontend.md) — Plan menor fusionado (frontend)
- **Fecha del plan:** 2026-11-09
- **Objetivo del plan:** Mostrar las ventas de un socio como líneas de factura de solo lectura (IVA propio frente al de Booking, nota de crédito derivada, resumen y CSV) y endurecer las reglas de edad del pasajero en backend y frontend, con el contador de Jóvenes (yth).
- **Commits auditados:** 3 (fecha y hora del autor en git, hora local -05:00; estadísticas de `git show --shortstat`).

  | Commit | Fecha | Asunto | Archivos | Inserciones | Borrados |
  |---|---|---|---|---|---|
  | `bee820a` | 2026-11-09 07:19 | Add the Booking invoice reconciliation and stricter passenger age checks | 15 | 877 | 7 |
  | `9bffe5a` | 2026-11-09 07:24 | Add the Booking reconciliation tab and passenger age validations (frontend) | 28 | 1390 | 73 |
  | `9456d84` | 2026-11-09 07:40 | Teach availability and fares about youths (yth) | 10 | 152 | 10 |

- **Archivos principales tocados** (reales de git, agrupados; recortados si hay muchos):

- **Backend** (10): `src/modules/vuelos/common/business-rules.ts`, `src/modules/vuelos/ecommerce/admin/admin.module.ts`, `src/modules/vuelos/ecommerce/admin/booking-conciliacion.controller.ts`, `src/modules/vuelos/ecommerce/admin/booking-conciliacion.dto.ts`, `src/modules/vuelos/ecommerce/admin/booking-conciliacion.service.ts`, `src/modules/vuelos/ecommerce/admin/reservas-admin.service.ts`, `src/modules/vuelos/ecommerce/ofertas/ofertas.service.ts`, `src/modules/vuelos/services/bookings.service.ts`, `src/modules/vuelos/ecommerce/catalogo/catalogo.service.ts`, `src/modules/vuelos/ecommerce/catalogo/dto/catalogo.dto.ts`
- **Frontend** (21): `frontend/src/api/endpoints/facturacion-booking.ts`, `frontend/src/api/problem-details.ts`, `frontend/src/features/account/RegisterPage.tsx`, `frontend/src/features/account/registration-schema.ts`, `frontend/src/features/admin/AdminBookingBillingPage.tsx`, `frontend/src/features/admin/AdminInvoicesPage.tsx`, `frontend/src/features/admin/AdminLayout.tsx`, `frontend/src/features/admin/BillingTabs.tsx`, `frontend/src/features/admin/admin-errors.ts`, `frontend/src/features/checkout/PassengerForm.tsx`, `frontend/src/features/checkout/passenger-schema.ts`, `frontend/src/features/results/ResultsPage.tsx`, `frontend/src/features/search/HomePage.tsx`, `frontend/src/features/search/PassengerSelector.tsx` … y 7 más
- **Pruebas** (12): `src/modules/vuelos/common/business-rules.spec.ts`, `src/modules/vuelos/testing/admin-facturacion-booking.integration.spec.ts`, `frontend/tests/unit/admin-booking-billing-page.test.tsx`, `frontend/tests/unit/admin-invoices-page.test.tsx`, `frontend/tests/unit/passenger-rules.test.ts`, `frontend/tests/unit/passenger-schema.test.ts`, `frontend/tests/unit/passenger-selector.test.tsx`, `frontend/tests/unit/problem-details-age.test.ts`, `frontend/tests/unit/registration.test.ts`, `frontend/tests/unit/search.test.ts`, `frontend/tests/unit/catalog-yth.test.ts`, `src/modules/vuelos/testing/jovenes.integration.spec.ts`
- **Docs** (6): `CLAUDE.md`, `src/modules/vuelos/docs/planes/2026-11-09-edades-frontend.md`, `src/modules/vuelos/docs/planes/2026-11-09-facturacion-booking-frontend.md`, `src/modules/vuelos/docs/planes/2026-11-09-facturacion-booking-y-edades.md`, `src/modules/vuelos/docs/planes/2026-11-09-edades-ui.md`, `src/modules/vuelos/docs/planes/2026-11-09-facturacion-booking-ui.md`
- **Contratos** (1): `contracts/vuelos-ecommerce-openapi.yaml`

- **Alcance:**
  - **Incluye:** GET /admin/facturacion-booking, /resumen, /export.csv; fecha de nacimiento futura, tipo de pasajero en el último vuelo, cédula; passenger-rules.ts, PassengerForm, PassengerSelector; yth en disponibilidad y tarifas.
  - **No incluye:** Emisión de facturas y datos fiscales.
- **Método:** pendiente de transcribir. Marcas de la leyenda:
  - **[V]** releído en el código por quien audita.
  - **[E]** procede de una exploración y no se releyó.
  - **[observado]** visto al ejecutar o usar el sistema.
  - **[confirmado en producción]** comprobado contra el despliegue real.
- **No cubierto:** pruebas de penetración, carga, accesibilidad completa, configuración real de los servicios externos (Azure, Aiven, Netlify, GHCR), contenido de `.env` y `.env.azure`.
- **Por verificar** (dudas o contradicciones que los informes dejaron abiertas; no son hechos):
  - Que el IVA de Booking (15 % incluido) es el que realmente aplica su facturación: dato de Booking, no verificable en este repositorio.

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

- [E] ¿El CSV de conciliación trunca a 5000 sin avisar? `ecommerce/admin/booking-conciliacion.service.ts:89` (`take(CAP)`), sin campo `truncado` (la vista sí lo tiene en `:67`): una exportación contable podría faltar ventas sin señal.

### 2.2 Altos

| ID | Hallazgo | Estado |
|---|---|---|
| A-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Alto**

- [E] ¿La edad de referencia usa el día UTC del vuelo? `frontend/src/lib/passenger-rules.ts:39` (`new Date(salida).toISOString().slice(0,10)`) y `common/business-rules.ts:104-110` (campos UTC): un vuelo a las 20:00 de Ecuador es 01:00 UTC del día siguiente, y un cumpleaños de ese día puede salir mal. Coherente entre front y back, pero contrario a la hora de Ecuador del resto del sistema.
- [E] ¿`lastFlightDate` es opcional en `assertPassengerTypeMatchesAge`? `business-rules.ts:147`. Comprobar que todas las rutas (v1, v2, web) pasan el último vuelo.

### 2.3 Medios

| ID | Hallazgo | Estado |
|---|---|---|
| M-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Medio**

- [E] ¿La tolerancia `Math.max(1, pax*legs)` oculta diferencias de céntimos acumulados? `booking-conciliacion.service.ts:138`; el redondeo del esperado (`:135`) y el de Booking (`:136`) son distintos.
- [E] ¿Acepta la cédula la provincia 30 para ecuatorianos nacidos en el extranjero? `business-rules.ts:236` (es diseño, conviene confirmarlo).
- [E] ¿«Hoy» en frontend es día de Ecuador y en backend UTC? `passenger-rules.ts:74` frente a `business-rules.ts:34`: desfase de unas horas al día (plan, Riesgos).

### 2.4 Bajos

| ID | Hallazgo | Estado |
|---|---|---|
| B-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | por transcribir |

**Qué revisar (comprobaciones, no hallazgos) — nivel Bajo**

- [E] ¿`csvField` neutraliza fórmulas? `reservas-admin.service.ts:42-45` sí, y deja los números intactos.
- [E] ¿Los importes `null` de ventas antiguas se muestran como «—»? (plan, Riesgos; no verificado en la pantalla).

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

- `src/modules/vuelos/testing/admin-facturacion-booking.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/testing/jovenes.integration.spec.ts` (integración: requiere `TEST_DATABASE_URL`)
- `src/modules/vuelos/common/business-rules.spec.ts`
- `frontend/tests/unit/passenger-rules.test.ts`
- `frontend/tests/unit/passenger-selector.test.tsx`
- `frontend/tests/unit/passenger-schema.test.ts`
- `frontend/tests/unit/problem-details-age.test.ts`
- `frontend/tests/unit/admin-booking-billing-page.test.tsx`
- `frontend/tests/unit/catalog-yth.test.ts`
- `frontend/tests/unit/registration.test.ts`

### 5.2 Pruebas a repetir (sugeridas)

```bash
npx jest src/modules/vuelos/common/business-rules.spec.ts
# requiere TEST_DATABASE_URL apuntando a una base desechable (p. ej. booking_test)
npx jest src/modules/vuelos/testing/admin-facturacion-booking.integration.spec.ts src/modules/vuelos/testing/jovenes.integration.spec.ts
cd frontend && npx vitest run tests/unit/passenger-rules.test.ts tests/unit/passenger-selector.test.tsx tests/unit/passenger-schema.test.ts tests/unit/problem-details-age.test.ts tests/unit/admin-booking-billing-page.test.tsx tests/unit/catalog-yth.test.ts tests/unit/registration.test.ts
npx vitest run  (en frontend/, suites de edades y facturación)
npm run lint
npm run build
```

_Ejecutar solo cuando se corrijan los hallazgos que se transcriban; añadir aquí una prueba por hallazgo corregido._
