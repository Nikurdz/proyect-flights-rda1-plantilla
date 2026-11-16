# frontend/src/routes — tabla de rutas y guardas de acceso

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `index.tsx` | `AppRoutes`: layout (Header, WakeUpBanner, Footer) y todas las rutas |
| `guards.tsx` | `RequireCustomer`, `RequireAdmin` y `AdminOnlyNotice` |
| `RouteEffects.tsx` | Efectos de navegación (título de pestaña por ruta y foco al cambiar de ruta) |
| `NotFoundPage.tsx` | Ruta `*` (404) |

| Ruta URL | Página | Acceso |
|---|---|---|
| `/`, `/resultados`, `/checkout/:offerId`, `/confirmacion/:orderNumber`, `/recuperar-orden` | `HomePage`, `ResultsPage`, `CheckoutPage`, `ConfirmationPage`, `RetrieveOrderPage` | público / invitado |
| `/experiencias`, `/experiencias/:id`, `/mis-experiencias` | `ExperiencesPage`, `ExperienceDetailPage`, `MyExperiencesPage` | público |
| `/login`, `/registro`, `/verificar-correo` | `LoginPage`, `RegisterPage`, `VerifyEmailPage` | público |
| `/mis-ordenes`, `/mi-cuenta` | `OrderHistoryPage`, `ProfilePage` | `RequireCustomer` |
| `/admin` → `/admin/dashboard` y `ordenes`, `reservas`, `vuelos`, `aeropuertos`, `usuarios`, `facturacion`, `facturacion-booking`, `auditoria`, `webhooks`, `observabilidad` | `AdminLayout` + páginas Admin* | `RequireAdmin` |
| `/admin/proveedores`, `/admin/salud` | redirigen a `/admin/dashboard` | `RequireAdmin` |
| `/verificar/:codigo` | `VerifyTicketPage` | público |
| `/transparencia`, `/condiciones-transporte`, `/terminos`, `/privacidad`, `/ayuda` | páginas legales | público |

## Cómo se conecta

Las guardas leen `useSession()` (`../lib/session.ts`): sin sesión de cliente → `/login?next=…`; cliente sin rol ADMIN → aviso `AdminOnlyNotice`. Son solo UX: **la API devuelve 401/403 y es la guarda real**.

## Cuaderno y auditorías

Semana 11 (seguridad): control de acceso por rol en `guards.tsx`, probado en `tests/unit/admin-guard.test.tsx`.

## Más a fondo

[features/README.md](../features/README.md) · [lib/README.md](../lib/README.md)

← Volver a [frontend/src/README.md](../README.md)
