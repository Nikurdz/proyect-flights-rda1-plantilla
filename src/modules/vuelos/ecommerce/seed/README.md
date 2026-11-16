# ecommerce/seed/ — Datos iniciales del e-commerce (idempotentes)

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `ecommerce.seed.ts` | Siembra mercados (desactiva los no USD), localidades (`LOCALIDADES`, `ON CONFLICT DO NOTHING`), plantillas y roles; crea admin si hay `ADMIN_EMAIL` + `ADMIN_PASSWORD` (≥12) |

## Cómo se ejecuta
`npm run seed:vuelos` (también dentro de `start:render` y `start:container`). El seed de vuelos (horizonte de 45 días, `ROUTES`/`UTC_OFFSET`) está en `../../seed/` (`flights.seed.ts`, `seed.ts`).

## Cómo se conecta
Alimenta [../catalogo/](../catalogo/README.md) (aeropuertos), [../mercados/](../mercados/README.md) y [../notificaciones/](../notificaciones/README.md). No hay cuenta admin por defecto.

## Más a fondo
[ecommerce](../README.md) · [módulo vuelos](../../README.md)

← Volver a [../README.md](../README.md)
