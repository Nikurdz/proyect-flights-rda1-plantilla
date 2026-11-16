# frontend/src/styles — tokens CSS y tema claro/oscuro

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `index.css` | Directivas Tailwind, tokens (`:root` claro, `.dark` oscuro), puente `slate-*`, clases `.brand-header-bg`, `.brand-hero-bg`, `.legal-prose`, utilidad `.num`, `prefers-reduced-motion` e impresión siempre en claro |

Tokens (tripletes `R G B`, admiten opacidad `bg-ink/5`): `ink`/`on-ink`, `muted`, `gold`/`gold-text`/`gold-soft`/`on-gold`, `paper` (fondo), `surface` (tarjetas), `line`/`line-strong` (bordes), `chrome`, `success|warning|danger` (+ `-soft`). `gold` es solo relleno; para texto usar `gold-text`. En código nuevo no usar `slate-*`.

## Cómo se conecta

`main.tsx` importa el CSS; `tailwind.config.js` mapea los tokens a clases. El tema (`light`/`dark`/`system`, clave `ram-theme`) lo fija `lib/theme.ts` poniendo `.dark` en `<html>` antes del primer pintado (script de `index.html`); botón en `components/ui/ThemeToggle.tsx`. El contraste de cada par se verifica con `node scripts/contrast.mjs`.

## Cuaderno y auditorías

Lista documentada de tokens y mapeo `airline-*` → tokens: [plan del rediseño](../../../src/modules/vuelos/docs/planes/2026-11-13-rediseno-frontend-nielsen.md).

## Más a fondo

[components/README.md](../components/README.md) · [lib/README.md](../lib/README.md)

← Volver a [frontend/src/README.md](../README.md)
