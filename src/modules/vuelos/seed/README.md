# seed — datos iniciales (idempotente)

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `seed.ts` | Punto de entrada (`npm run seed:vuelos`): vuelos, familias tarifarias, mercados, localidades, plantillas, cliente OAuth2 de Booking |
| `flights.seed.ts` | Red de vuelos (`SCHEDULE`, `ROUTES`), horizonte de 45 días (`HORIZON_DAYS`) y **180 días para nacionales de Ecuador** (`DOMESTIC_HORIZON_DAYS`), escenarios de demo (`DEMO_SCENARIOS`, vuelos llenos) |
| `flights.seed.spec.ts` | Prueba de la red sembrada |

## Cómo se conecta

- Aeropuertos y mercados: `../ecommerce/seed/ecommerce.seed.ts` (lista `LOCALIDADES`; todos los aeropuertos IATA de Ecuador, incluido Loja `LOH`).
- Un aeropuerto de una ruta debe estar en `UTC_OFFSET`. `ADMIN_EMAIL` + `ADMIN_PASSWORD` (≥ 12) crean un admin; no hay cuenta por defecto. `SEED_DEMO_SCENARIOS=false` apaga la demo.
- En Azure corre en segundo plano al arrancar (`npm run start:container`).

## Más a fondo

- [seed de e-commerce](../ecommerce/seed/README.md) · [Plan aeropuertos](../docs/planes/2026-11-08-aeropuertos-ecuador.md)

← Volver a [vuelos](../README.md)
