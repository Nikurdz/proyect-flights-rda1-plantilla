# contracts/socios/ — especificaciones de los equipos socios

Son los contratos contra los que se integra nuestra capa anticorrupción. **No es código a construir aquí.**

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `atracciones-openapi.yaml` | API REST de Atracciones. Implementada en el adaptador (catálogo y reservas) |
| `atracciones.proto` | Versión gRPC de Atracciones |
| `autos-openapi.yaml` | API de Autos. Solo se usa el chequeo de salud |
| `alojamientos-openapi.yaml` | API de Alojamientos. Solo se usa el chequeo de salud |

## Cómo se conecta

- Código que los consume: `src/modules/vuelos/ecommerce/integracion/` (`ClienteProveedor`, adaptadores en `acl/`, circuit breaker).
- Autos y Alojamientos: cualquier otra acción responde 422 `PROVIDER_ACTION_NOT_SUPPORTED`.
- El admin registra proveedores en `/admin/proveedores`.

## Más a fondo

- [ecommerce/integracion](../../src/modules/vuelos/ecommerce/integracion/README.md)

← Volver a [contracts/README](../README.md)
