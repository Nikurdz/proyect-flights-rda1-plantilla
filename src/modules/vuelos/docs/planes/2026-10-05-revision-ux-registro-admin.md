# Plan de implementación: Revisión UX/UI, registro de usuarios, panel admin, USD-only y seed amplio

- **Fecha:** 2026-10-05
- **Agente:** Claude Code Desktop (backend/BD) con revisión UX/UI del frontend
- **Área:** backend + base de datos + frontend
- **Rama:** `vuelos`

## Objetivo
Corregir y completar el frontend base entregado por Antigravity y alinear el backend: permitir que el usuario cree una cuenta, impedir que alguien que no sea administrador vea reservas ajenas (y dar al administrador una vista), mostrar mensajes amables cuando no hay vuelos, crear el footer y las páginas de transparencia/condiciones, vender solo en USD y ampliar los datos de la base.

## Alcance
- **Incluye:**
  - Marca original **RAM Alliance** (formal, sin beneficios ni millas inventados) en lugar de "Star Alliance"; estilo inspirado en la referencia (cabecera negra, acento dorado, tipografía sans, footer en columnas), sin copiar logo ni textos.
  - Registro de usuario (`/registro`), verificación de correo (`/verificar-correo`), perfil y preferencias.
  - Sesión: distinguir invitado / cliente / admin; limpiar caché al salir; manejo de 401.
  - Panel admin (backend `GET /admin/ordenes`, `/admin/ordenes/:numero`, `/admin/vuelos`; front `/admin/*`).
  - Resultados sin vuelos y errores sin texto técnico.
  - Footer y páginas Términos, Privacidad, Condiciones de transporte, Transparencia y Ayuda.
  - Solo USD (mercado `ec`; `co` se desactiva).
  - Seed amplio: ~30 rutas con ida y vuelta, 6 aerolíneas.
- **No incluye:** postventa, check-in, mapa de asientos, pasarela real, correo real (el canal sigue simulado), i18n.

## Contexto y referencias
- Plan del frontend base: `2026-10-05-frontend-vuelos-ux-ui.md`.
- Roles: `AGENTES.md`. Auditoría: `AUDITORIA-VUELOS-10-4-2026(1).md`.
- Código: `ecommerce/identidad/`, `ecommerce/ordenes/`, `ecommerce/seed/`, `seed/flights.seed.ts`, `frontend/src/`.

## Cambios previstos
| Archivo / módulo | Cambio |
|---|---|
| `ecommerce/seed/ecommerce.seed.ts` | Quitar mercado `co`; desactivar mercados no USD; más localidades |
| `seed/flights.seed.ts` | Calendario ampliado (rutas, aerolíneas, frecuencias, precios por día) |
| `ecommerce/admin/*` (nuevo) | Controlador y servicio de admin (órdenes y vuelos) |
| `migrations/` | Índice `IDX_ecom_ordenes_creada` |
| `testing/*.spec.ts` | Tests de admin (401/403/200) y USD |
| `frontend/src/**` | Marca, layout, sesión, registro, admin, legal, errores, USD |

## Impacto en la API / contrato
Se **añaden** rutas `/admin/ordenes`, `/admin/ordenes/:numero`, `/admin/vuelos` (solo rol ADMIN). El resto no cambia. El mercado `co` queda inactivo (422 `MARKET_NOT_AVAILABLE`).

## Pasos de implementación
1. Backend: USD-only y seed amplio. 2. Admin y migración con tests. 3. Frontend base (marca, tokens, layout, sesión, errores, USD). 4. Registro/verificación/perfil. 5. Resultados y vacíos. 6. Legal y footer. 7. Panel admin. 8. Pruebas y revisión visual.

## Riesgos y decisiones abiertas
- El correo es simulado: la verificación no bloquea login ni compra.
- Las filas de vuelos ya sembradas no se actualizan (seed `orIgnore`); los nuevos vuelos se añaden.
- El contenido legal es de un prototipo académico, no asesoría legal.

## Verificación
`npm test`, `npm run build`, `migration:check:vuelos`, build y tests del front, revisión visual en navegador (escritorio y 375 px).
