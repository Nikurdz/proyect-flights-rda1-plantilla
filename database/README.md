# database/ — volcado SQL de referencia

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `booking_db_esquema_y_catalogos.sql` | `pg_dump` (Postgres 16) del esquema de `booking_db` con tablas y catálogos (62 `CREATE TABLE`). Solo consulta |

## Cómo se conecta

- **No es la fuente del esquema.** El esquema real sale de las entidades TypeORM: `synchronize` en desarrollo y migraciones en producción (`src/modules/vuelos/migrations/`).
- Úsalo para ojear tablas; puede ir por detrás de las entidades. El modelo al día es `src/modules/vuelos/docs/MODELO-DE-DATOS.md` (generado con `npm run docs:modelo`).
- Base de producción: Aiven. Local: Postgres de `docker-compose.yml`.

## Más a fondo

- [Modelo de datos](../src/modules/vuelos/docs/MODELO-DE-DATOS.md) · [Entidades](../src/modules/vuelos/entities/README.md) · [Migraciones](../src/modules/vuelos/migrations/README.md)

← Volver a [README principal](../README.md)
