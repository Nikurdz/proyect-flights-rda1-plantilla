# Plan de implementación: frontend de proveedores, facturación, auditoría, salud de nodos y experiencias

- **Fecha:** 2026-10-25
- **Agente:** Antigravity
- **Área:** frontend
- **Rama:** `vuelos`

## Objetivo
Dar al administrador las consolas de Proveedores (semáforo, kill-switch, sincronización), Facturación, Auditoría (transacciones y sagas por GraphQL) y Salud de nodos, y al cliente la sección Experiencias (catálogo, reserva pagada con token de la pasarela simulada, «Mis experiencias» con cancelación), conectado a las rutas que el backend ya expone.

## Alcance
- Incluye: pestañas `/admin/proveedores`, `/admin/facturacion`, `/admin/auditoria`, `/admin/salud`; rutas `/experiencias`, `/experiencias/:id`, `/mis-experiencias`; tarjeta de proveedores caídos en el dashboard; cliente GraphQL mínimo (`fetch`) que reutiliza token y manejo de errores del cliente REST; tipos escritos a mano en `src/api/types.ts`; mensajes de error en español; pruebas de vitest.
- No incluye: cambios de backend, entidades, migraciones ni contrato; captura de número de tarjeta (el pago usa tokens `tok_*` como el checkout de vuelos); suscripciones GraphQL (websocket); regenerar `schema.d.ts`.

## Contexto y referencias
- REST (prefijo `api/v1`, `application/problem+json`): `GET/POST /admin/proveedores`, `PATCH/DELETE /admin/proveedores/{id}`, `POST .../ping`, `POST .../sincronizar`, `GET .../salud`, `GET /admin/proveedores/reservas/todas`, `GET /admin/facturas`, `GET /admin/facturas/{numero}`, `GET /experiencias`, `GET /experiencias/{id}`, `POST /experiencias/{id}/reservas` (Idempotency-Key), `GET /reservas-externas`, `POST /reservas-externas/{id}/cancelar` (Idempotency-Key), `GET /mercados/ec` (tipos de identificación fiscal).
- GraphQL (`POST /graphql`, fuera del prefijo `api/v1`): `auditoriaTransacciones`, `auditoriaSagas`; los errores traen `errors[0].extensions.code`.
- Código fuente de referencia (solo lectura): `integracion.controller.ts`, `integracion.dto.ts`, `facturacion-admin.controller.ts`, `gateway.resolver.ts`, `gateway.types.ts`.

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `frontend/src/api/types.ts` | Tipos a mano: `ProveedorView`, `SaludView`, `SincronizacionView`, `FacturaAdmin*`, `Experiencia*`, `ReservaExternaView`, `AuditoriaTransaccion`, `AuditoriaSaga`, `SagaPaso`. |
| `frontend/src/api/graphql.ts` | Cliente GraphQL mínimo: URL derivada de la base REST (o `VITE_GRAPHQL_URL`), Bearer del almacén, 401 → `endSession`, errores GraphQL → `ProblemDetailsError` con `extensions.code`/`status`. |
| `frontend/src/api/endpoints/proveedores.ts` | Hooks de proveedores (lista con refresco de 30 s, crear, editar/apagar, eliminar, ping, sincronizar, historial de salud). |
| `frontend/src/api/endpoints/facturas.ts`, `auditoria.ts` | Hooks de facturas y de auditoría (GraphQL). |
| `frontend/src/api/endpoints/experiencias.ts` | Hooks de catálogo, detalle, reservar, mis reservas, cancelar. |
| `frontend/src/lib/proveedores.ts` | Lógica pura: estado → semáforo (color + texto), circuito, formato de latencia, series de latencia, resumen de sincronización. |
| `frontend/src/lib/auditoria.ts`, `lib/experiencias.ts` | Lógica pura: tono de estado de saga, duración, validación de la reserva. |
| `frontend/src/features/admin/AdminProvidersPage.tsx` (+ `provider-schemas.ts`, `LedStatus.tsx`) | Página de proveedores. |
| `frontend/src/features/admin/AdminInvoicesPage.tsx`, `AdminAuditPage.tsx`, `AdminNodesHealthPage.tsx` (+ `LatencyChart.tsx`) | Facturación, Auditoría, Salud de nodos. |
| `frontend/src/features/admin/AdminLayout.tsx`, `AdminDashboardPage.tsx`, `admin-errors.ts` | Pestañas nuevas, tarjeta de proveedores caídos, mensajes por contexto. |
| `frontend/src/features/experiences/*` | `ExperiencesPage`, `ExperienceDetailPage`, `ReservationForm`, `MyExperiencesPage`. |
| `frontend/src/routes/index.tsx`, `components/layout/Header.tsx` | Rutas nuevas y enlace «Experiencias» en la navegación principal. |
| `frontend/src/api/problem-details.ts` | Mensajes de los códigos nuevos (`PROVIDER_*`, `EXTERNAL_RESERVATION_*`). |
| `frontend/vite.config.ts`, `frontend/.env.example` | Proxy de `/graphql` en desarrollo y `VITE_GRAPHQL_URL` opcional. |
| `frontend/README.md` | Pantallas nuevas. |
| `frontend/tests/unit/*` | Pruebas de la lógica nueva y de la página de proveedores. |

## Impacto en la API / contrato
Ninguno. Solo se consumen rutas ya implementadas. Dependencia operativa: el origen del frontend desplegado debe estar en `CORS_ORIGINS` también para `POST /graphql` (cabeceras `Authorization` y `Content-Type`); se verifica contra el backend en ejecución.

## Pasos
1. Tipos, cliente GraphQL, hooks y lógica pura con pruebas.
2. Admin: Proveedores, Facturación, Auditoría, Salud de nodos, pestañas, rutas y tarjeta del dashboard.
3. Cliente: Experiencias, detalle, reserva y «Mis experiencias», enlace en la cabecera.
4. `npm run lint`, `npm run build`, `npm test` en `frontend/`.
5. Comprobación contra el backend en ejecución (`npm run start:dev`) si está disponible.

## Riesgos y decisiones abiertas
- `/graphql` no lleva el prefijo `api/v1`: su URL se deriva quitando `/api/v1` de la base REST; en desarrollo se añade el proxy de Vite.
- El historial de salud no trae una marca de «nodo»: se pide por proveedor (`GET /admin/proveedores/{id}/salud`) al elegir uno.
- `GET /admin/proveedores/reservas/todas` queda sin pantalla propia salvo que sobre tiempo (no se pidió); se deja el hook.
- La sincronización de proveedores AUTOS/ALOJAMIENTOS responde 422 por diseño: se explica en la interfaz, no es un error.
- Sin acceso a la base de datos: los datos de prueba dependen de lo que haya sembrado el backend.

## Verificación
`cd frontend && npm run lint && npm run build && npm test`. Terminado cuando los tres pasan, las pruebas cubren el mapeo a semáforo y las validaciones de los formularios, y las llamadas se han comprobado contra el backend en ejecución (o se informa que no estaba disponible).
