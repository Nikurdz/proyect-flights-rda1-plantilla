# Plan de implementación: Dashboard del administrador (frontend)

- **Fecha:** 2026-10-08
- **Agente:** Antigravity
- **Área:** frontend
- **Rama:** `vuelos`

## Objetivo
Página «Dashboard» en el panel admin con KPIs y gráficas de negocio, primera opción del menú y página por defecto de `/admin`.

## Alcance
- Incluye: ruta `/admin/dashboard`, hook `useAdminDashboard`, helpers puros de formateo/transformación, gráficas SVG propias (sin dependencias nuevas), tests unitarios y de render.
- No incluye: cambios de backend ni del contrato (el endpoint `GET /admin/dashboard?dias=7|30|90` ya existe, ver `2026-10-07-dashboard-admin.md`).

## Contexto y referencias
Endpoint solo ADMIN; dinero `*Minor` en centavos enteros (se convierte a USD solo para mostrar), `topRutas.ingresos` ya viene en USD. Errores `application/problem+json` mostrados con `ProblemAlert`.

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `frontend/src/api/endpoints/admin.ts` | Tipos `AdminDashboard` y hook `useAdminDashboard(dias, ownerId)` con refresco de 60 s sin pestaña en segundo plano |
| `frontend/src/lib/dashboard.ts` | Helpers: centavos a USD, porcentaje nulo a «—», etiquetas, escalas, resumen aria |
| `frontend/src/features/admin/dashboard/charts.tsx` | Gráficas SVG: área, barras agrupadas, barras horizontales, dona; `role="img"`, `aria-label`, `<details>` con tabla, tooltips por foco/ratón |
| `frontend/src/features/admin/AdminDashboardPage.tsx` | Página |
| `frontend/src/features/admin/AdminLayout.tsx`, `routes/index.tsx` | Pestaña Dashboard primera; índice redirige a `dashboard` |
| `frontend/tailwind.config.js` | Sin cambios |
| `frontend/tests/unit/dashboard.test.ts`, `dashboard-page.test.tsx` | Tests |

## Impacto en la API / contrato
Ninguno.

## Pasos
1. Tipos, hook y helpers.
2. Componentes de gráficas accesibles.
3. Página (selector 7/30/90, actualizar, skeleton, error, vacío).
4. Ruta y menú.
5. Tests, build.

## Riesgos y decisiones abiertas
- Se evita `recharts` (peso y menor control de accesibilidad); SVG propio basta para 4 tipos de gráfica.
- Animaciones solo con `motion-safe`.
- Los estados de enumeración desconocidos se muestran tal cual.

## Verificación
`cd frontend && npm run build` y `npm test` sin errores.
