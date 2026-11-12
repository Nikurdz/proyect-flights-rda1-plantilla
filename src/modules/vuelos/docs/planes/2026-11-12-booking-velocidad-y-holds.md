# Plan de implementación: velocidad v2, offset real, holds reemplazables, salud y eventos (pedido de Booking)

- **Fecha:** 2026-11-12
- **Agente:** Claude Code Desktop
- **Área:** backend/BD
- **Rama:** `vuelos`

## Objetivo
Booking midió la integración: la búsqueda v2 de RAM tarda 2,3 s y el mapa de asientos 2 s (meta < 1 s). Pide además fecha local de Ecuador y horas con su offset real, rehacer un hold con los asientos del hold anterior de la misma compra, un `/health` sin token que no toque la base y `/eventos?after=` por índice.

## Alcance
- Incluye: rendimiento de búsqueda y mapa de asientos v2, offset real en todas las horas de la API v2 (respuestas, `/eventos`, webhooks v2), rehacer hold del mismo usuario y oferta, `/api/v2/vuelos/health` sin consultar la base en cada petición, `/eventos` en una consulta y sin saltar eventos, índices.
- No incluye: cambios de v1 ni de la web, del stock enviado a Booking (`date`/`time_slot` siguen en UTC), de rutas, OAuth, nombres de campos o códigos de error; el filtro por dueño del feed `/eventos` (se propone aparte).

## Contexto y referencias
Línea base medida desde Ecuador contra producción (mediana de 5): búsqueda v2 UIO→GYE 2,32 s, mapa de asientos v2 1,09 s, `/api/v2/vuelos/health` 0,58 s, `/api/v1/health/live` (solo red) 0,38 s. La API está en Azure westus y la base en Aiven (New Jersey): cada consulta cuesta ~60-80 ms. La búsqueda hace ~27 consultas secuenciales (un `save` por oferta en su propia transacción), el mapa 6-9 (3 duplicadas). La búsqueda por día local del aeropuerto de origen (`1f4d2e9`) aún no está desplegada.

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `services/search.service.ts` | Ofertas e itinerarios en una transacción con INSERT multifila; familias de tarifa en caché (60 s); tramos en paralelo |
| `common/airport-zones.ts` | Precarga del catálogo de zonas |
| `services/offers.service.ts`, `v2/booking-view-v2.service.ts` | Mapa de asientos: una sola carga de datos, consultas en paralelo, sin duplicados |
| `common/date.util.ts`, interceptor v2, webhooks v2 | `toZonedIso`: salida/llegada en la zona del aeropuerto, el resto en Ecuador (-05:00) |
| `services/offers.service.ts` (`createHoldWithin`) | Libera en la misma transacción el hold activo del mismo dueño y oferta que tenga los asientos pedidos |
| `v2/health-v2.service.ts` | Foto en memoria refrescada cada 30 s |
| `v2/outbox-v2.service.ts` | Una consulta con subselect; solo filas con más de 2 s |
| `migrations/` | Índices `vuelos_tickets(passengerId)`, `vuelos_outbox(createdAt)` |

## Impacto en la API / contrato
Ninguno en rutas, campos ni códigos. Las horas v2 pasan de `…Z` a `…-05:00` (mismo instante, `format: date-time` lo admite); nota en el overlay v2. Se avisa a Booking antes de publicar.

## Pasos
1. Rendimiento (búsqueda, mapa), salud, eventos e índices.
2. Offset real en v2.
3. Hold reemplazable.
4. Pruebas, migración, contrato, medición y despliegue.

## Riesgos y decisiones abiertas
- La latencia API↔base es estructural; si no basta, acercar API y base y `MIN_REPLICAS=1`.
- El feed `/eventos` no filtra por dueño: cambio aparte con aviso a Booking.

## Verificación
`npm run lint`, `npm run build`, `npm test` completo, `migration:check:vuelos` = 0, `contract:v2:build`; medición antes/después contra producción. Terminado cuando todo esté verde y publicado antes del martes 17-11.
