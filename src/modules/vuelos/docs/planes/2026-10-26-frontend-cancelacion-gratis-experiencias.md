# Plan de implementación: cancelación gratuita en reservas de experiencias (frontend)

- **Fecha:** 2026-10-26
- **Agente:** Antigravity
- **Área:** frontend
- **Rama:** `vuelos`

## Objetivo
El backend ya devuelve `cancelacionGratis: boolean` en cada reserva de experiencia. El frontend debe ofrecer «Cancelar reserva» solo cuando la reserva está CONFIRMADA y admite cancelación gratuita; si no, explicarlo en texto accesible en vez de dejar que el cliente choque con el 409.

## Alcance
- Incluye: tipo `ReservaExternaView`, helper `puedeCancelarReserva`, «Mis experiencias» y el resultado de la reserva; pruebas de vitest.
- No incluye: backend, contrato ni el manejo del 409 `EXTERNAL_RESERVATION_NOT_REFUNDABLE` (se conserva por si acaso).

## Contexto y referencias
`GET /reservas-externas`, `GET /reservas-externas/{id}`, `POST /experiencias/{id}/reservas` y `POST /reservas-externas/{id}/cancelar` devuelven `cancelacionGratis`.

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `frontend/src/api/types.ts` | `cancelacionGratis: boolean` en `ReservaExternaView` |
| `frontend/src/lib/experiencias.ts` | `puedeCancelarReserva(estado, cancelacionGratis)`; constante con el texto |
| `frontend/src/features/experiences/MyExperiencesPage.tsx` | Botón solo si CONFIRMADA y `cancelacionGratis`; si no, texto «Esta experiencia no admite cancelación gratuita» |
| `frontend/src/features/experiences/ExperienceDetailPage.tsx` | Mismo texto en el resultado de la reserva cuando es CONFIRMADA y no es cancelable gratis |
| `frontend/tests/unit/*` | Pruebas actualizadas/nuevas |

## Impacto en la API / contrato
Ninguno.

## Pasos
1. Tipo y helper.
2. UI en «Mis experiencias» y resultado de la reserva.
3. Pruebas, lint, test, build.

## Riesgos y decisiones abiertas
- Respuestas antiguas sin el campo: se trata como no cancelable (solo `=== true` habilita el botón).

## Verificación
`npm run lint`, `npm test`, `npm run build` en `frontend/`.
