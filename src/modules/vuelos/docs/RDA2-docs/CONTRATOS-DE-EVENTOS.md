# Contratos de eventos (semanas 6 y 7)

## Qué hay
- **39 JSON Schema** en `contracts/eventos/<tipo>.v1.schema.json`, uno por tipo de evento que el código publica. Describen el payload; el sobre (`DomainEvent`: `id`, `type`, `schemaVersion`, `occurredAt`, `market`, `correlationId`, `aggregateId`) es común.
- **AsyncAPI** `contracts/vuelos-eventos-asyncapi.yaml`: exchange `booking.events`, colas `q.ordenes.confirmadas`, `q.sagas.compensacion`, `q.general`, `q.dead_letter`, un mensaje por evento que referencia su esquema.
- **Validación** (`common/event-schemas.ts`, usada por `DomainEventBus`): al publicar y al despachar. `EVENT_SCHEMA_MODE` = `strict` (por defecto fuera de producción: lanza), `warn` (por defecto en producción: registra y entrega), `off`. Un mensaje inválido llegado del broker no llega a los consumidores: cuenta como fallo, se reintenta 3 veces y termina en `q.dead_letter`. `schemaVersion` del sobre = versión mayor del esquema.
- **Compatibilidad** (`common/schema-compat.ts`, `scripts/check-schema-compat.ts`): `npm run contract:events:check -- <ref>` compara los esquemas con una referencia de git y falla si hay un cambio incompatible o un esquema publicado se borró.
- **CI** (`.github/workflows/ci.yml`): `lint → compatibilidad de contratos → tests (con Postgres) → build`, y el frontend en paralelo.
- **Log de recepción** en JSON por evento despachado: `event_received`, `event_id`, `correlation_id`, `emitted_at`, `received_at`, `status`, `duration_ms`.

## Política de versiones (SemVer aplicado a esquemas)
| Cambio | Versión |
|---|---|
| Campo opcional nuevo | MINOR |
| Valor nuevo en un enum | MINOR (los consumidores toleran valores desconocidos) |
| Descripción / metadatos | PATCH |
| Quitar o renombrar un campo, cambiar un tipo, volver requerido un campo, cerrar el objeto | **MAJOR** → archivo `.v2`, `.v1` se conserva hasta que migren los consumidores |

Nivel de compatibilidad: **BACKWARD_TRANSITIVE**. Los payloads no usan `additionalProperties: false`, para que el contrato pueda crecer.

## Prueba de que funciona
- `event-schemas.spec.ts`: cada tipo publicado en el código tiene esquema y viceversa; el AsyncAPI los lista todos; rechaza payload sin campo requerido o con tipo incorrecto; `strict` lanza, `warn` entrega; un mensaje inválido del broker cuenta como fallo.
- `schema-compat.spec.ts`: clasifica los cambios de los ejercicios de la guía (campo opcional → MINOR, cambio de tipo → MAJOR, enum ampliado → MINOR, campo antes opcional ahora requerido → MAJOR, renombrar → MAJOR).
- Las 8 suites de integración (150 pruebas contra Postgres) publican payloads reales sin romper ningún esquema.
- Demostración manual: renombrar `numeroOrden` por `numeroPedido` en `OrdenEmitida.v1` contra un commit base → `check-schema-compat` informa `BREAKING` y sale con código 1.

## Coreografía u orquestación, por flujo
| Flujo | Estilo | Por qué |
|---|---|---|
| Compra de vuelo, reserva externa | Orquestación (`ComprasService`, `SagaOrchestrator`) | Regulado, auditable, con compensación |
| Pagos, reembolsos | Orquestación + eventos | Dinero: trazabilidad clara |
| Notificaciones, expiración de ofertas, webhooks, auditoría | Coreografía (suscripción a eventos) | Desacoplado; un consumidor nuevo no toca al productor |

## Riesgos conocidos
- La orquestación de compra es un punto único de lógica (riesgo de «mini-monolito»).
- Entrega at-least-once: los consumidores deben ser idempotentes (la auditoría lo es por `eventoId`).
- Sin outbox: entre el commit y la publicación un fallo pierde el evento; lo recupera la reconciliación (cada 60 s) solo para órdenes. Es el primer prerrequisito para separar servicios.
- Kafka (telemetría, replay) sigue como fase siguiente; RabbitMQ cubre el negocio crítico.
