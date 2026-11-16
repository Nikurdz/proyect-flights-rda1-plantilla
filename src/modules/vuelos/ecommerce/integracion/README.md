# ecommerce/integracion/ — Proveedores socios, experiencias y reservas externas

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `integracion.controller.ts` | Admin de proveedores, catálogo `experiencias`, `reservas-externas` |
| `proveedores.service.ts` | Alta, activar/apagar (kill-switch), ping, sincronizar |
| `salud-proveedores.service.ts` | Salud UP/DEGRADADO/DOWN (job de 60 s) |
| `experiencias.service.ts` | Catálogo externo que ve el cliente |
| `reservas-externas.service.ts` | Saga: autorizar pago → reservar en socio → confirmar + factura → capturar (compensa en cada fallo) |
| `acl/cliente-proveedor.ts` | Llamadas HTTP (guarda SSRF, tiempo/tamaño acotados) |
| `acl/adaptador-proveedor.ts`, `atracciones.adapter.ts`, `sonda.adapter.ts` | Capa anticorrupción (Atracciones completo; Autos/Alojamientos solo salud) |
| `acl/circuit-breakers.service.ts` | Circuit breaker opossum por proveedor |
| `entities/` | `proveedores`, `proveedor_salud`, `catalogo_externo`, `reservas_externas` |
| `dto/integracion.dto.ts` | DTO |

## Endpoints (`/api/v1`)
`admin/proveedores` (GET/POST), `…/:id` (GET/PATCH/DELETE), `…/:id/ping|salud|sincronizar`, `…/reservas/todas` · `experiencias` (GET, `:id`, `POST :id/reservas`) · `reservas-externas` (GET, `:id`, `POST :id/cancelar`).

## Eventos
`proveedor.registrado|apagado|activado|salud|sincronizado`, `ReservaExternaConfirmada|Fallida|Cancelada`. La actividad de proveedores y su salud **no forman parte de la trazabilidad** (`esRuidoDeProveedor`). Con reservas, un proveedor no se borra: `409 PROVIDER_IN_USE`.

## Cómo se conecta
Reusa [../pagos/](../pagos/README.md) y [../facturacion/](../facturacion/README.md); contratos de socios en `contracts/socios/`. Planes: `../../docs/planes/`.

## Más a fondo
[ecommerce](../README.md) · [módulo vuelos](../../README.md) · [Arquitectura por capas](../../docs/ARQUITECTURA-CAPAS.md) · [esb](../../esb/README.md)

← Volver a [../README.md](../README.md)
