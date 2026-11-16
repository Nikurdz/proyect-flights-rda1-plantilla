# frontend/src/features — una carpeta por pantalla o dominio

## Qué hay aquí

| Carpeta | Ruta URL | Archivo principal |
|---|---|---|
| `search/` | `/` | `HomePage.tsx` (+ `SearchBar`, `AirportPicker`, `PassengerSelector`) |
| `results/` | `/resultados` | `ResultsPage.tsx` (+ `FlightCard`, `DateStrip`, `DateNavigator`, `SortingBar`) |
| `fares/` | dentro de resultados | `FareFamilyCard.tsx`, `FareComparisonModal.tsx` |
| `checkout/` | `/checkout/:offerId` | `CheckoutPage.tsx` (pasajeros, asientos `SeatMap`, facturación, condiciones, `PaymentForm`) |
| `confirmation/` | `/confirmacion/:orderNumber` | `ConfirmationPage.tsx` |
| `orders/` | `/recuperar-orden` | `RetrieveOrderPage.tsx` |
| `verify/` | `/verificar/:codigo` | `VerifyTicketPage.tsx` (QR público) |
| `account/` | `/login`, `/registro`, `/verificar-correo`, `/mis-ordenes`, `/mi-cuenta` | `LoginPage`, `RegisterPage`, `OrderHistoryPage`, `ProfilePage` |
| `experiences/` | `/experiencias`, `/experiencias/:id`, `/mis-experiencias` | `ExperiencesPage.tsx` |
| `legal/` | `/transparencia`, `/condiciones-transporte`, `/terminos`, `/privacidad`, `/ayuda` | `LegalLayout.tsx` + una página cada una |
| `admin/` | `/admin/*` (solo ADMIN) | `AdminLayout.tsx`, menú en `admin-nav.ts` |

### Mapa del admin (4 grupos, menú desplegable en `admin-nav.ts`)

| Grupo | Página (`/admin/…`) | Archivo |
|---|---|---|
| Ventas | `dashboard` Resumen | `AdminDashboardPage.tsx` (+ `dashboard/charts.tsx`) |
| Ventas | `ordenes` | `AdminOrdersPage.tsx` |
| Ventas | `reservas` mostrador | `AdminReservationsPage.tsx` |
| Operación | `vuelos` | `AdminFlightsPage.tsx`, `AdminFlightDialogs.tsx` |
| Operación | `aeropuertos` | `AdminAirportsPage.tsx` |
| Finanzas | `facturacion` | `AdminInvoicesPage.tsx` |
| Finanzas | `facturacion-booking` | `AdminBookingBillingPage.tsx` |
| Sistema | `usuarios` | `AdminUsersPage.tsx` |
| Sistema | `webhooks` | `AdminWebhooksPage.tsx` |
| Sistema | `auditoria` Trazabilidad | `AdminAuditPage.tsx` (+ `TraceFlowGraph.tsx`, `TraceEstadoBadge.tsx`) |
| Sistema | `observabilidad` | `AdminObservabilityPage.tsx` (+ `LatencyChart.tsx`) |

Apoyo común del admin: `AdminPageHeader`, `FilterPanel`, `RowActionsMenu`, `LedStatus`, `admin-schemas.ts`, `admin-errors.ts`. `AdminProvidersPage.tsx` y `AdminNodesHealthPage.tsx` siguen en el código, pero `/admin/proveedores` y `/admin/salud` redirigen a `/admin/dashboard`.

## Cómo se conecta

Cada feature usa los hooks de `../api/endpoints/*` y los componentes de `../components`. Las rutas se declaran en [routes/README.md](../routes/README.md).

## Cuaderno y auditorías

Rediseño y heurísticas: [auditoría C14](../../../src/modules/vuelos/docs/RDA2-docs/auditorias/C14-AUDITORIA-2026-11-13-microservicios-y-rediseno-frontend.md) · [HEURISTICAS-NIELSEN.md](../../../src/modules/vuelos/docs/RDA2-docs/HEURISTICAS-NIELSEN.md).

## Más a fondo

[api/README.md](../api/README.md) · [Auditorías](../../../src/modules/vuelos/docs/RDA2-docs/auditorias/README.md)

← Volver a [frontend/src/README.md](../README.md)
