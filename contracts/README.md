# contracts/ — contratos de la API, de los eventos y de los socios

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `vuelos-openapi.yaml` | Contrato v1 GDS, escrito a mano. No cambia |
| `vuelos-openapi-v2.yaml` | Plantilla v2 que dio Booking. **Nunca se edita** |
| `vuelos-openapi-v2-ram-alliance.yaml` | Nuestro v2 (32 operaciones). **Generado**, no se edita |
| `vuelos-ecommerce-openapi.yaml` | OpenAPI de todo el sistema. **Generado** desde la API en marcha |
| `vuelos-eventos-asyncapi.yaml` | Vista AsyncAPI: exchange, colas y sobre de los eventos |
| `eventos/` | Un JSON Schema por tipo de evento ([README](eventos/README.md)) |
| `overlay/` | Parche RFC 7386 sobre la plantilla v2 ([README](overlay/README.md)) |
| `socios/` | Especificaciones de Alojamientos, Autos y Atracciones ([README](socios/README.md)) |

## Cómo se conecta

- v2 propio = plantilla + `overlay/` vía `scripts/build-contract-v2.js` (`npm run contract:v2:build`).
- El OpenAPI de e-commerce sale de `scripts/export-openapi.js` (`npm run contract:export`, con `OPENAPI_URL`).
- Los esquemas de eventos los valida `src/modules/vuelos/common/event-schemas.ts`; CI ejecuta `contract:events:check`.
- Los tests (`contract-v2-build.spec`, `contract.integration.spec`) fallan si un generado está desactualizado.

## Cuaderno y auditorías

- Semana 7 · contratos → [RETO-2-CORTO.md](../src/modules/vuelos/docs/RDA2-docs/auditorias/RETO-2-CUADERNO/RETO-2-CORTO.md)
- C01 eventos y contratos → [C01](../src/modules/vuelos/docs/RDA2-docs/auditorias/C01-AUDITORIA-2026-10-26-eventos-contratos-microservicios.md)
- C02 contrato v2 → [C02](../src/modules/vuelos/docs/RDA2-docs/auditorias/C02-AUDITORIA-2026-10-26-contrato-v2.md)

## Más a fondo

- [Comparación v1 vs v2](../src/modules/vuelos/docs/RDA2-docs/COMPARACION-CONTRATOS-V1-V2.md)
- [Contratos de eventos](../src/modules/vuelos/docs/RDA2-docs/CONTRATOS-DE-EVENTOS.md)
- [Módulo Vuelos](../src/modules/vuelos/README.md)

← Volver a [README principal](../README.md)
