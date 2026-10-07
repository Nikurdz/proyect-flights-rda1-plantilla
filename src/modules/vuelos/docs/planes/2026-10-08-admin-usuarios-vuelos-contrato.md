# Plan de implementación: gestión de usuarios y de vuelos por el administrador, y contrato OpenAPI del sistema

- **Fecha:** 2026-10-08
- **Agente:** Claude Code Desktop (backend/contrato) y Antigravity (UI)
- **Área:** backend, frontend y documentación
- **Rama:** `vuelos`

## Objetivo
1. El administrador puede **crear usuarios** y **convertir a un usuario existente en administrador** (o quitarle el rol).
2. El administrador puede **crear, editar y eliminar vuelos** (además de cancelarlos y reprogramarlos, que ya existe).
3. Un **contrato OpenAPI (`.yaml`) de todo el sistema actual**, para futuras implementaciones API-first.

## Alcance
- Incluye: `GET/POST /admin/usuarios`, `GET /admin/usuarios/{id}`, `PUT /admin/usuarios/{id}/roles`; `POST /admin/vuelos`, `PATCH /admin/vuelos/{id}`, `DELETE /admin/vuelos/{id}`; auditoría de cada cambio (`ecom_auditoria_cambios`); páginas de administración de usuarios y de vuelos; `contracts/vuelos-ecommerce-openapi.yaml` generado desde la API real, con un script para regenerarlo y una prueba que lo mantiene al día.
- No incluye: borrar usuarios (se conserva el historial de órdenes; no hay baja lógica en esta fase), cambio de contraseña por el administrador, ni edición de la salida de un vuelo (eso es `reprogramar`).

## Reglas de negocio
- Los roles son `CUSTOMER` y `ADMIN`; todo usuario conserva `CUSTOMER`. Un administrador creado por otro administrador nace con correo verificado.
- No se puede quitar el rol ADMIN **a uno mismo** ni **al último administrador** (`409 LAST_ADMIN`).
- El rol viaja en el JWT: el cambio se aplica al **siguiente inicio de sesión** (el token vigente conserva sus roles hasta que expira, `JWT_TTL_SECONDS`).
- Crear vuelo: código `AA123`, aeropuertos existentes en el catálogo, origen distinto de destino, salida futura, capacidad 1–400; `409` si ya existe ese código a esa hora.
- Editar vuelo (aerolínea, precio base, duración, capacidad): solo vuelos programados y futuros; la capacidad no puede ser menor que los asientos ya vendidos ni dejar asientos numerados fuera de la cabina.
- Eliminar vuelo: solo si **nunca tuvo** retenciones, reservas ni asientos asignados; si los tiene, `409 FLIGHT_IN_USE` y se indica cancelarlo.

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `ecommerce/admin/usuarios.service.ts`, `usuarios.controller.ts` | Gestión de usuarios (ADMIN). |
| `ecommerce/admin/vuelos-admin.service.ts` y `admin.controller.ts` | Crear, editar y eliminar vuelos. |
| `ecommerce/admin/admin.dto.ts` | DTOs de las rutas nuevas. |
| `common/problem-details.exception.ts` | Códigos `LAST_ADMIN` y `FLIGHT_IN_USE`. |
| `scripts/export-openapi.js` y `contracts/vuelos-ecommerce-openapi.yaml` | Exportación del contrato desde `/api/docs-json`. |
| `testing/*.integration.spec.ts` | Pruebas de acceso (401/403), reglas y auditoría. |
| `frontend/` | Páginas «Usuarios» y gestión de vuelos. |

## Impacto en la API / contrato
Rutas nuevas solo de administración. El contrato `vuelos-openapi.yaml` (GDS) no cambia; el nuevo `vuelos-ecommerce-openapi.yaml` describe **todo** el sistema (GDS + e-commerce + administración).

## Riesgos y decisiones abiertas
- Un administrador degradado conserva su acceso hasta que venza su token.
- El contrato exportado es un reflejo de lo implementado; si cambia el código hay que regenerarlo (la prueba lo detecta).

## Verificación
`npm test` con `TEST_DATABASE_URL`, `npm run build`, pruebas del frontend y comprobación manual: crear un usuario, ascenderlo, iniciar sesión con él en el panel, crear y borrar un vuelo.
