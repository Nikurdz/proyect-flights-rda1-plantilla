# contracts/overlay/ — parche que convierte la plantilla v2 de Booking en nuestro contrato

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `vuelos-v2-ram-alliance.overlay.yaml` | JSON Merge Patch (RFC 7386) + mapa de notas por operación. Es lo único que se edita para cambiar el v2 |

## Cómo se conecta

- `scripts/build-contract-v2.js` aplica el overlay sobre `../vuelos-openapi-v2.yaml` y escribe `../vuelos-openapi-v2-ram-alliance.yaml`.
- Además hace pasadas mecánicas: ids UUID, quita respuestas 202 que no producimos, añade 429 a cada operación.
- Para regenerar: `npm run contract:v2:build`. El test `contract-v2-build.spec.ts` falla si el generado está desactualizado.
- Nunca edites el YAML generado ni la plantilla: edita el overlay o el script.

## Más a fondo

- [Comparación de contratos v1 y v2](../../src/modules/vuelos/docs/RDA2-docs/COMPARACION-CONTRATOS-V1-V2.md)
- [scripts/README](../../scripts/README.md)

← Volver a [contracts/README](../README.md)
