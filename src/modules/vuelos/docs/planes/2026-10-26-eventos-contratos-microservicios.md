# Plan de implementación: contratos de eventos (RDA2 semanas 6–7) y división en microservicios

- **Fecha:** 2026-10-26
- **Agente:** Claude Code Desktop
- **Área:** backend/BD y documentación
- **Rama:** `vuelos`

## Objetivo
Aplicar al sistema lo que piden las semanas 6 y 7 de la guía RDA2 (EDA y contratos verificables) y documentar qué grupos de tablas pueden pasar a microservicios y en qué orden, sin cambiar el despliegue.

## Alcance
- Incluye (Fase A): JSON Schema por evento, validación con `ajv` en el bus, AsyncAPI, política SemVer/compatibilidad, script de compatibilidad, CI, log de recepción, documentos en `RDA2-docs/`, reorganización de las auditorías en `RDA1-docs/`, diagrama actualizado.
- No incluye: esquemas PostgreSQL por servicio, outbox, extracción de servicios (Fases B–D, solo documentadas); semanas 8–11.

## Contexto y referencias
`RDA2_Guia_Semanas_6-11_Integracion_de_Sistemas.md` §1–§2; exploración de FK y transacciones en `RDA2-docs/DESCOMPOSICION-MICROSERVICIOS.md`.

## Cambios previstos
| Archivo / módulo | Cambio |
|---|---|
| `contracts/eventos/*.v1.schema.json`, `README.md` | 33 esquemas y reglas de versión |
| `contracts/vuelos-eventos-asyncapi.yaml` | Exchange, colas y mensajes |
| `common/event-schemas.ts`, `common/schema-compat.ts` | Registro/validación y comparación de esquemas |
| `common/domain-event-bus.ts` | Valida al publicar y al despachar; `schemaVersion` real; log JSON de recepción |
| `scripts/check-schema-compat.ts`, `package.json` | `npm run contract:events:check`; dependencias `ajv`, `ajv-formats` |
| `.github/workflows/ci.yml` | Lint → contratos → tests → build (backend y frontend) |
| `esb/rabbitmq.transport.spec.ts` | Fixtures con payloads válidos |
| `docs/RDA1-docs/`, `docs/RDA2-docs/` | Reorganización y documentos nuevos |

## Impacto en la API / contrato
REST: ninguno. Eventos: contrato formal nuevo; `schemaVersion` del sobre pasa a ser la versión mayor del esquema (1 para todos hoy).

## Pasos
1. Esquemas y AsyncAPI. 2. Registro y validación en el bus. 3. Comparador y script. 4. Pruebas. 5. CI. 6. Documentos y diagrama. 7. Verificar lint, tests (incluidas integración) y build.

## Riesgos y decisiones abiertas
- `strict` en desarrollo/tests puede rechazar un payload de un flujo no cubierto por las pruebas; en producción el modo es `warn` y nunca bloquea una operación.
- Los esquemas piden pocos campos requeridos para no atar a los consumidores; se endurecerán con el uso.
- CI no se ha ejecutado todavía en GitHub Actions.

## Verificación
`npm run lint`, `npm test` con y sin `TEST_DATABASE_URL`, `npm run build`, `npm run contract:events:check` y la demostración de cambio incompatible descrita en `RDA2-docs/CONTRATOS-DE-EVENTOS.md`.
