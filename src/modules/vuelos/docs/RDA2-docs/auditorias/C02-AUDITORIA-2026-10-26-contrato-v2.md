# Auditoría Contrato v2 de Booking y contrato propio RAM Alliance — 2026-10-26
**Plan:** 2026-10-26-contrato-v2 (+ 2026-10-27-contrato-v2-propio) · **Commits:** fa138ae, aeaa125, 147d397 · **Archivos clave:** v2/auth/partner-auth.guard.ts, v2/auth/partner-auth.service.ts, v2/auth/scopes.ts, v2/booking-inbound-v2.controller.ts, v2/oauth2.controller.ts

## 1. Resumen ejecutivo
Se adoptó el contrato v2 junto a v1, con OAuth2 de socio, scopes y webhook firmado de Booking. La firma HMAC y los scopes funcionan. Los riesgos están en el mínimo privilegio, la revocación de socios y la repetición del webhook. Críticos: 0 · Altos: 2 · Medios: 2 · Bajos: 1

## 2. Hallazgos críticos, altos, medios y bajos
| ID | Severidad | Hallazgo |
|---|---|---|
| A-1 | Alto | El cliente de Booking nace con todos los scopes, incluido `flights:admin`, que vale por todos. |
| A-2 | Alto | Desactivar un socio no corta sus tokens: `activo` solo se mira al emitir (TTL 3600 s). |
| M-1 | Medio | `X-Webhook-Timestamp` es opcional y no se valida su antigüedad: una firma válida se puede repetir. |
| M-2 | Medio | `/oauth2/token` no tiene límite propio contra fuerza bruta; solo el global de 300/min por IP. |
| B-1 | Bajo | Un Basic mal codificado hace fallar `decodeURIComponent` fuera del `try` y responde 500, no 401. |

## 3. Evidencia concreta (archivo y elemento afectado)
| ID | Archivo | Elemento afectado |
|---|---|---|
| A-1 | src/modules/vuelos/seed/seed.ts | `scopes: PARTNER_SCOPES.join(' ')` (línea 71) |
| A-1 | src/modules/vuelos/v2/auth/scopes.ts | `hasScope()`: `flights:admin` concede cualquier scope |
| A-2 | src/modules/vuelos/v2/auth/partner-auth.guard.ts | `canActivate()`: solo `tokens.verify`, sin consulta a `vuelos_partner_clients` |
| A-2 | src/modules/vuelos/v2/auth/partner-auth.service.ts | `issue()`: `!client.activo` solo al emitir |
| M-1 | src/modules/vuelos/v2/booking-inbound-v2.controller.ts | `receive()`: `timestamp` opcional, sin ventana |
| M-2 | src/modules/vuelos/v2/auth/oauth2.controller.ts | `token()`; `ecommerce/common/global-rate-limit.middleware.ts` es el único límite |
| B-1 | src/modules/vuelos/v2/auth/oauth2.controller.ts | `decodeURIComponent` antes del `try` en `token()` |

## 4. Recomendación de corrección
| ID | Recomendación |
|---|---|
| A-1 | Dar a Booking solo los scopes que usa y reservar `flights:admin` a otro cliente. |
| A-2 | Comprobar `activo` del cliente en el guard (con caché corta) o reducir el TTL de tokens de socio. |
| M-1 | Exigir `X-Webhook-Timestamp` y rechazar los de más de 5 minutos. |
| M-2 | Añadir límite por `client_id` e IP al endpoint de token. |
| B-1 | Mover la decodificación al `try` y responder `invalid_client` 401. |

## 5. Pruebas que deberían repetirse después de corregir
- `npx jest src/modules/vuelos/testing/contract-v2-build.spec.ts`
- `npx jest src/modules/vuelos/testing/v2.integration.spec.ts src/modules/vuelos/testing/contract-v2.integration.spec.ts` (requiere `TEST_DATABASE_URL`)
- `npm run contract:v2:build`
- `npm run lint`

Verificado en código el 2026-11-15 sobre el commit 3c9d4b4.
