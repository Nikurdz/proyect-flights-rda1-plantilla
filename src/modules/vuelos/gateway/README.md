# gateway — BFF GraphQL (`/graphql`)

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `gateway.resolver.ts` | Queries, mutations y subscriptions (code-first) |
| `gateway.service.ts` | Llama a los dominios **por el ESB** (`EsbRouter`) y valida inputs con los DTO REST (`validarComo`) |
| `gateway.types.ts` | Tipos GraphQL |
| `gateway.context.ts` | Contexto por petición: JWT + roles y DataLoaders (`crearLoaders`) |
| `gateway.pubsub.ts` | `PUBSUB` y `GatewayEventBridge`: eventos del bus → subscription `estadoReservaCambiado` |
| `depth-limit.ts` (+ `.spec.ts`) | Límite de profundidad de consultas |
| `gateway.module.ts` | Módulo |

## Cómo se conecta

- Rutas del ESB registradas en `../esb/`; los errores de dominio conservan su `code` en `extensions`.
- Las subscriptions usan `graphql-ws`. La prueba es `../testing/gateway.integration.spec.ts`.

## Más a fondo

- [Arquitectura por capas](../docs/ARQUITECTURA-CAPAS.md) · [ESB](../esb/README.md)

← Volver a [vuelos](../README.md)
