# frontend/tests — pruebas Vitest (jsdom + Testing Library)

## Qué hay aquí

Todo en `tests/unit/` (un `*.test.ts(x)` por módulo o pantalla).

| Grupo | Archivos |
|---|---|
| Admin (páginas y guarda) | `admin-*.test.tsx` (airports, audit, booking-billing, flights, guard, invoices, layout, nodes-health, providers, reservations, runtime, users), `admin-schemas`, `dashboard-page`, `row-actions-menu` |
| Compra | `checkout*`, `passenger-schema`, `passenger-rules`, `passenger-selector`, `seats`, `cards`, `countdown`, `confirmation-page`, `flight-card`, `home-search`, `airport-picker`, `catalog-yth`, `search`, `best-value` |
| Experiencias | `experience-reservation`, `my-experiences-page`, `experiencias` |
| Componentes ui | `dialog`, `confirm-dialog`, `tabs`, `stepper`, `toast`, `boarding-pass`, `suggest-input`, `problem-alert`, `theme` |
| Lib y API | `dates`, `money`, `labels`, `airports-timezones`, `session`, `registration`, `tickets`, `flight-estimates`, `dashboard`, `observability`, `auditoria`, `proveedores`, `provider-schemas`, `reservas`, `graphql`, `problem-details`, `problem-details-age` |

## Cómo correrlas

```bash
cd frontend
npm test                           # todas (vitest run)
npx vitest run tests/unit/dates.test.ts   # un archivo
npm run lint && npm run build      # además de las pruebas
```

## Cómo se conecta

Prueban `src/lib`, `src/components`, `src/features` y `src/api` sin backend (se simulan las llamadas). Las pruebas con base de datos real son del backend (`src/modules/vuelos/testing`).

## Cuaderno y auditorías

`admin-guard.test.tsx` cubre las guardas de la semana 11; `theme`, `stepper`, `toast` y `boarding-pass` cubren el rediseño (C14).

## Más a fondo

[frontend/README.md](../README.md) · [src/routes/README.md](../src/routes/README.md) · [HEURISTICAS-NIELSEN.md](../../src/modules/vuelos/docs/RDA2-docs/HEURISTICAS-NIELSEN.md)

← Volver a [frontend/README.md](../README.md)
