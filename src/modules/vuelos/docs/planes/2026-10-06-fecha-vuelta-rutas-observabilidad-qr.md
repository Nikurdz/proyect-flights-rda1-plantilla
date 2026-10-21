# Plan de implementación: fecha de vuelta sin reinicio, pasajeros en rutas populares, observabilidad admin y QR por pasajero

- **Fecha:** 2026-10-06
- **Agente:** Claude Code Desktop
- **Área:** backend/BD + frontend
- **Rama:** `vuelos`

## Objetivo
Corregir el reinicio de la búsqueda al cambiar la fecha del tramo de vuelta, permitir elegir el número de pasajeros en las rutas populares, dar al ADMIN observabilidad del sistema y emitir un código QR verificable por cada billete.

## Alcance
- Incluye: fix en `ResultsPage`, selector de pasajeros en `HomePage`, panel y endpoints de observabilidad (datos de BD + métricas en memoria + `/health`), QR firmado por pasajero con página pública de verificación.
- No incluye: tarjetas de embarque (`BoardingPass` sigue `501`), QR dentro del correo (texto plano; solo enlace), exportación de métricas a Prometheus.

## Contexto y referencias
- Bug: `frontend/src/features/results/ResultsPage.tsx:63-69` (el efecto de reinicio depende de `inbound`).
- Rutas populares: `frontend/src/features/search/HomePage.tsx` (`adt=1` fijo); `PassengerSelector` ya implementa las reglas (≥1 adulto, bebés ≤ adultos, máx. 9).
- Observabilidad: `CorrelationInterceptor`, `VuelosProblemDetailsFilter`, `DomainEventBus`, `ReconciliacionService`, `HoldsSweeper`; tablas `ecom_*` y `vuelos_*`.
- QR: `Ticket` (un e-ticket por pasajero), `common/vuelos-config.ts` (secretos), contrato `Ticket` sin `additionalProperties:false`.

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `frontend/src/lib/search.ts`, `ResultsPage.tsx` | Clave pura `outboundSelectionKey` sin `inbound`. |
| `frontend/src/features/search/HomePage.tsx` | Estado de pasajeros + `PassengerSelector`; enlaces con `buildSearchPath`. |
| `common/ticket-qr.ts` | Código `v1.<eTicket>.<pnr>.<hmac>` (HKDF desde `JWT_SECRET`), verificación en tiempo constante. |
| `dto/booking.dto.ts`, `services/bookings.service.ts`, contrato | `qrPayload` opcional en `Ticket`. |
| `ecommerce/ordenes/*` | `qr` por pasajero en la vista de la orden; `GET /tickets/verificar` público con límite de tasa. |
| `ecommerce/admin/*`, `common/runtime-metrics.ts` | `GET /admin/observabilidad/resumen` y `/runtime`; `GET /health`. |
| `migrations/` | Índices `ecom_pagos(creadoEn)`, `ecom_ofertas(creadaEn)`, `ecom_notificaciones(creadoEn)`. |
| `frontend/` | `qrcode.react`, QR en confirmación y recuperación, `/verificar/:codigo`, pestaña "Observabilidad". |

## Impacto en la API / contrato
`Ticket.qrPayload` opcional, nullable y de solo lectura (no entra en `required`). Rutas nuevas fuera del contrato del núcleo: `GET /tickets/verificar`, `GET /admin/observabilidad/*`, `GET /health`.

## Pasos
1. Frontend: fix de fecha de vuelta y selector en rutas populares (+ pruebas).
2. Backend: QR y verificación (+ integración y contrato).
3. Frontend: QR y página de verificación.
4. Backend: observabilidad, health y migración (+ integración).
5. Frontend: panel de observabilidad.
6. Pruebas completas, builds, revisión en el navegador, documentación.

## Riesgos y decisiones abiertas
- La clave del QR deriva de `JWT_SECRET`: cambiarla invalida los QR ya emitidos (igual que `DATA_ENCRYPTION_KEY` con los datos cifrados).
- Las métricas en memoria son por proceso y se reinician con cada arranque; se rotulan "desde el arranque". Lo durable sale de la BD.
- Las agregaciones por ventana recorren tablas pequeñas del prototipo; se acotan la ventana (24 h/7 d), el caché (15-30 s) y los índices nuevos.
- La verificación pública no devuelve datos personales y responde `valido:false` ante cualquier código inválido.

## Verificación
- `npm test` con `TEST_DATABASE_URL`: QR determinista, verificación válida/alterada/inexistente, permisos 401/403/200 de observabilidad, cifras coherentes tras una compra, `/health`; `npm run build`; `migration:run` y `migration:check:vuelos` exit 0.
- Frontend: `npm test`, `npm run build`, recorrido manual (ida y vuelta, rutas populares con pasajeros, QR y verificación, panel admin).
