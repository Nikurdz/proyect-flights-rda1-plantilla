# src/common — ayudantes genéricos compartidos

Solo cosas que no son del dominio de vuelos. Lo propio del dominio está en `modules/vuelos/common/`.

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `typeorm-config.ts` | `typeOrmConfig(config, opciones)`: conexión Postgres desde `DATABASE_URL`; `synchronize` solo fuera de producción; lo usan `app.module.ts` y los satélites |
| `guards/idempotency-key.guard.ts` | `IdempotencyKeyGuard`: exige que la cabecera `Idempotency-Key` sea un UUID |
| `transformers/column-numeric.transformer.ts` | `ColumnNumericTransformer`: columnas `numeric` ↔ `number` |
| `dto/base-response.dto.ts` | `BaseResponseDto`: forma común de respuesta |

## Cómo se conecta

- Lo importan las entidades y controladores de `../modules/vuelos/` (por ejemplo, los endpoints de escritura usan el guard).
- El SSL de la base vive en `../modules/vuelos/common/db-ssl.ts`.

## Más a fondo

- [Ayudantes del dominio](../modules/vuelos/common/README.md)
- [Idempotencia en servicios](../modules/vuelos/services/README.md)

← Volver a [src/README.md](../README.md)
