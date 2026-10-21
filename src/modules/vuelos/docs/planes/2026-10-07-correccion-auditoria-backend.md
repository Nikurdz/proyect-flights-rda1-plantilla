# Plan de implementación: corrección de la auditoría de backend 2026-10-06

- **Fecha:** 2026-10-07
- **Agente:** Claude Code Desktop
- **Área:** backend/BD
- **Rama:** `vuelos`

## Objetivo
Cerrar los hallazgos de `AUDITORIA-10-6-2026-Backend.md` (6 altos, 9 medios, 8 bajos; 0 críticos abiertos), priorizando dinero, resiliencia de pago e inventario lógico.

## Alcance
- Incluye: A1–A6, M1–M9, B1–B8 de la auditoría; migración para A1; tests de integración nuevos; actualización de `contracts/vuelos-openapi.yaml` donde aplique.
- No incluye: outbox/broker (RDA2), limiter distribuido en Redis, PSP real, cambios de frontend, módulos de otros equipos.

## Contexto y referencias
`AUDITORIA-10-6-2026-Backend.md` §2–§5. CLAUDE.md: atomicidad (`createHoldWithin`/`createBookingWithin`, `InventoryService` único escritor), saga de compra, reglas de migraciones.

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `ecommerce/ordenes/compras.service.ts:223` | A4: `mercados.obtener(...).catch(() => null)`, idioma `es` por defecto; la compensación siempre registra `FALLIDA_COMPENSADA` |
| `services/cancellation.service.ts:140`, `entities/`, `services/bookings.service.ts`, `migrations/` | A1: desglose base/impuestos por pasajero congelado; `amountsFor()` lo usa; migración con backfill |
| `services/offers.service.ts:65`, `services/search.service.ts:171` | A2: seatmap resta asientos de holds vivos, o se documenta como mapa de cabina |
| `render.yaml`, `README.md` del módulo | A3/A5/A6: `TRUST_PROXY=1`, documentar límites RDA1 |
| `common/problem-details.filter.ts`, `ecommerce/common/rate-limiter.ts` | M4: `Retry-After` en 429 y 409 por contención |
| `common/business-rules.ts` | M8 (cronología por instante), M9 (normalizar documento) |
| `ecommerce/ordenes/dto/ordenes.dto.ts`, `pagos.service.ts` | M5: 422 temprano por token↔marca incoherente |
| `services/inventory.service.ts` | M6: warning + métrica cuando `restore` recorta |
| `services/cancellation.service.ts`, `date-change.service.ts`, `holds-sweeper.service.ts` | M1/M2/M7: reutilizar `OPEN`, dedup de opciones, purga de vencidos |
| `services/bookings.service.ts:247` | M3: documentar excepción (decisión abierta) |
| varios (`api-problem-responses.ts`, `money.util.ts`, `flight-status.service.ts`, `vuelos-config.ts`, DTOs, jobs) | B1–B8 higiene |

## Impacto en la API / contrato
`contracts/vuelos-openapi.yaml`: enum de estados de check-in (B5) y `maximum` de `quantity` (B4). `Retry-After` ya está documentado. Lo demás: ninguno.

## Pasos
1. B-1: A4 → A1 (entidad + migración + tests) → A2 → documentación A3/A5/A6. Commit.
2. B-2: M4, M8, M9, M5, M6, M1/M2/M7; M3 según decisión. Commit.
3. B-3: B1–B8 (grep previo de nombres de jobs para B8). Commit.
4. Re-ejecutar §5 de la auditoría y añadir addendum con resultados.

## Riesgos y decisiones abiertas
- A1 exige migración: generar contra BD con esquema previo; `migration:check:vuelos` exit 0; sin default tipo array; no regenerar `DATA_ENCRYPTION_KEY`.
- M3: bloquear asientos en `BASIC` contradice "selección opcional y gratuita"; recomendado documentar, no bloquear.
- A2: restar holds solo si el hold ya guarda asientos; si no, documentar.
- B8 puede romper tests/métricas por nombre de job.

## Verificación
`npm run build`, `npm test`, y con `TEST_DATABASE_URL` (BD desechable) los `testing/*.integration.spec.ts` con casos nuevos: A1 (cambiar `precioBase` no altera el quote), A4 (mercado borrado → una sola `FALLIDA_COMPENSADA`), A2, M4, M1/M2/M7, M8/M9. `migration:run` desde cero + `migration:check:vuelos`. Terminado = 0 altos abiertos, medios/bajos cerrados o documentados.
