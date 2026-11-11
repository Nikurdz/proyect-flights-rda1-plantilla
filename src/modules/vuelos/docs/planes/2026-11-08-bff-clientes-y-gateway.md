# Plan de implementación: BFF por cliente y API Gateway local

- **Fecha:** 2026-11-08
- **Agente:** Claude Code Desktop
- **Área:** backend/BD (sin cambios de esquema) + infraestructura local
- **Rama:** `vuelos`

## Objetivo
Dar a cada cliente (móvil, web, administrador) la forma de respuesta de la Orden que necesita (móvil: tamaño; web: experiencia completa; admin: completitud y auditoría) y poner en un API Gateway local (Kong DB-less) las reglas de borde: JWT, límite de peticiones, tamaño/tipo de cuerpo y formato de `Idempotency-Key`. Booking ya tiene su vista en el contrato v2 y no cambia.

## Alcance
- Incluye: módulo `ecommerce/bff` (solo lectura), helper de enmascarado, opción `conEstadoVuelo` en `OrdenesService`, `deploy/gateway/kong.yml`, perfil `gateway` en `docker-compose.yml`, `scripts/gateway-smoke.js`, documentación y contrato OpenAPI regenerado.
- No incluye: despliegue de Kong en Railway/Azure, cambios en el frontend, migraciones, cambios en sagas, eventos o contrato v2.

## Contexto y referencias
- Reglas ya en el dominio (no se tocan): propiedad (`obtenerPropia`, 404 a ajenos), penalidades (`postsale-rules.ts`), idempotencia (`IdempotencyService`).
- Reglas de borde sin gateway hasta hoy: `RDA2-docs/MAPEO-GUIA-RDA2.md` fila 8.
- Límite global actual de la API: 300/min por IP (`global-rate-limit.middleware.ts`); Kong usa el mismo valor.

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `ecommerce/bff/*` | Controladores `movil/ordenes`, `web/ordenes`, `admin/ordenes/:numero/expediente`; servicio de composición por lotes; helpers puros `acciones.ts`, `mapeos.ts` |
| `ecommerce/common/enmascarar.ts` | Enmascarado de correo y teléfono |
| `ecommerce/ordenes/ordenes.service.ts` | Opción `conEstadoVuelo` (sin ella la salida es idéntica) |
| `ecommerce/ecommerce.module.ts` | Importa `BffModule` |
| `deploy/gateway/kong.yml`, `docker-compose.yml` | Kong DB-less bajo el perfil `gateway` |
| `scripts/gateway-smoke.js`, `package.json` | `npm run gateway:smoke` |
| `contracts/vuelos-ecommerce-openapi.yaml` | Regenerado |

## Impacto en la API / contrato
Rutas nuevas, solo GET, en `/api/v1`: `movil/ordenes`, `movil/ordenes/{numero}`, `web/ordenes/{numero}`, `admin/ordenes/{numero}/expediente`. Ninguna ruta ni esquema existente cambia; `contracts/vuelos-openapi.yaml` y el contrato v2 no se tocan.

## Pasos
1. Helpers puros con pruebas unitarias.
2. `BffModule` y rutas; opción `conEstadoVuelo`.
3. Prueba de integración (propiedad, roles, contacto enmascarado, correlación).
4. Kong y script de humo.
5. Documentación y regeneración del contrato.

## Riesgos y decisiones abiertas
- Romper respuestas existentes: se evita con rutas nuevas y una opción que por defecto no cambia nada.
- Fuga de datos: el BFF reutiliza `obtenerPropia` y `RolesGuard`; el contacto del admin va siempre enmascarado y el móvil no lo incluye.
- Trazabilidad: los tres controladores usan `ProblemController` (correlación y métricas); Kong genera `X-Correlation-Id` con un formato aceptado por `resolveCorrelationId`.
- Kong solo local por decisión del equipo; en producción las reglas siguen dentro de la API.

## Verificación
Lint y build sin errores; pruebas unitarias y de integración (`TEST_DATABASE_URL`); `npm test` completo; `kong config parse` y `npm run gateway:smoke` contra Kong local. Terminado cuando todo está en verde y `docker compose up -d` sin perfil sigue levantando solo Postgres.
