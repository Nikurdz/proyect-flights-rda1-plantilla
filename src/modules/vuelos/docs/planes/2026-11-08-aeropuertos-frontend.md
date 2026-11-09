# Entrega para Antigravity: pantalla «Aeropuertos» (back office)

- **Fecha:** 2026-11-08
- **De:** Claude Code Desktop (backend) **a:** Antigravity (frontend)
- **Rama:** `vuelos`

El catálogo ahora incluye los aeropuertos de Ecuador (Loja = `LOH`, Manta, Esmeraldas, San Cristóbal, etc.) y un administrador puede **crear nuevos códigos** tras una confirmación. El backend ya está implementado y probado (`/api/v1/admin/aeropuertos`, Bearer ADMIN, errores `application/problem+json`).

## API

| Acción | Llamada |
|---|---|
| Listar | `GET /admin/aeropuertos?q=&pais=&pagina=1&limite=25` → `{ items: [{ iata, ciudad, nombre, pais, paisNombre, zonaHoraria, vuelos }], total, pagina, limite }`. `q` busca por contenido en código, ciudad o nombre (sin tildes); `vuelos` = cuántos vuelos usan el aeropuerto |
| Crear | `POST /admin/aeropuertos` con `{ iata, ciudad, nombre, pais, paisNombre, zonaHoraria, confirmar: true }` → 201 con el aeropuerto |

Errores del alta: **422** si `confirmar` no es `true` (`invalidParams: confirmar`); **400** por código no de 3 letras, país no de 2 letras, textos vacíos o zona que no es IANA (`zonaHoraria`); **409** si el código ya existe. No hay edición ni borrado a propósito (los vuelos referencian el código).

## Pantalla `/admin/aeropuertos`
1. Pestaña «Aeropuertos» en `AdminLayout.tsx` y ruta dentro de `RequireAdmin`, con el estilo de `AdminUsersPage.tsx` (búsqueda con debounce, filtro por país, tabla paginada con código, ciudad, aeropuerto, país, zona horaria y número de vuelos).
2. Botón **«Nuevo aeropuerto»** → diálogo con el formulario (react-hook-form + zod en `admin-schemas.ts`): código IATA (3 letras, se pasa a mayúsculas), ciudad, nombre del aeropuerto, país (código de 2 letras y nombre; por defecto EC / Ecuador) y zona horaria (IANA, sugerir `America/Guayaquil` y `Pacific/Galapagos`; validar con `Intl.DateTimeFormat`).
3. **Confirmación obligatoria** antes de enviar: reutilizar `features/admin/ConfirmDialog.tsx` con un resumen (código, ciudad, aeropuerto, país, zona) y un aviso de que el código no se podrá borrar ni editar desde la web. Solo al confirmar se hace el `POST` con `confirmar: true`.
4. Mensajes de error en `admin-errors.ts` (nuevo contexto `crear-aeropuerto`): 409 «Ya existe un aeropuerto con ese código», 400 con el campo, 422 «Falta la confirmación».
5. Hooks en `api/endpoints/admin.ts` (`useAeropuertos`, `useCrearAeropuerto`, tipos a mano como el resto del back office). Al crear, **invalidar `['localidades']`** (el catálogo público tiene caché de 10 min) y la lista de aeropuertos.

## Zonas horarias (importante)
`frontend/src/lib/airports.ts` tiene un mapa fijo `TIME_ZONES`; un aeropuerto que no esté ahí se muestra en **UTC**. Hay que (a) añadir los aeropuertos de Ecuador nuevos y (b) completar el mapa con `zonaHoraria` de `GET /localidades` al cargar el catálogo (`api/endpoints/catalog.ts`), para que un aeropuerto creado por un administrador no se muestre en UTC. Ecuador continental: `America/Guayaquil`; Galápagos (GPS, SCY): `Pacific/Galapagos`.

## Catálogo público
`GET /localidades` sin `q` ahora devuelve **todos** los aeropuertos (hasta 200) en lugar de 10; el desplegable de «Crear vuelo» (`AdminFlightDialogs.tsx`) ya muestra todos. Con `q` sigue siendo búsqueda por prefijo y máximo 10. Con muchos aeropuertos, valorar un campo de búsqueda en ese desplegable.

## Pruebas
Siguiendo `frontend/tests/unit/admin-users-page.test.tsx`: lista y búsqueda, el diálogo de confirmación (no se hace `POST` hasta confirmar), el cuerpo con `confirmar: true`, los errores 409/400/422 y la invalidación de `['localidades']`. `npm run lint`, `tsc`, `npm run build` y `npm test` en `frontend/` en 0 errores.
