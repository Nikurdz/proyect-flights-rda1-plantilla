# Mapeo de la guía RDA2 (semanas 6–11) al sistema

Estado al 26-oct-2026. «Hecho» = existe y está probado; «Ronda actual» = agregado al aplicar la guía.

## Semana 6 — Arquitectura orientada a eventos
| Pide la guía | Dónde está | Estado |
|---|---|---|
| Eventos en pasado, bus, productores/consumidores | `common/domain-event-bus.ts`, 33 tipos publicados | Hecho |
| `correlation_id` en cada evento y log | Sobre del evento + `CorrelationInterceptor`; log JSON de recepción con `emitted_at`/`received_at`/`duration_ms` | Hecho / Ronda actual |
| Saga con compensaciones | `ComprasService`, `SagaOrchestrator` (LIFO), `auditoria_saga_pasos` | Hecho |
| Coreografía vs. orquestación justificada | `RDA2-docs/CONTRATOS-DE-EVENTOS.md` | Ronda actual |
| RabbitMQ con ACK, reintentos y DLQ | `esb/rabbitmq.transport.ts` (3 reintentos → `q.dead_letter`) | Hecho |
| Consumidores idempotentes | Auditoría por `eventoId`; notificaciones y reembolsos por estado | Hecho |
| Kafka para telemetría/replay | Dibujado como fase siguiente | Pendiente (opcional) |
| Contrato de eventos con AsyncAPI | `contracts/vuelos-eventos-asyncapi.yaml` | Ronda actual |

## Semana 7 — Esquemas, compatibilidad y contratos
| Pide la guía | Dónde está | Estado |
|---|---|---|
| Contrato como artefacto verificable (REST) | `contracts/vuelos-openapi.yaml` (a mano), `vuelos-ecommerce-openapi.yaml` (generado + test) | Hecho |
| Schema-first con JSON Schema y `ajv` | `contracts/eventos/*.schema.json`, `common/event-schemas.ts` | Ronda actual |
| SemVer de esquemas y política de compatibilidad | `contracts/eventos/README.md`, `CONTRATOS-DE-EVENTOS.md` (BACKWARD_TRANSITIVE) | Ronda actual |
| Script de compatibilidad (`esCompatibleBackward`) | `common/schema-compat.ts`, `scripts/check-schema-compat.ts` | Ronda actual |
| Job de CI `check-schema-compatibility` | `.github/workflows/ci.yml` | Ronda actual |
| Esquemas versionados en Git, sin `additionalProperties:false` | `contracts/eventos/` | Ronda actual |
| Schema Registry (Confluent), Avro, Protobuf | No aplica con RabbitMQ y JSON; el registro es la carpeta versionada | No aplica |

## Semanas 8–11 — fuera de esta ronda
| Semana | Tema | Lo que ya existe | Lo que falta (a decidir) |
|---|---|---|---|
| 8 | API Gateway y mesh | BFF GraphQL, rate limit, JWT en el borde | Gateway dedicado (Kong DB-less) y decisión documentada sobre Service Mesh |
| 9 | Pruebas y contract testing | 293 pruebas, 8 suites de integración | Pact consumidor/proveedor, `can-i-deploy` |
| 10 | Observabilidad | Winston, auditoría, métricas propias, `correlationId` | OpenTelemetry + Jaeger, `traceparent` en mensajes AMQP |
| 11 | Seguridad | JWT, RBAC, cifrado AES-256-GCM, SSRF guard | Revisión OAuth2/mTLS, auditoría de accesos |
