# ecommerce/mercados/ — Mercado, configuración versionada y medios de pago

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `mercados.controller.ts` | Lectura pública y edición admin |
| `mercados.service.ts` | Config del mercado, publica nueva versión |
| `mercado-loader.ts` | Carga los hijos del mercado (medios de pago, reglas…) |
| `dto/mercado.dto.ts` | DTO |
| `entities/mercado.entity.ts`, `mercado-config.entity.ts` | `ecom_mercados` y tablas hijas `ecom_mercado_*` (3FN) |
| `entities/auditoria-cambio.entity.ts` | `auditoria_administrativa` |
| `mercados.module.ts` | Módulo Nest |

## Endpoints (`/api/v1`)
`GET mercados/:codigo` · `PUT admin/mercados/:codigo` · `GET admin/auditoria`.

## Eventos
Publica `ConfiguracionMercadoPublicada`.

## Cómo se conecta
Solo se vende en USD, mercado `ec`; el seed desactiva los demás ([../seed/](../seed/README.md)). Los hijos se leen con el loader. `AuditoriaCambioSubscriber` ([../observabilidad/](../observabilidad/README.md)) rellena correlación/IP.

## Más a fondo
[ecommerce](../README.md) · [módulo vuelos](../../README.md) · [Modelo de datos](../../docs/MODELO-DE-DATOS.md)

← Volver a [../README.md](../README.md)
