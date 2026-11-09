# Plan de implementación: todo el sistema en hora de Ecuador

- **Fecha:** 2026-11-08
- **Agente:** Claude Code Desktop
- **Área:** frontend y backend (días y textos)
- **Rama:** `vuelos`

## Objetivo
El back office pedía y mostraba horas en UTC: a las 7:32 PM en Ecuador (00:32 UTC del día siguiente) crear un vuelo «hoy 9:30 PM» daba «La salida debe ser una fecha y hora futuras». El sistema entero debe reflejar la hora de Ecuador (UTC-5, sin horario de verano).

## Decisiones
- **Se muestra y se escribe en hora de Ecuador; se guarda e intercambia en UTC.** Los instantes `…Z` no cambian (almacenamiento, API v2, eventos, stock hacia Booking).
- Frontend: `SYSTEM_TIME_ZONE = America/Guayaquil` y los valores por defecto de `formatDateTime`/`formatDay`/`formatTimeInTimeZone`; `timeZoneOf()` devuelve Ecuador para todos los aeropuertos (un interruptor, `SHOW_AIRPORT_LOCAL_TIME`, vuelve a la hora local de cada aeropuerto); los campos `datetime-local` se escriben en hora de Ecuador y se envían como instante UTC; «hoy» y la fecha mínima de búsqueda son el día de Ecuador; todas las pantallas del back office dejan de decir «UTC».
- Backend: la búsqueda v1 (web), el catálogo `/disponibilidad`, la pasarela GraphQL y los filtros de día del back office leen una fecha como **día calendario de Ecuador** (`ecuadorDayRange`, `todayEcuador`); el día de Ecuador empieza a las 05:00 UTC. Los correos imprimen la hora con `formatEcuador`.
- **La API v2 (Booking) sigue con días UTC:** su feed, el estado de vuelo por fecha y los `item_id`/`time_slot` del stock dependen de ello; cambiarlo movería artículos ya registrados en Booking.
- Los filtros «Creadas desde/hasta» de Reservas siguen siendo días UTC (el backend los interpreta así) y la pantalla lo dice.

## Impacto
Un vuelo que sale a las 21:00 de Bogotá (02:00 UTC del día siguiente) aparece al buscar el día que sale en Ecuador. La API v2 no cambia.

## Verificación
`date.util.spec`, `ecuador-time.integration.spec` (v1 por día de Ecuador, v2 por día UTC), pruebas de frontend de conversión y de «futuro» en Ecuador; lint, build y suites completas.
