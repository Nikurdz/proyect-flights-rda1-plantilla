# auth — verificación de JWT y roles

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `token.service.ts` | `TokenService`: firma y verifica JWT HS256 (`customer`, `guest`, `service`); define `AuthClaims` |
| `jwt-auth.guard.ts` | `JwtAuthGuard` (exige `Bearer` válido) y decorador `@CurrentAuth()` |
| `roles.guard.ts` | `RolesGuard` y decorador `@Roles(...)` (p. ej. `ADMIN`) |

## Cómo se conecta

- `ownerId` es siempre el `sub` verificado (cliente o `guest:<id>`); los servicios lo comparan con el dueño guardado.
- Quien emite los tokens es `ecommerce/identidad/` (`POST /auth/login`, `/auth/invitado`). Los roles viajan en el JWT: un cambio aplica en el siguiente login.
- Los socios de la API v2 usan otro guard: `v2/auth/partner-auth.guard.ts`.

## Más a fondo

- [Identidad](../ecommerce/identidad/README.md) · [v2 (OAuth2 y scopes)](../v2/README.md)

← Volver a [vuelos](../README.md)
