# esb — bus interno, sagas y RabbitMQ

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `esb-router.ts` | `EsbRouter`: operaciones con nombre que llama el gateway GraphQL; cada una se mide como `ESB <nombre>` |
| `saga-orchestrator.ts` | `SagaOrchestrator`: pasos + compensación en orden inverso, registrados en `auditoria_saga_pasos` (la saga de reservas externas corre aquí) |
| `rabbitmq.transport.ts` (+ `.spec.ts`) | Transporte RabbitMQ: solo activo con `RABBITMQ_URL` |
| `esb.module.ts` | Módulo |

## Cómo se conecta

- Sin `RABBITMQ_URL`, `DomainEventBus` (`../common/domain-event-bus.ts`) entrega en proceso. Con broker: exchange `booking.events` → colas `q.ordenes.confirmadas`, `q.sagas.compensacion`, `q.general`; entrantes `q.vuelos.entrantes`.
- Un consumidor que falla se reintenta 3 veces y pasa a `q.dead_letter`. Si el broker cae, se entrega en proceso.
- `RABBITMQ_SERVICE_QUEUE` da a un satélite su cola propia (`q.svc.*`): ver [servicios](../../../servicios/README.md).
- La saga de compra de vuelos (`ecommerce/ordenes/compras.service.ts`) tiene su propio código, con el mismo registro de pasos.

## Más a fondo

- [Arquitectura por capas](../docs/ARQUITECTURA-CAPAS.md) · [Eventos](../docs/ARQUITECTURA-EVENTOS.md) · [Contratos de eventos](../docs/RDA2-docs/CONTRATOS-DE-EVENTOS.md)

← Volver a [vuelos](../README.md)
