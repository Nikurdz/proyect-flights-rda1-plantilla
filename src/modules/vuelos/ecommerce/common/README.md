# ecommerce/common/ — Utilidades compartidas por los submódulos e-commerce

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `global-rate-limit.middleware.ts` | Límite global por IP (`GLOBAL_RATE_LIMIT_MAX`) |
| `rate-limiter.ts` | Limitador de ventana reutilizable |
| `moneda.util.ts` | Dinero en unidades menores enteras; monedas sin decimales |
| `enmascarar.ts` | Enmascara datos personales en respuestas |
| `texto.util.ts` | Normalización de texto |

## Cómo se conecta
Los usan casi todos los submódulos de [../README.md](../README.md) (p. ej. [pagos](../pagos/README.md), [ordenes](../ordenes/README.md), [admin](../admin/README.md)). Utilidades genéricas del módulo: [../../common/](../../common/README.md). Detrás de un proxy hace falta `TRUST_PROXY`, si no el límite ve la IP del proxy.

## Más a fondo
[ecommerce](../README.md) · [módulo vuelos](../../README.md)

← Volver a [../README.md](../README.md)
