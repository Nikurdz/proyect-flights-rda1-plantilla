# frontend/src — código de la SPA: arranque, rutas, pantallas y utilidades

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `main.tsx` | Monta React (`StrictMode`), carga la fuente Instrument Sans y `styles/index.css` |
| `App.tsx` | Proveedores: `ThemeProvider` → `QueryClientProvider` → `ToastProvider` → `BrowserRouter` → `AppRoutes` |
| `api/` | Cliente HTTP, endpoints por dominio, errores y tipos → [api/README.md](api/README.md) |
| `components/` | Componentes `ui/`, `common/` y `layout/` → [components/README.md](components/README.md) |
| `features/` | Una carpeta por pantalla o dominio → [features/README.md](features/README.md) |
| `hooks/` | Hooks propios → [hooks/README.md](hooks/README.md) |
| `lib/` | Funciones puras y estado de sesión/tema → [lib/README.md](lib/README.md) |
| `routes/` | Tabla de rutas y guardas → [routes/README.md](routes/README.md) |
| `styles/` | Tokens CSS, tema claro/oscuro → [styles/README.md](styles/README.md) |

## Cómo se conecta

`App.tsx` → `routes/index.tsx` (layout con `Header`, `WakeUpBanner`, `Footer`) → página de `features/*` → hooks de TanStack Query en `api/endpoints/*` → `api/client.ts` → `/api/v1`. Regla de dependencias: `features` usa `components`, `lib`, `hooks` y `api`; `lib` no importa de `features`.

## Cuaderno y auditorías

Rediseño premium + Nielsen: [plan 2026-11-13](../../src/modules/vuelos/docs/planes/2026-11-13-rediseno-frontend-nielsen.md) y [HEURISTICAS-NIELSEN.md](../../src/modules/vuelos/docs/RDA2-docs/HEURISTICAS-NIELSEN.md).

## Más a fondo

[routes/README.md](routes/README.md) · [features/README.md](features/README.md) · [Auditorías](../../src/modules/vuelos/docs/RDA2-docs/auditorias/README.md)

← Volver a [frontend/README.md](../README.md)
