# Plan de implementación: fecha local del aeropuerto en la búsqueda v2 y asientos apartados (HELD) en el hold

- **Fecha:** 2026-11-10
- **Agente:** Claude Code Desktop
- **Área:** backend/BD (Partes A y B) y frontend (estado «apartado» del mapa de asientos, Parte B)
- **Rama:** `vuelos`

## Objetivo
Booking reportó tres problemas en la API v2 (`/api/v2/vuelos/*`). Se quiere que `departureDate` sea el día local del aeropuerto de origen (para validar y para filtrar), y que un hold pueda apartar asientos concretos, visibles como `HELD` / `isAvailable:false` para Booking y para nuestra web, y liberados al vencer, soltar o emitir.

## Alcance
- Incluye:
  - **Parte A — fechas:** `POST /vuelos/search` (v2) y la búsqueda de cambio de fecha leen la fecha como día local del aeropuerto de origen.
  - **Parte B — asientos:** `assignedSeats` en el hold, fila «asiento apartado», estado `HELD` en el seatmap v2 y en el mapa de la web.
- No incluye:
  - Check-in y cancelación desde nuestra web de reservas de Booking: Booking indica que para RAM ya funcionan. (La exploración no encontró recuperación pública por PNR + apellido para reservas sin `Orden`; se verificará al probar y, si falla, se reporta aparte.)
  - Stock, feed de eventos y estado de vuelo, que siguen en UTC; otras aerolíneas.

## Contexto y referencias
1. **Fechas (prioridad).** `POST /vuelos/search` lee `departureDate` como día UTC. Desde las 19:00 de Ecuador la fecha de hoy responde 400 «departureDate … is before the current date», y un vuelo de las 23:06 (Ecuador) solo aparece buscando el día siguiente. Causa: `VuelosV2Controller.search` llama a `SearchService.search(body)` sin opción de zona → `assertChronology` usa `todayUtc()` y `findDirectFlights` usa `utcDayRange`. La web (v1, `/disponibilidad`, GraphQL) ya usa el día de Ecuador con offset fijo −5 (plan `2026-11-08-hora-ecuador.md`); no hay soporte para Galápagos (UTC−6).
2. **`assignedSeats` en el hold.** Responde 400 porque `HoldRequestDto` no declara el campo y el `ValidationPipe` tiene `forbidNonWhitelisted`.
3. **Asiento `HELD` en el seatmap.** Un hold solo descuenta cupo (`asientosDisponibles`); no existe ninguna fila «asiento apartado». El seatmap solo lee `vuelos_seat_assignments` (asientos emitidos).

## Cambios previstos

### Parte A — fecha local del aeropuerto de origen
| Archivo / módulo | Cambio |
|------------------|--------|
| `common/date.util.ts` | Funciones puras nuevas con `Intl.DateTimeFormat`: `zonedDayRange(date, timeZone)` (medianoche local → instante UTC; fin = medianoche local del día siguiente), `todayInZone(timeZone, now)` y `dayInZone(instant, timeZone)`. `ecuadorDayRange`/`todayEcuador` no cambian. |
| `common/airport-zones.ts` (nuevo) | Servicio `AirportZones` en `VuelosCoreModule` (provisto y exportado): `zoneOf(iata)` lee `Localidad.zonaHoraria` con `DataSource.manager` (como `bookings.service.ts`, sin añadir `Localidad` al `forFeature`), caché en memoria, y `America/Guayaquil` si el código no existe. |
| `common/business-rules.ts` | `assertChronology(legs, today)` acepta también una función `(leg) => string`, para calcular «hoy» por tramo en la zona de su origen. El valor por defecto `todayUtc()` se conserva. |
| `services/search.service.ts` | Opción `originLocalDay` junto a `ecuadorDay`: en `search`, «hoy» por tramo = `todayInZone(zoneOf(leg.origin))`; en `findDirectFlights`, `zonedDayRange(departureDate, zoneOf(origin))`. |
| `v2/vuelos-v2.controller.ts` | `search(body, { originLocalDay: true })`. Es el arreglo que pide Booking. |
| `services/date-change.service.ts` | La búsqueda de opciones pasa `originLocalDay` (buscaba por día UTC: el mismo defecto en el cambio de fecha). |
| Overlay v2, `CLAUDE.md`, `README.md`, `docs/ARQUITECTURA-EVENTOS.md`, comentario de `DateNavigator.tsx` | Documentar la regla. |

v1 `/search`, `/disponibilidad` y GraphQL quedan en día de Ecuador (sin cambio de comportamiento).

**Se queda en UTC, a propósito** (se documenta, no se toca): `date`/`time_slot` del stock que enviamos a Booking (el overlay lo declara UTC y cambiarlo movería artículos ya registrados), el estado de vuelo por fecha (`flight-status.service.ts`, `flight-ops-v2.service.ts`) y el feed de eventos. Los instantes de la respuesta siguen en `…Z`.

### Parte B — `assignedSeats` en el hold y asiento `HELD`
| Archivo / módulo | Cambio |
|------------------|--------|
| `entities/flight-hold-seat.entity.ts` (nueva) | Tabla `vuelos_flight_hold_seats` (`id`, `holdId` FK con `ON DELETE CASCADE`, `vueloId` FK, `seatNumber` varchar(4)), **única `(vueloId, seatNumber)`**: es la garantía contra carreras, igual que en `vuelos_seat_assignments`. Las filas existen solo mientras el hold está `HELD`. Migración nueva en `migrations/` (generada contra el esquema anterior; `migration:check:vuelos` debe salir 0). |
| `dto/hold.dto.ts` | `assignedSeats?: SeatAssignmentDto[]` (reutiliza `SeatAssignmentDto` de `dto/booking.dto.ts`, `@IsOptional @ValidateNested @ArrayMaxSize`). Opcional: v1 no cambia para quien no lo envía. |
| `services/offers.service.ts` | `createHoldWithin` valida cada asiento (segmento pertenece a la oferta → 400; asiento existe en la grilla → 422 `SEAT_CABIN_MISMATCH`; repetido en la petición → 409; no más asientos por tramo que pasajeros con asiento), con las comprobaciones de `bookings.service.ts` extraídas a un helper común. Pre-chequeo contra `SeatAssignment` y contra `FlightHoldSeat` de holds activos → `seatTakenProblem(seat, segment)` (409 `SEAT_TAKEN`). Inserta las filas; la violación de la única se traduce a `SEAT_TAKEN` (como `mapBookingUniqueViolation`). El reintento que ya existe en `createHold` (`expireDueHolds()` y un segundo intento ante `SEAT_TAKEN`) cubre el asiento retenido por un hold vencido aún no barrido. `transition()` (RELEASED/EXPIRED) borra las filas del hold en la misma transacción. `getSeatmap` (v1): `isAvailable` también es `false` para asientos de holds activos (`status='HELD' AND expiresAt > now`). Nuevo método público `replaceHoldSeatsWithin(manager, holdId, seats)` para la web. |
| `services/bookings.service.ts` (`createBookingWithin`) | El pre-chequeo también rechaza un asiento retenido por **otro** hold activo (409 `SEAT_TAKEN`, nada se consume). Al consumir el hold borra sus `FlightHoldSeat` antes de insertar los `SeatAssignment` (HELD → BOOKED/TICKETED sin chocar con la única). Si la reserva no trae `assignedSeats`, los asientos apartados simplemente se liberan (no se pueden atribuir a un pasajero). |
| `v2/booking-view-v2.service.ts` | `seatStatuses` añade `HELD` para los asientos de holds activos; `isAvailable: status === 'AVAILABLE'` ya los deja en `false`. El tipo `SeatStatus` ya incluye `HELD`. |
| `ecommerce/ofertas/ofertas.service.ts` (web propia; la oferta ya tiene su hold GDS desde `armar()`) | Al guardar pasajeros con asientos → `replaceHoldSeatsWithin` (misma transacción). `verificarAsientos` también considera ocupado un asiento retenido por otro hold. El mapa de la web marca esos asientos como no disponibles (excepto los del propio hold de la oferta, que el cliente debe seguir viendo como suyos) y `GET /ofertas/{id}/asientos` añade un campo opcional `status` por asiento: `AVAILABLE`, `HELD` (apartado por otro hold) u `OCCUPIED` (emitido). `isAvailable` se conserva. |
| `frontend/src/api/types.ts` (`AsientoMapaDto`) | `status?: 'AVAILABLE' \| 'HELD' \| 'OCCUPIED'`. |
| `frontend/src/features/checkout/SeatMap.tsx` | Rama propia para `HELD`: color y etiqueta «apartado» distintos de «ocupado», no seleccionable, con texto accesible (`aria-label`) y entrada en la leyenda, dentro de la paleta RAM Alliance. `SeatSelector.tsx` y `AdminFlightsPage.tsx` usan `SeatMap`: comprobar que no se rompen; el admin sigue mostrando `takenInfo` solo para emitidos. (Con el skill `frontend-design:frontend-design`.) |

## Impacto en la API / contrato
- **v2 (overlay `contracts/overlay/vuelos-v2-ram-alliance.overlay.yaml`, luego `npm run contract:v2:build`):** descripción de `departureDate` («fecha local del aeropuerto de origen»); `assignedSeats` en `HoldRequest` (la plantilla de Booking no lo trae en el hold) y corrección de las notas que dicen «un hold no fija asientos» (§7, `getSeatMap`, `createHold`).
- **E-commerce:** `status` opcional en el mapa de asientos; regenerar `vuelos-ecommerce-openapi.yaml` (`contract:export`, con la API levantada) y `docs/MODELO-DE-DATOS.md` (`docs:modelo`).
- **v1 (`contracts/vuelos-openapi.yaml`):** sin cambios en el archivo. `assignedSeats` en el hold es opcional; la búsqueda de cambio de fecha (servicio compartido por v1 y v2) pasa a leer la fecha como día local del origen.

## Pasos
1. Este plan.
2. Parte A: utilidades → `AirportZones` → search / cambio de fecha → pruebas → overlay y documentación.
3. Parte B: entidad + migración → DTO → offers / bookings → vista v2 → web → pruebas → contratos y documentación.
4. Lint, build y suites completas. Sin commit ni despliegue hasta que se pida.

## Riesgos y decisiones abiertas
- La búsqueda de cambio de fecha es un servicio compartido: v1 también pasa de día UTC a día local del origen. Para aeropuertos de Ecuador coincide con lo que la web ya muestra.
- Un aeropuerto sin fila en `ecom_localidades` (o con una zona que el motor no conoce) se trata como `America/Guayaquil`.
- La caché de zonas vive en memoria por proceso; un aeropuerto no se edita ni se borra, así que no hay invalidación.
- Parte B: si la reserva llega sin `assignedSeats`, los asientos apartados por su hold se liberan (decisión documentada).
- La migración de la Parte B se prueba contra datos producidos por el código anterior, no solo contra un esquema vacío.

## Verificación
Unitarias:
- `date.util.spec.ts`: `zonedDayRange`/`todayInZone` para `America/Guayaquil` (05:00Z) y `Pacific/Galapagos` (06:00Z), en los bordes 04:59Z / 05:00Z / 06:00Z.
- `business-rules.spec.ts`: `assertChronology` con «hoy» por tramo.
- `db-errors` y el helper de validación de asientos (Parte B).

Integración (`TEST_DATABASE_URL`, Docker arriba):
- `ecuador-time.integration.spec.ts`: se **invierte** la expectativa de v2 (lista el vuelo de la noche en su día local); caso con el reloj fijado a las 19:30 de Ecuador → buscar «hoy» responde 200, no 400; caso GPS (UTC−6).
- `v2.integration.spec.ts` (Parte B): hold con `assignedSeats` → 201; segundo hold con el mismo asiento → 409 `SEAT_TAKEN`; seatmap muestra `HELD` / `isAvailable:false` (validado con `contract.check`); `DELETE` del hold → `AVAILABLE`; hold vencido → `AVAILABLE`; booking del hold → `TICKETED`; booking con un asiento apartado por otro hold → 409 y el hold se conserva.
- Carrera: dos holds en paralelo por el mismo asiento → un 201 y un 409.
- Web: asiento elegido en una oferta aparece `HELD` en el seatmap v2 y no disponible en el mapa de otra oferta; verificación en el navegador (dos ofertas, «apartado» en la otra), `npm run lint` y build en `frontend/`.

Cierre: `npm run lint` (0 errores), `npm run build`, `npm test`, `npm run migration:check:vuelos`, `contract-v2-build.spec` y `contract.integration.spec` en verde. Verificación manual con los pasos de Booking (hold con `assignedSeats` → 201/409; seatmap `HELD` → liberar → `AVAILABLE`).
