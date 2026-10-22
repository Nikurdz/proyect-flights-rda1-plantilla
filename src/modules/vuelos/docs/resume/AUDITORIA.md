# Auditoría 28-sep-2026 (inicio)

**Estado:** plantilla con mocks. 22 endpoints declarados, 0 % funcional.
**Hallazgos:** 7 críticos · 7 altos · 6 medios · 5 bajos.

## Críticos
- C1 Controlador devuelve `{}` y no llama al servicio
- C2 Servicio muerto (CRUD viejo)
- C3 Sin base de datos: entidad no registrada
- C4 Entidad `Vuelo` no sirve (faltan Hold, Booking, Ticket…)
- C5 Seguridad solo decorativa: rutas protegidas son públicas
- C6 Idempotencia sin aplicar: riesgo de doble cobro
- C7 Rutas sin prefijo: chocan con otros dominios

## Altos
- A1 DTOs sin validar (enums, email, UUID, URL)
- A2 Reglas de negocio sin codificar (origen ≠ destino, infantes ≤ adultos)
- A3 Parámetros sin validar (`limit`, `date`)
- A4 Respuestas vacías, no cumplen el contrato
- A5 Errores `ProblemDetails` sin implementar
- A6 Faltan helmet, throttler, jwt
- A7 `synchronize` sin migraciones

## Medios
- M1 Código muerto: `CreateVueloDto`, `VueloResponseDto`
- M2 `_links` HATEOAS que el contrato no pide
- M3 Paginación por cursor sin implementar
- M4 Webhooks sin dispatcher, firma ni reintentos
- M5 Sin logs, trazas ni eventos de dominio
- M6 Sin trazabilidad SRS → YAML → código (millas, 3DS, antifraude, PNR)

## Bajos
- B1 `@ApiTags` repetido en cada método
- B2 Dinero como string sin validar formato
- B3 Fechas de la entidad tipadas como string
- B4 Falta `@HttpCode(201/204)` en POST y DELETE
- B5 TODO en comentarios, sin JSDoc ni scripts de test

## Qué hacer
* Servicio real · persistencia (TypeORM + migraciones) ·
*  JWT con scopes ·
*  `IdempotencyKeyGuard` en los POST ·
* prefijo de rutas ·
* DTOs estrictos ·
* filtro `ProblemDetails` global ·
* paginación por cursor ·
* webhooks firmados con HMAC.

## Pruebas
- Contrato OpenAPI de los 22 endpoints
- Errores 400 / 404 / 409 / 410 / 422 / 429
- Doble reserva simultánea (uno 201, otro 409)
- Expiración del hold
- Idempotencia con la misma clave 3 veces
- Webhooks con caída del receptor (reintentos)
- Carga: `POST /search` p95 < 3 s

**Cierre:** pruebas de contrato y seguridad en cada PR; persistencia y carga antes de RDA2.
