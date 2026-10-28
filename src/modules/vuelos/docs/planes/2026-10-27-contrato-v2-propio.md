# Plan de implementación: contrato v2 propio (RAM Alliance) para Booking

- **Fecha:** 2026-10-27
- **Agente:** Claude Code Desktop
- **Área:** backend / contratos
- **Rama:** `vuelos`

## Objetivo
Entregar a Booking un YAML OpenAPI **completo y fiel** de nuestro nodo de vuelos (v2): la plantilla común de Booking describe un sistema genérico y no coincide con nuestro comportamiento real (ids UUID, sin 202, token OAuth2 propio, webhooks, eventos entrantes, gRPC…).

## Alcance
- Incluye: correcciones de código de impacto (solo `/api/v2`), generador del contrato, parche propio, pruebas de validez, de sincronía y de fidelidad (respuestas reales contra los esquemas).
- No incluye: cambiar la plantilla de Booking, ni el comportamiento de `/api/v1`.

## Cambios
| Archivo / módulo | Cambio |
|---|---|
| `scripts/build-contract-v2.js`, `contracts/overlay/…overlay.yaml` | Generador (plantilla + parche RFC 7386 + pases: ids UUID, sin 202, 429 y 403, límites) |
| `contracts/vuelos-openapi-v2-ram-alliance.yaml` | **Contrato generado** (31 operaciones, OpenAPI 3.0.3 válido) |
| `v2/*`, `services/*`, `ecommerce/common/global-rate-limit.middleware.ts` | `listTickets` en envoltorio, `Location`, 422 en errores de pago, `date` obligatorio, `loadFactor` en %, filtro por estado antes de paginar, estado por pasajero en asientos, cursor inválido = 400, 429 y exención de `health` en v2, `PROVIDER_UNAVAILABLE` |
| `testing/contract-v2-*.ts`, `v2.integration.spec.ts` | Validez (swagger-parser), sincronía, y validación de respuestas reales con Ajv |
| `testing/integration-app.ts` | Las suites ya no heredan el `.env` del desarrollador |

## Impacto en la API / contrato
`/api/v1` sin cambios. `/api/v2`: respuestas ajustadas a la plantilla; documentadas las diferencias que se mantienen (check-in repetido 200, sin 202, sin `itineraries`/`passengers`…).

## Verificación
`npm run lint`, `npm test` (365), `npm run build`, `npm run contract:v2:build` sin diferencias, arranque y `GET /api/docs-v2`.
