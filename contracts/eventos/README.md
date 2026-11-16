# contracts/eventos/ — contratos de eventos de dominio

## Qué hay aquí
| Archivo o subcarpeta | Qué hace |
|---|---|
| `<tipo>.v1.schema.json` | Payload de cada evento: `booking.*`, `hold.*`, `flight.*`, `pagos.*`, `paquetes.*`, `proveedor.*` y los del e-commerce (`OrdenEmitida`, `PagoAutorizado`, `OfertaCreada`, `Reserva*`…) |
| `README.md` | Este archivo: reglas de versionado |

## Cómo se conecta
- Los carga `src/modules/vuelos/common/event-schemas.ts`; `DomainEventBus` los valida al publicar.
- Compatibilidad: `scripts/check-schema-compat.ts` (CI, ver `.github/workflows/ci.yml`).
- Vista AsyncAPI: `../vuelos-eventos-asyncapi.yaml`.

## Cuaderno y auditorías
- Semana 7 · contratos → [RETO-2-CORTO.md](../../src/modules/vuelos/docs/RDA2-docs/auditorias/RETO-2-CUADERNO/RETO-2-CORTO.md)
- C01 eventos y contratos → [C01](../../src/modules/vuelos/docs/RDA2-docs/auditorias/C01-AUDITORIA-2026-10-26-eventos-contratos-microservicios.md)

## Más a fondo
- [Contratos de eventos (doc)](../../src/modules/vuelos/docs/RDA2-docs/CONTRATOS-DE-EVENTOS.md) · [Arquitectura de eventos](../../src/modules/vuelos/docs/ARQUITECTURA-EVENTOS.md)

← Volver a [contracts/README](../README.md)

## Detalle de las reglas

Un JSON Schema por tipo de evento: `<tipo>.v<mayor>.schema.json`. Describe el **payload**; el sobre (`id`, `type`, `schemaVersion`, `occurredAt`, `market`, `correlationId`, `aggregateId`) lo fija `DomainEvent` en `src/modules/vuelos/common/domain-event-bus.ts`. La vista de conjunto (exchange, colas, sobre) está en `../vuelos-eventos-asyncapi.yaml`.

## Reglas (guía RDA2, semana 7)
| Cambio | Versión | Qué hacer |
|---|---|---|
| Agregar campo opcional | MINOR | Editar el mismo archivo y subir `x-schema-version` (1.1.0) |
| Agregar valor a un enum | MINOR | Igual; los consumidores deben tolerar valores desconocidos |
| Corregir descripción | PATCH | Editar el mismo archivo |
| Quitar o renombrar un campo, cambiar un tipo, volver requerido un campo, cerrar el objeto | **MAJOR** | **No editar `v1`**: crear `<tipo>.v2.schema.json` y publicar ambos hasta que migren los consumidores |

- Política: **BACKWARD_TRANSITIVE**. Los consumidores nuevos leen datos de todas las versiones anteriores.
- No usar `additionalProperties: false` en los payloads: el contrato debe poder crecer.
- `npm run contract:events:check [-- <ref-git>]` compara estos archivos con una referencia de git (por defecto `HEAD`; CI usa el commit base) y sale con código distinto de 0 si un esquema publicado cambió de forma incompatible o se borró.
- En ejecución, `DomainEventBus.publish` valida cada payload (`EVENT_SCHEMA_MODE`: `strict` lanza error, por defecto fuera de producción; `warn` solo registra, por defecto en producción; `off` no valida). `despachar` rechaza un mensaje inválido recibido del broker: cuenta como fallo, se reintenta 3 veces y termina en `q.dead_letter`.
- Un test (`event-schemas.spec.ts`) falla si el código publica un tipo sin esquema o si hay un esquema que nadie publica.
- Un evento nuevo: crear su `.v1.schema.json`, agregarlo al AsyncAPI y publicarlo.
