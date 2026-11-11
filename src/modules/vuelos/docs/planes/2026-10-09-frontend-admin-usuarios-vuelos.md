# Plan de implementación: panel de administración, página Usuarios y gestión de vuelos (frontend)

- **Fecha:** 2026-10-09
- **Agente:** Antigravity
- **Área:** frontend
- **Rama:** `vuelos`

## Objetivo
Dar al administrador una interfaz para crear usuarios, ascender o quitar el rol de administrador, y crear, editar, reprogramar, cancelar y eliminar vuelos, conectada a las rutas ya implementadas en el backend (plan `2026-10-08-admin-usuarios-vuelos-contrato.md`).

## Alcance
- Incluye: pestaña y página `/admin/usuarios`; acciones de gestión en `AdminFlightsPage`; hooks de mutación en `api/endpoints/admin.ts`; esquemas zod; mensajes de error en español; pruebas unitarias.
- No incluye: cambios en backend, contrato o entidades; borrar usuarios; cambiar contraseñas.

## Contexto y referencias
- `GET/POST /admin/usuarios`, `PUT /admin/usuarios/{id}/roles` (409 `EMAIL_ALREADY_REGISTERED`, 409 `LAST_ADMIN`).
- `POST/PATCH/DELETE /admin/vuelos`, `POST /admin/vuelos/{id}/cancelar|reprogramar` (409 `CONFLICT`, 409 `FLIGHT_IN_USE`, 422 `VALIDATION_FAILED`).
- `GET /localidades` para el selector de origen y destino.
- El rol viaja en el JWT: el cambio de rol aplica al siguiente inicio de sesión; se avisa en la interfaz.

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `frontend/src/api/endpoints/admin.ts` | Tipos y hooks: `useAdminUsuarios`, `useCrearUsuario`, `useCambiarRoles`, `useCrearVuelo`, `useEditarVuelo`, `useEliminarVuelo`, `useCancelarVuelo`, `useReprogramarVuelo` (con `Idempotency-Key` y refresco de la lista). |
| `frontend/src/features/admin/admin-schemas.ts` | Esquemas zod de usuario, vuelo nuevo, edición y reprogramación. |
| `frontend/src/features/admin/AdminUsersPage.tsx` | Tabla con búsqueda con debounce, filtro por rol, paginación, insignias, crear usuario, ascender/quitar con confirmación. |
| `frontend/src/features/admin/AdminFlightsPage.tsx` | Botón «Nuevo vuelo» y acciones Editar, Reprogramar, Cancelar vuelo, Eliminar con confirmación. |
| `frontend/src/features/admin/AdminFlightDialogs.tsx` | Diálogos de formulario y de confirmación de vuelos. |
| `frontend/src/features/admin/AdminLayout.tsx`, `routes/index.tsx` | Pestaña y ruta «Usuarios». |
| `frontend/src/api/problem-details.ts`, `components/common/ProblemAlert.tsx` | Mensajes para `LAST_ADMIN` y `FLIGHT_IN_USE`; propiedad opcional `message` para textos por contexto. |
| `frontend/tests/unit/admin-schemas.test.ts`, `admin-users-page.test.tsx` | Pruebas. |

## Impacto en la API / contrato
Ninguno. Solo se consumen rutas ya implementadas.

## Pasos
1. Hooks y tipos de API.
2. Esquemas zod y pruebas.
3. Página Usuarios, pestaña y ruta.
4. Gestión de vuelos.
5. `npm run build` y `npm test`; comprobación contra el backend si está en ejecución.

## Riesgos y decisiones abiertas
- El `AdminVueloViewDto` no trae el estado del vuelo; las acciones sobre vuelos ya cancelados o salidos responden 409 y se muestra el mensaje.
- El esquema de la API tipada (`schema.d.ts`) no incluye las rutas nuevas; los tipos se declaran a mano en `admin.ts` hasta regenerarlo.

## Verificación
`cd frontend && npm run build && npm test`. Terminado cuando ambos pasan y las pruebas cubren los esquemas y la regla de no quitarse el rol a uno mismo.
