# Plan de implementación: Frontend, vuelos agotados en resultados

- **Fecha:** 2026-10-08
- **Agente:** Antigravity
- **Área:** frontend
- **Rama:** `vuelos`

## Objetivo
Mostrar en los resultados los vuelos sin cupo para el grupo buscado (campo `agotado` de `ItinerarioDto`) como no seleccionables, y manejar el `409 SEAT_TAKEN` al crear la oferta.

## Alcance
- Incluye: tipo `agotado`, tarjeta atenuada con etiqueta «Agotado» sin botón, contadores y «Desde» solo con vuelos disponibles, estado «sin disponibilidad» si todos están agotados, mensaje y refresco ante `SEAT_TAKEN` en `POST /ofertas`.
- No incluye: cambios de backend ni del contrato.

## Contexto y referencias
`GET /disponibilidad` (nuevo `agotado`, agotados al final, `sinDisponibilidad` con `fechasAlternativas`); `POST /ofertas` responde 409 `SEAT_TAKEN`.

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `frontend/src/api/schema.d.ts` | `agotado: boolean` en `ItinerarioDto` |
| `frontend/src/features/results/FlightCard.tsx` | Variante agotada |
| `frontend/src/features/results/ResultsPage.tsx` | Contadores, vacío si todos agotados, manejo `SEAT_TAKEN` |

## Impacto en la API / contrato
Ninguno (el frontend solo consume).

## Pasos
1. Tipos. 2. Tarjeta. 3. Página de resultados. 4. Build y prueba contra backend.

## Riesgos y decisiones abiertas
- Carrera: un vuelo con cupo puede agotarse tras la búsqueda; se resuelve con el mensaje y el refresco.

## Verificación
`npm run build` del frontend sin errores; revisión manual con BOG→SCL día +3.
