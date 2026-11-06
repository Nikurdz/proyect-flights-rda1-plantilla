# Plan de implementación: pantallas de mostrador (Reservas y Estado del vuelo)

- **Fecha:** 2026-11-05
- **Agente:** Antigravity
- **Área:** frontend
- **Rama:** `vuelos`

## Objetivo
Dar al administrador las pantallas del mostrador para las pruebas manuales con Booking (P-02, P-03, P-05, P-06, P-07, P-08), según `2026-11-05-mostrador-frontend.md`.

## Alcance
- Incluye: pestaña «Reservas» (`/admin/reservas`) con buscador, lista paginada, detalle, check-in, cotización y cancelación; acción «Estado» en la tabla de vuelos; capa de API tipada; tests de lógica pura y de página.
- No incluye: cambios en `src/`, entidades, migraciones ni contratos.

## Contexto y referencias
`GET /admin/reservas`, `GET /admin/reservas/{id}`, `POST .../check-in`, `GET .../cotizacion-cancelacion`, `POST .../cancelar` (Idempotency-Key), `PATCH /admin/vuelos/{id}/estado`. Las respuestas 200 no tienen esquema en `contracts/vuelos-ecommerce-openapi.yaml`; los tipos se declaran a mano (como los de usuarios) a partir de `reservas-admin.service.ts`.

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `frontend/src/api/endpoints/admin.ts` | Tipos y hooks de reservas y de estado de vuelo |
| `frontend/src/features/admin/reservas.ts` | Lógica pura: filtros a query, agrupación por travellerId, texto de errores |
| `frontend/src/features/admin/AdminReservationsPage.tsx` | Pantalla Reservas |
| `frontend/src/features/admin/AdminFlightDialogs.tsx`, `AdminFlightsPage.tsx`, `admin-schemas.ts` | Diálogo y botón «Estado» |
| `frontend/src/features/admin/admin-errors.ts` | Mensajes 409/400 de check-in, cancelación y estado |
| `AdminLayout.tsx`, `routes/index.tsx` | Pestaña y ruta |
| `frontend/tests/unit/*` | Tests |

## Impacto en la API / contrato
Ninguno.

## Pasos
1. Tipos/hooks. 2. Lógica pura + tests. 3. Pantalla Reservas. 4. Diálogo Estado. 5. Lint, build, tests.

## Riesgos y decisiones abiertas
- Los 200 sin esquema en el contrato: se reportan al backend.
- La lista de vuelos admin solo expone `estado` SCHEDULED/CANCELLED, no el estado operativo; el formulario deja elegir cualquiera y el servidor valida la transición.

## Verificación
`npm run lint`, `npm run build`, `npm test` en `frontend/`; prueba manual contra `npm run start:dev`.
