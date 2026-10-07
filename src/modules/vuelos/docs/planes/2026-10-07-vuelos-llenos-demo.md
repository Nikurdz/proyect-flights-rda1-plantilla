# Plan de implementación: vuelos llenos para la demo

- **Fecha:** 2026-10-07
- **Agente:** Claude Code Desktop (backend/BD) y Antigravity (UI)
- **Área:** backend/BD y frontend
- **Rama:** `vuelos`

## Objetivo
Poder mostrar que el sistema rechaza una reserva por falta de asientos, y confirmar que la retención del cupo (hold) es real. Hasta ahora un vuelo sin cupo desaparecía de la búsqueda (parecía "sin resultados") y solo `LA1500` tenía pocos asientos.

## Alcance
- Incluye: un conjunto fijo de vuelos llenos o casi llenos aplicado por el seed de forma idempotente; el catálogo muestra el vuelo como `agotado`; pruebas de integración (vuelo lleno, grupo que no cabe, retención y vencimiento); UI de la etiqueta «Agotado» y del `409 SEAT_TAKEN`.
- No incluye: cambiar el contrato del núcleo (`/search` sigue filtrando lo que no se puede vender), una acción de admin para llenar vuelos en vivo, ni asignar asientos numerados a los vuelos llenos.

## Contexto y referencias
- Retención: `OffersService.createHoldWithin` descuenta con `InventoryService.reserve` (`UPDATE` condicional, `409 SEAT_TAKEN`); `HoldsSweeper`/`expireDueHolds` la devuelven una sola vez.
- RF-SHP-019 (últimos asientos) y RF-SHP-024 (fechas alternativas).

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `seed/flights.seed.ts` | `DEMO_SCENARIOS` y `seedDemoScenarios` (solo baja el contador y no toca vuelos con hold o reserva). |
| `seed/seed.ts` | Llama a `seedDemoScenarios` tras `seedFlights`; `SEED_DEMO_SCENARIOS=false` lo desactiva. `start:render` ya ejecuta el seed, así que también aplica a la base desplegada. |
| `services/search.service.ts` | `findDirectFlights(..., { includeSoldOut })`; el resto de llamadores sigue filtrando. |
| `ecommerce/catalogo/*` | `ItinerarioDto.agotado`; agotados al final y sin distintivos; `sinDisponibilidad` y fechas alternativas solo con lo reservable. |
| `testing/demo-scenarios.integration.spec.ts` | Pruebas nuevas. |
| `frontend/` | Etiqueta «Agotado», sin botón de elegir, mensaje ante `409 SEAT_TAKEN`. |

## Impacto en la API / contrato
`GET /disponibilidad` (e-commerce, no el contrato del núcleo) añade `agotado` por itinerario. El contrato `vuelos-openapi.yaml` no cambia.

## Pasos
1. Seed de escenarios + pruebas. 2. Catálogo. 3. UI. 4. Guía de defensa y README.

## Riesgos y decisiones abiertas
- El contador queda en 0 sin asientos numerados asignados: el mapa de ese vuelo se ve libre pero no se puede comprar.
- Los días son relativos al día en que corre el seed; con cada despliegue se reaplican a los días de ese momento.
- Reaplicar el seed baja otra vez un vuelo de demo al que se le canceló una reserva (es lo deseado).

## Verificación
`npm test` con `TEST_DATABASE_URL` (incluye `demo-scenarios.integration.spec.ts`), `npm run build`, y una prueba manual: BOG→SCL a +3 días muestra `LA800` «Agotado» al final y `POST /ofertas` sobre él responde `409 SEAT_TAKEN`.
