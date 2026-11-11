# Plan de implementación: pantalla de administración «Aeropuertos» y zonas horarias

- **Fecha:** 2026-11-08
- **Agente:** Antigravity
- **Área:** frontend
- **Rama:** `vuelos`

## Objetivo
Dar al administrador una pantalla para ver el catálogo de aeropuertos y crear códigos nuevos tras una confirmación explícita, y evitar que un aeropuerto sin zona conocida se muestre en UTC.

## Alcance
- Incluye: ruta `/admin/aeropuertos` (solo ADMIN) y pestaña; lista paginada con búsqueda y filtro de país; formulario validado + ConfirmDialog; hooks; mensajes de error; zonas horarias de Ecuador y mapa dinámico desde `GET /localidades`; pruebas.
- No incluye: backend, contratos, edición o borrado de aeropuertos (no existen a propósito), librerías nuevas.

## Contexto y referencias
Especificación: `docs/planes/2026-11-08-aeropuertos-frontend.md`. Endpoints `GET/POST /api/v1/admin/aeropuertos` (Bearer ADMIN, `application/problem+json`). Patrón: `AdminUsersPage.tsx`, `ConfirmDialog.tsx`.

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `frontend/src/api/endpoints/admin.ts` | Tipos `AdminAeropuerto*`, `useAeropuertos`, `useCrearAeropuerto` (invalida `['admin-aeropuertos']` y `['localidades']`) |
| `frontend/src/features/admin/admin-schemas.ts` | `newAirportSchema` (IATA, país, zona IANA vía `Intl.DateTimeFormat`) |
| `frontend/src/features/admin/admin-errors.ts` | Contexto `crear-aeropuerto` (409, 400, 422) |
| `frontend/src/features/admin/AdminAirportsPage.tsx` | Pantalla nueva |
| `frontend/src/features/admin/AdminLayout.tsx`, `routes/index.tsx` | Pestaña y ruta |
| `frontend/src/lib/airports.ts` | Zonas de Ecuador, `registerTimeZones` |
| `frontend/src/api/endpoints/catalog.ts` | Completa el mapa con `zonaHoraria` al cargar el catálogo |
| `frontend/tests/unit/admin-airports-page.test.tsx`, `airports-timezones.test.ts` | Pruebas |

## Impacto en la API / contrato
Ninguno. Se consume lo existente. El `POST` no exige `Idempotency-Key` (el 409 cubre el reintento).

## Pasos
1. Hooks y tipos. 2. Esquema y errores. 3. Página con diálogo de formulario y ConfirmDialog (el POST solo tras confirmar, con `confirmar: true`). 4. Ruta y pestaña. 5. Zonas horarias. 6. Pruebas, lint, tsc, build.

## Riesgos y decisiones abiertas
- El mapa de zonas es un objeto de módulo: se completa al cargar el catálogo; los componentes ya montados no se redibujan, pero el catálogo se carga antes de mostrar horas.
- La validación IANA del navegador es la primera barrera; el backend decide en última instancia (400 `zonaHoraria`).

## Verificación
`npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm test` en `frontend/` en 0 errores; prueba manual contra `npm run start:dev`.
