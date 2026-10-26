# Plan de implementación: arquitectura por capas (ESB, bus RabbitMQ, gateway GraphQL, logs)

- **Fecha:** 2026-10-25
- **Agente:** Claude Code Desktop
- **Área:** backend
- **Rama:** `vuelos`

## Objetivo
Llevar el diagrama de capas de referencia a la web de Vuelos de forma pragmática: una puerta interna única entre el exterior y los dominios, un orquestador de sagas, un bus con broker opcional, un BFF GraphQL y logs técnicos.

## Alcance
- Incluye: `esb/` (`EsbRouter`, `SagaOrchestrator`, `RabbitMqTransport`), `gateway/` (GraphQL), logging con Winston, documento de capas.
- No incluye: Kafka, ingesta de stock por gRPC, paquetes dinámicos, app móvil, un esquema Postgres por dominio. Pantallas (Fase 4).

## Cambios realizados
| Archivo / módulo | Cambio |
|---|---|
| `esb/saga-orchestrator.ts` | Pasos con compensación LIFO, registro en `auditoria_saga_pasos`; la saga de reserva externa corre sobre él |
| `esb/esb-router.ts` | Operaciones con nombre y métricas `ESB <operación>` |
| `common/domain-event-bus.ts`, `esb/rabbitmq.transport.ts` | `setTransport`, `despachar`; RabbitMQ con colas por tipo, 3 reintentos y `q.dead_letter`; respaldo en proceso |
| `gateway/` | `/graphql` (Apollo, code-first): consultas, mutaciones y suscripción; JWT y roles; límite de profundidad; DataLoaders por petición; errores con `extensions.code` iguales a REST; validación con los DTO de REST |
| `common/winston-logger.ts` | Archivos `combined`, `error` y `audit` con `correlationId`, rotación por tamaño |
| `ecommerce/ordenes/compras.service.ts` | `OrdenEmitida` incluye `ownerId` (para la suscripción) |

## Impacto en la API / contrato
`/graphql` no forma parte del OpenAPI. Las rutas REST no cambian.

## Riesgos y decisiones
- RabbitMQ entrega al menos una vez y los consumidores son idempotentes; si el broker falla se cae a entrega en proceso.
- GraphQL repite los límites de REST (profundidad máxima, introspección solo fuera de producción, rate limit global del servidor).
- La saga de compra de vuelos no se migró al orquestador genérico (riesgo en el camino de cobro); comparte el registro de pasos.

## Verificación
Suite completa en verde (284 pruebas): transporte con un broker simulado (reintentos, dead-letter, respaldo), regla de profundidad, 6 pruebas del gateway contra Postgres con socio simulado (autenticación y roles, catálogo, checkout con factura por DataLoader, idempotencia, reglas iguales a REST, auditoría de la saga, cancelación). Además, prueba manual contra un RabbitMQ real: entrega, 3 reintentos y 1 mensaje en `q.dead_letter`.
