# frontend/src/hooks — hooks de React propios

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `useCardForm.ts` | Estado de los campos de tarjeta simulada; el número solo vive en el navegador (marca y token de la pasarela), nunca se envía ni se guarda |
| `useKeyedState.ts` | Estado atado a una `key`: al cambiar la clave vuelve al valor inicial en el mismo render |
| `useMediaQuery.ts` | `true` mientras se cumple la media query; sin `matchMedia` devuelve el `fallback` |

## Cómo se conecta

Los usan `features/checkout`, `features/experiences` (tarjeta) y los menús responsive del admin. Los hooks de datos (TanStack Query) no están aquí: viven en `../api/endpoints/`. Hooks de sesión y tema: `useSession` en `../lib/session.ts`, `lib/theme.ts`.

## Más a fondo

[lib/README.md](../lib/README.md) · [api/README.md](../api/README.md) · [tests/README.md](../../tests/README.md)

← Volver a [frontend/src/README.md](../README.md)
