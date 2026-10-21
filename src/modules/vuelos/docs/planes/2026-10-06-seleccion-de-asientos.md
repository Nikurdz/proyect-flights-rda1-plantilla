# Plan de implementación: selección de asientos en la compra

- **Fecha:** 2026-10-06
- **Agente:** Claude Code Desktop
- **Área:** backend/BD + frontend (checkout)
- **Rama:** `vuelos`

## Objetivo
Permitir que cada pasajero elija su asiento en cada trayecto durante el checkout. El núcleo GDS ya cumple el contrato (`GET /offers/{offerId}/seatmap`, `assignedSeats`, `SEAT_TAKEN`, `SEAT_CABIN_MISMATCH`, `INFANT_SEAT_NOT_ALLOWED`); falta que el flujo e-commerce lo use.

## Alcance
- Incluye: mapa de asientos por trayecto de una oferta, asiento opcional por pasajero y trayecto, validación temprana, paso a la reserva GDS dentro de la misma transacción, asiento visible en la orden y en el comprobante, pruebas de concurrencia, mapa en el frontend.
- No incluye: cobro por asiento (el asiento no cambia el precio), cabinas distintas de economía, cambio de asiento post-venta (sigue `501`), check-in.

## Contexto y referencias
- Contrato: `contracts/vuelos-openapi.yaml` (seatmap, `assignedSeats`). **No se modifica**: la ruta nueva es del e-commerce y vive bajo `/ofertas`, fuera del contrato del núcleo.
- Núcleo: `common/seat-grid.ts`, `entities/seat-assignment.entity.ts` (único `vueloId + seatNumber`), `BookingsService.createBookingWithin` ya valida y escribe los asientos.
- La oferta e-commerce no expone el `offerId` del núcleo, por eso el mapa se sirve por `ofertaId`.

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `ecommerce/ofertas/entities/oferta.entity.ts` | `PasajeroDatos.asientos?: { trayectoId, asiento }[]` (viaja cifrado en `datosPasajeros`; hereda la orden vía `PasajeroOrden`). Sin migración: es `encryptedJson`. |
| `ecommerce/ofertas/dto/ofertas.dto.ts` | `AsientoElegidoDto`; `PasajeroDto.asientos` opcional; `MapaAsientosViewDto`; `PasajeroRegistradoDto.asientos`. |
| `ecommerce/ofertas/ofertas.service.ts` | `mapaAsientos(auth, ofertaId, trayectoId)`; `registrarPasajeros` valida: trayecto de la oferta, asiento existente, sin infante, uno por trayecto, sin repetir entre pasajeros, libre al momento. |
| `ecommerce/ofertas/ofertas.controller.ts` | `GET /ofertas/:id/asientos?trayectoId=` (solo dueño). |
| `ecommerce/ordenes/compras.service.ts` | `aSolicitudGds` pasa `assignedSeats`; antes de autorizar el pago se revisa que los asientos sigan libres (`SEAT_TAKEN` 409 **sin cobrar**). La restricción única sigue siendo la garantía final: si dos compras compiten, una se compensa. |
| `ecommerce/ordenes/*` (vista) | El asiento por trayecto sale en `PasajeroOrdenViewDto`. |
| `testing/ecommerce.integration.spec.ts` | Casos nuevos (ver Verificación). |
| `frontend/` | `SeatMap` en el checkout, un paso opcional por trayecto; el asiento se muestra en confirmación y "Mis viajes". |
| `README.md`, `CLAUDE.md` | Documentar la ruta y la regla. |

## Impacto en la API / contrato
Ninguno en `vuelos-openapi.yaml`. Se añade `GET /api/v1/ofertas/{id}/asientos` y el campo opcional `asientos` en `PUT /ofertas/{id}/pasajeros` (e-commerce, propio de este módulo).

## Pasos
1. Plan (este documento).
2. Backend: tipos y DTO, mapa, validación en `registrarPasajeros`.
3. Saga: `assignedSeats` + comprobación previa al pago.
4. Vista de orden con asiento.
5. Pruebas de integración y unitarias; `npm run build`.
6. Frontend: componente `SeatMap`, integración en `PassengerForm`/checkout, confirmación; tests; build.
7. Probar en el navegador (invitado y cliente), documentar.
8. Commit y push a `vuelos` solo si se pide.

## Riesgos y decisiones abiertas
- **Carrera por un asiento:** dos compras simultáneas. Mitigación: comprobación previa + restricción única + compensación ya existente (`FALLIDA_COMPENSADA`, la oferta vuelve a `ABIERTA` si el hold sigue vivo para elegir otro asiento).
- Los asientos no se bloquean al elegirlos (solo al emitir): es lo que el contrato define; el mapa puede quedar desactualizado y el error se explica al cliente.
- Opcional por diseño: si no se elige, no se asigna asiento (comportamiento actual).
- Infantes en brazos no ocupan asiento.

## Verificación
- `npm run build` limpio; `npm test` completo con `TEST_DATABASE_URL`.
- Integración: mapa solo para el dueño (401/403/404); asiento inexistente 422; infante 422; mismo asiento a dos pasajeros 409; asiento ya tomado se detecta antes del cobro (sin pago autorizado); compra con asientos emite y los refleja en la orden; dos compras paralelas por el mismo asiento: una emite y la otra queda compensada; el mapa marca el asiento como ocupado tras la compra.
- Frontend: `npm test`, `npm run build` y recorrido manual de la compra eligiendo asiento.
