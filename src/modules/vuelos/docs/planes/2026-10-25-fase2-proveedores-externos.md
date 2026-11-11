# Plan de implementación: Gestión de Proveedores y reservas de productos externos

- **Fecha:** 2026-10-25
- **Agente:** Claude Code Desktop
- **Área:** backend/BD
- **Rama:** `vuelos`

## Objetivo
Que el administrador registre servicios de otros equipos (proveedores), vea su estado en vivo, importe su catálogo y que los clientes puedan ver y reservar esos productos pasando por el pago, la factura y la compensación de la plataforma.

## Alcance
- Incluye: registro, edición, kill-switch y borrado de proveedores; ping con latencia y trabajo de salud cada 60 s; sincronización del catálogo; catálogo público `/experiencias`; saga de reserva y cancelación; circuit breaker; capa anticorrupción de **Atracciones** completa.
- No incluye: importar catálogo o reservar con proveedores de **Autos** y **Alojamientos** (sus contratos son de búsqueda y reserva, no de catálogo: solo se vigila su salud y el resto responde 422 `PROVIDER_ACTION_NOT_SUPPORTED`); autenticación OAuth hacia el socio; pantallas (Fase 4).

## Contexto y referencias
Flujo pedido: «Microservicios & Integración → Gestión de Proveedores» (nombre, equipo, URL base con o sin `/api/v2`, tipo de servicio; semáforo con latencia; 🔄 y 📥). Contrato del socio: `contracts/socios/atracciones-openapi.yaml`. Decisión del usuario: catálogo visible **y** reserva por la API del socio.

## Cambios previstos y realizados
| Archivo / módulo | Cambio |
|---|---|
| `ecommerce/integracion/entities` | `proveedores`, `proveedor_salud`, `catalogo_externo` (+categorías), `reservas_externas` |
| `ecom_pagos`, `ecom_facturas` | pertenecen a una oferta/orden **o** a una reserva externa (CHECK); factura de una línea con IVA incluido en el precio del socio |
| `common/safe-http.ts` | `requestJson` (GET/POST con cuerpo acotado) con la misma defensa SSRF de los webhooks |
| `integracion/acl` | `ClienteProveedor`, `AdaptadorProveedor`, adaptador de Atracciones, sonda para Autos/Alojamientos, `CircuitBreakers` (opossum) |
| `proveedores.service.ts` | alta/edición/borrado, ping, sincronización, auditoría administrativa, eventos `proveedor.*` |
| `reservas-externas.service.ts` | saga: autorizar → reservar en el socio → confirmar + facturar → capturar; compensa en cada fallo |
| `salud-proveedores.service.ts` | trabajo de salud cada 60 s |
| Migración `AddProveedores` | solo aditiva |

## Impacto en la API / contrato
Nuevas rutas: `GET/POST /admin/proveedores`, `GET/PATCH/DELETE /admin/proveedores/{id}`, `POST …/ping`, `POST …/sincronizar`, `GET …/salud`, `GET /admin/proveedores/reservas/todas`, `GET /experiencias`, `GET /experiencias/{id}`, `POST /experiencias/{id}/reservas`, `GET /reservas-externas`, `GET /reservas-externas/{id}`, `POST /reservas-externas/{id}/cancelar`. `contracts/vuelos-ecommerce-openapi.yaml` regenerado (72 paths, 83 operaciones).

## Riesgos y decisiones
- **SSRF**: la URL la elige un administrador; se valida al registrar y en cada llamada (https público). `PROVEEDORES_ALLOW_PRIVATE_HOSTS` solo para la red del curso y pruebas; la configuración lo rechaza en producción.
- **Precio**: el precio del socio es final; el IVA de la plataforma se extrae de él. Si el socio confirma otro total, se cancela su reserva y se anula el pago (`PRICE_CHANGED`).
- Un 4xx del socio no abre el circuito (es una respuesta de negocio); 5xx, red y timeouts sí (≥50 % de fallos con al menos 3 llamadas en 60 s; reintento tras `PROVEEDORES_BREAKER_RESET_MS`).
- Si hasta cancelar en el socio falla durante una compensación, queda registrado en el log para resolverlo a mano.
- El reconciliador no captura pagos de reservas externas autorizados y no capturados (la saga captura al terminar); es una mejora posible.

## Verificación
12 pruebas de integración con un socio simulado local (registro, ping verde/rojo, salud, sincronización, catálogo público y kill-switch, reserva completa con factura y saga, idempotencia, rechazos previos, compensación por rechazo del socio, circuito abierto y cierre, cancelación y no reembolsable, borrado). Suite completa 268 pruebas, `lint`, `build`, `migration:check` en 0.
