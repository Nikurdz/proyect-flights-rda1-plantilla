# frontend/ — SPA de venta de vuelos RAM Alliance (React 18 + Vite 6 + Tailwind)

Consume la API NestJS (`/api/v1`) y no guarda secretos. Pagos y correos **simulados**. Solo **USD** (`src/lib/market.ts`).

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `src/` | Todo el código de la app → [src/README.md](src/README.md) |
| `tests/` | Pruebas Vitest (`tests/unit`) → [tests/README.md](tests/README.md) |
| `scripts/contrast.mjs` | Comprueba el contraste WCAG de cada par de tokens de `src/styles/index.css` |
| `public/` | `favicon.svg` y `_redirects` (reescribe todo a `index.html`: SPA en Netlify) |
| `index.html` | Punto de entrada; aplica el tema antes del primer pintado |
| `vite.config.ts` | Proxy de desarrollo (`/api`, `/graphql` → `VITE_BACKEND_TARGET`) |
| `tailwind.config.js`, `postcss.config.js` | Tokens `ink/gold/paper/surface/line` y puente `slate-*`/`brand-*` |
| `eslint.config.js`, `tsconfig*.json` | Lint (jsx-a11y strict) y TypeScript |
| `.env.example` | Plantilla de variables de entorno |

## Variables de entorno

| Variable | Uso |
|---|---|
| `VITE_API_URL` | Base de la API; en desarrollo `/api/v1` (proxy de Vite) |
| `VITE_BACKEND_TARGET` | Destino del proxy en desarrollo (`http://localhost:3000` o la URL del backend) |
| `VITE_SHOW_TEST_CARDS` | `true` muestra «Ver tarjetas de prueba»; en producción pública, `false` o sin definir |
| `VITE_GRAPHQL_URL` | Opcional: gateway GraphQL; si falta se deriva de `VITE_API_URL` |

## Comandos

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # tsc + vite build  -> dist/
npm run preview      # sirve dist/
npm test             # Vitest (ver tests/README.md)
npm run lint         # ESLint 9; `npm run lint:fix` corrige lo automático
npm run generate-api # regenera src/api/schema.d.ts desde el OpenAPI
node scripts/contrast.mjs   # contraste de los tokens
```

## Despliegue (Netlify)

Raíz `frontend`, build `npm run build`, salida `dist`, `VITE_API_URL` = URL completa de la API (`https://<host>/api/v1`). `public/_redirects` ya cubre la SPA. El origen del front debe estar en `CORS_ORIGINS` del backend.

## Cómo se conecta

Llama a `/api/v1/*` (REST con `application/problem+json`) y a `/graphql` solo en `src/api/graphql.ts`. La sesión es el JWT del backend; las guardas de ruta solo deciden qué mostrar, **la API autoriza**.

## Cuaderno y auditorías

- Heurísticas de Nielsen con evidencia: [HEURISTICAS-NIELSEN.md](../src/modules/vuelos/docs/RDA2-docs/HEURISTICAS-NIELSEN.md).
- Plan del rediseño (tokens, tema, componentes): [2026-11-13-rediseno-frontend-nielsen.md](../src/modules/vuelos/docs/planes/2026-11-13-rediseno-frontend-nielsen.md).
- Seguridad de rutas (semana 11): `src/routes/guards.tsx` → [src/routes/README.md](src/routes/README.md).

## Más a fondo

[src/README.md](src/README.md) · [tests/README.md](tests/README.md) · [Auditorías](../src/modules/vuelos/docs/RDA2-docs/auditorias/README.md) · [Backend (módulo Vuelos)](../src/modules/vuelos/README.md)

← Volver a [README principal](../README.md)
