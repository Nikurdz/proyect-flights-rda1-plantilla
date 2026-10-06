# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`booking-prototipo-plantilla` — a shared NestJS 10 + TypeORM template for a course project with 4 independent domain teams: Alojamientos, Autos, Atracciones, and **Vuelos**. Only the `VuelosModule` is enabled here (see `src/app.module.ts`) — the other three are commented out and belong to other teams; do not uncomment or build them out in this checkout. Work happens on the `vuelos` git branch.

This is phase **RDA1**: each team's API works independently against its own Postgres schema, and is deployed to Render. There is no external Payment/Customer/Billing/IdP integration yet; real cross-team integration happens in RDA2+. The module therefore contains its own identity service (issues the JWTs it verifies) and **simulated** payment gateway, fraud engine and mail channel behind ports.

The Vuelos module has two layers (details and route tables in `src/modules/vuelos/README.md`):

1. **Flight core (GDS)** — implements `contracts/vuelos-openapi.yaml`: search, seatmap, hold, booking, tickets, flight status. Post-sale (extra baggage, date change, cancellation + quote), check-in / boarding passes and webhooks are implemented too: **no operation of the contract answers `501`**. Their rules (fees, windows, penalties) are team decisions in `common/vuelos-config.ts` (`POSTSALE_*`, `CHECKIN_*`, `WEBHOOKS_*`), documented in `docs/planes/2026-10-07-posventa-checkin-webhooks.md`.
2. **E-commerce R1** (`src/modules/vuelos/ecommerce/`, from `docs/SRS_Plataforma_Ecommerce_LATAM.md`, release "Compra de vuelo"): identity, markets/config, search & pricing, offers/checkout, payments, orders, notifications. It lives *inside* the Vuelos module so the "enable only your module" rule holds, and sells from the core's inventory in-process.

## Agents and implementation plans

Roles are defined in `src/modules/vuelos/docs/AGENTES.md`: OpenCode/Antigravity audit and document, **Claude Code Desktop owns backend, information system and database**, Antigravity owns the full UI/UX frontend connected to the backend. Before any development work, write an implementation plan in `src/modules/vuelos/docs/planes/AAAA-MM-DD-<tema>.md` using `PLANTILLA.md` there.

## Commands

```bash
npm install
docker compose up -d       # Postgres 16 on 5432 (see the port-conflict note below)
npm run start:dev          # TypeORM synchronize:true creates/updates the schema (not in production)
npm run seed:vuelos        # flights (45-day rolling horizon), fare families, markets, places, templates; idempotent
                           # set ADMIN_EMAIL + ADMIN_PASSWORD (>=12 chars) to also create an admin; there is no default account
npm test                   # unit tests + integration tests when TEST_DATABASE_URL is set
npx jest path/to/file.spec.ts   # a single file
npm run build              # nest build (compiles specs too, so a broken spec breaks the build)
npm run migration:run:vuelos | migration:generate:vuelos | migration:check:vuelos   # schema migrations (see below)
npm run lint               # broken repo-wide (ESLint is not installed); pre-existing template gap, do not fix incidentally
```

Swagger UI: `http://localhost:3000/api/docs` (Authorize with a token from `POST /api/v1/auth/login` or `/auth/invitado`). Its sections are numbered in the order of a purchase and live in `src/modules/vuelos/common/swagger-tags.ts` (controllers use the `SWAGGER_TAGS` constants, never loose strings); the cover text, route ordering and UI options are in `src/modules/vuelos/swagger.ts`. Operations of the walkthrough carry `Paso N` in their summary — number a new one by hand. Sections: 1 Acceso … 5 Mis viajes, 6 Gestionar la reserva, 7 Check-in, 8 Webhooks, 9 Administración, 10 Núcleo GDS, 11 Sistema; nothing is left "not implemented". Every route is under the global prefix `api/v1` set once in `src/main.ts`, shared by all domains — it does **not** match the contracts' own `servers[].url`. `main.ts` registers the Bearer scheme for Swagger (the only shared-file change this module needed).

`.env` needs `JWT_SECRET` (>= 32 chars). Vuelos config is validated at boot by `common/vuelos-config.ts`; an invalid value stops the app with a readable message. `DATA_ENCRYPTION_KEY` is derived from `JWT_SECRET` in development and **required** in production.

### Integration tests

`src/modules/vuelos/testing/*.integration.spec.ts` boot the real `VuelosModule` against Postgres (each suite in its own schema, dropped afterwards) and are skipped unless `TEST_DATABASE_URL` is set — point it at a disposable database such as `booking_test`, never the dev one. They cover the properties unit tests with mocks cannot: parallel bookings of one hold, inventory never oversold, idempotent replay, ownership, the purchase saga's compensation, encryption at rest. If you change booking/hold/payment logic, run them.

### Schema, migrations and deploy

`app.module.ts` synchronizes the schema only outside production, so production schemas come from TypeORM migrations in `src/modules/vuelos/migrations/` (the CLI DataSource and the entity glob live there, so new entities are picked up automatically). After changing an entity: generate a migration against a database that has the *previous* schema, then run `npm run migration:check:vuelos` against a migrated database — it must exit 0. Do not use an array-typed column `default` (TypeORM reports it as drift forever). `render.yaml` runs `npm run start:render` (migrate → seed → start). Never regenerate `DATA_ENCRYPTION_KEY` on a database that already holds orders.

### Local Postgres port conflicts

If port 5432 is taken locally (e.g. a native Postgres service), create a gitignored `docker-compose.override.yml` using the YAML `!override` merge tag on `ports` (plain lists concatenate instead of replacing), and point `.env`'s `DATABASE_URL` at that port. Never edit the shared `docker-compose.yml` for a machine-local problem.

## Architecture

- **Flat module convention**: `entities/`, `dto/`, `services/`, `common/` sit directly under `src/modules/<domain>/`. Don't introduce a `domain/application/infrastructure` split. The e-commerce sub-domains (`mercados`, `identidad`, `catalogo`, `ofertas`, `pagos`, `ordenes`, `notificaciones`) are nested Nest modules aggregated by `ecommerce/ecommerce.module.ts`; the SRS naming (Spanish nouns: Oferta, Orden, Pago…) is kept for them.
- **Module wiring**: `VuelosCoreModule` (no controller) provides and exports the core services, config (`VUELOS_CONFIG`), JWT verification, the in-process `DomainEventBus` and the idempotency/inventory services. `VuelosModule` = `VuelosCoreModule` + `EcommerceModule` + `VuelosController`. E-commerce modules import `VuelosCoreModule`; never import `VuelosModule` from them (circular).
- **`src/common/`** holds only what all 4 teams share (`IdempotencyKeyGuard` validates the header is a UUID, `ColumnNumericTransformer`, base DTOs). Changes there affect every team.
- **Money** is integer minor units in every calculation (`common/money.util.ts`, `ecommerce/common/moneda.util.ts`); strings only at the API edge. The platform sells in **USD only**: one market (`ec`); the seed deactivates any non-USD market. The market/rate model and the zero-decimal currencies stay in the code as generic utilities.
- **Errors**: always `ProblemDetailsException` → `application/problem+json`, via `VuelosProblemDetailsFilter`, attached per controller with `ProblemController(path, tag)` (never global). The contract's `code` enum is closed; codes for statuses the contract does not define live in `ExtensionProblemCode`.
- **Auth**: `auth/` verifies HS256 JWTs (`JwtAuthGuard`, `RolesGuard`, `@CurrentAuth()`); `ownerId` is only ever the verified `sub` (customer id, or `guest:<id>`). Resource access checks compare it with the stored owner.
- **Atomicity rules that must not be weakened**: `OffersService.createHoldWithin` / `BookingsService.createBookingWithin` are public so the e-commerce flow runs them *inside its own transaction*; `InventoryService` is the only writer of `Vuelo.asientosDisponibles` (conditional UPDATE); booking locks the hold row (`pessimistic_write`) and consumes it with `WHERE status='HELD'`.
- **Idempotency** (`services/idempotency.service.ts`): `execute` for single-transaction work (completion written in the same transaction), `executeSaga` for multi-step work with external effects (stores and replays the business outcome). Scoped by (key, route, owner) with a request-body hash.
- **Purchase saga** (`ecommerce/ordenes/compras.service.ts`): lock offer → revalidate price → authorise payment → order + booking + tickets + hold in ONE transaction → capture; on issuance failure void the authorisation and record a `FALLIDA_COMPENSADA` order. It is resumable by state, so a retry never charges or issues twice. Preconditions throw (not stored under the key); business outcomes (declined, compensated, success) are stored and replayed.
- **Personal data** (passengers of both the order and the GDS booking, contact, billing, notification bodies) is encrypted with `common/cifrado.ts` via the `encryptedJson` column transformer; it cannot be queried by SQL, so lookups go through indexed plain columns (order number, PNR) and compare the surname in the application.
- **Back office** (`ecommerce/admin/`): `GET /admin/ordenes` (each passenger carries its signed `qr` and chosen seats), `/admin/ordenes/:numero`, `/admin/vuelos`, `/admin/vuelos/:id/asientos` (reserved seats with locator/order, never names), ADMIN role only; it is the single place that reads across customers. Everything else is owner-only. Test any new route for 401 anonymous / 403 guest and customer.
- **Frontend** lives in `frontend/` (its own package, excluded from the Nest build via `tsconfig.json`); see `frontend/README.md`. Brand: RAM Alliance. Do not add real card capture: payments are simulated.
- **Ticket QR**: each passenger's ticket has a deterministic signed code (`common/ticket-qr.ts`: `v1.<e-ticket>.<PNR>.<HMAC>`, key derived by HKDF from `JWT_SECRET`, no personal data) computed on read — no column, no migration, nothing added to the purchase transaction. The frontend renders it as a QR that opens `/verificar/<code>`, backed by the public `GET /tickets/verificar`. Changing `JWT_SECRET` invalidates the codes already issued.
- **Observability** (`ecommerce/admin/observabilidad.*`, `common/runtime-metrics.ts`): `/admin/observabilidad/resumen` is computed from the database (durable); `/runtime` reads process-local counters fed by `CorrelationInterceptor`, `VuelosProblemDetailsFilter`, `DomainEventBus`, the rate limiter and the two background jobs — they reset on every restart, so never use them as a source of truth. `GET /health` checks the database.
- **After-sale** (`services/baggage|date-change|cancellation|check-in.service.ts`, shared load/lock/ownership in `booking-context.service.ts`, pure rules in `common/postsale-rules.ts`): each write is one transaction behind an `Idempotency-Key`; a payment reference is opaque and single-use across bookings, baggage and date changes; `Vuelo.estado` CANCELLED closes a flight to search/holds/bookings. Cancelling publishes `booking.cancelled`; `PagosService` refunds through the gateway port (`REEMBOLSADO`, or `REEMBOLSO_PENDIENTE` retried by the reconciler) and `OrdenesService` follows (`DEVOLUCION_EN_CURSO` → `REEMBOLSADA`; `booking.changed` → `MODIFICADA` → `EMITIDA`).
- **Webhooks** (`services/webhooks.service.ts`, `webhook-dispatcher.service.ts`, `common/safe-http.ts`): subscriptions are per owner, the secret is encrypted and never returned; deliveries are queued by event owner and sent by a 15 s job with retries 1 m/5 m/30 m/2 h/6 h then `DEAD`; https + public IPs only (the resolved address is pinned, no redirects); `WEBHOOKS_ALLOW_PRIVATE_HOSTS` is for local tests and the config refuses it in production. Admin `POST /admin/vuelos/:id/cancelar|reprogramar` are what produce `flight.*` events.
- **Reconciliation** (`ecommerce/ordenes/reconciliacion.service.ts`, every 60 s) is the stand-in for an outbox/broker: captures `CAPTURA_PENDIENTE` payments, voids `ANULACION_PENDIENTE` ones, re-announces issued orders with no confirmation notification. The saga records the compensated order even if the gateway cannot void. Keep every step idempotent.
- **Domain events** (`DomainEventBus`, SRS §10.3 shape) are in-process; a failing consumer is isolated and never fails the producer. Notifications and offer expiry subscribe to them. There is no outbox/broker in this phase.
- **Seat selection** (optional, free in this phase): the passenger's `asientos` (`{trayectoId, asiento}` per leg) travel encrypted inside the offer's `datosPasajeros` and become the GDS `assignedSeats` in the purchase saga. `OfertasService.verificarAsientos` rejects bad picks when passengers are saved and again before any charge (`SEAT_TAKEN` 409, nothing authorised); the unique index on `(vueloId, seatNumber)` is the final guarantee, and a lost race is compensated like any issuance failure. Seats are only locked when the order is issued, as the contract defines.
- **Direct flights, economy only, UTC day search** are deliberate documented simplifications — not gaps to fix silently.

## Env vars

See `.env.example`: `DATABASE_URL`, `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `TAX_RATE`, `DEFAULT_CURRENCY`, `OFFER_TTL_MINUTES`, `HOLD_TTL_MINUTES`, `OFFER_MAX_COMBINATIONS`, `MAX_PASSENGERS_PER_ORDER`, `JWT_TTL_SECONDS`, `ADMIN_EMAIL`/`ADMIN_PASSWORD` (seed only), `PUBLIC_WEB_URL`, `TRUST_PROXY` (proxy hops, 1 on Render — without it per-client rate limits see the proxy's IP), `TEST_DATABASE_URL`.
