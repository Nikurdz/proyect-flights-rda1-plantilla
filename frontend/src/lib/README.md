# frontend/src/lib — utilidades puras, sesión, tema y reglas de presentación

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `dates.ts`, `labels.ts` | Fechas/horas en hora de Ecuador (UTC-5) y etiquetas en español de los códigos de la API |
| `money.ts`, `market.ts` | Formato USD y constante de mercado enviada a la API |
| `airports.ts`, `flight-estimates.ts` | Zonas horarias/aeropuertos y estimaciones al crear vuelos |
| `passenger-rules.ts` | Reglas de edad INFANT/CHILD/YOUTH/ADULT (espejo del backend) |
| `checkout.ts`, `seats.ts`, `cards.ts` | Pasos de compra, asientos elegidos, validación de tarjeta simulada |
| `search.ts`, `best-value.ts`, `suggestions.ts` | Validez de la ida elegida, opción más barata, sugerencias en vivo |
| `order-status.ts`, `tickets.ts` | Estado de orden y enlace/estado del QR |
| `session.ts`, `storage.ts`, `auth-actions.ts` | Lee el JWT (solo para mostrar), guarda token/última orden, cierra sesión y vacía caché |
| `theme.ts`, `toast.ts` | Tema claro/oscuro/sistema (`ram-theme`) y avisos |
| `queryClient.ts`, `network-error.ts`, `uuid.ts`, `field-a11y.ts` | Cliente de consultas, error de red, UUID v4, atributos ARIA |
| `dashboard.ts`, `observability.ts`, `auditoria.ts`, `trazabilidad.ts`, `trace-layout.ts`, `proveedores.ts`, `experiencias.ts` | Reglas de presentación del admin y experiencias |

## Cómo se conecta

Sin llamadas HTTP (salvo `auth-actions` que limpia caché). Las usan `features/` y `components/`; `lib/` no importa de `features/`.

## Más a fondo

Cubiertas en [tests/README.md](../../tests/README.md) · Reglas de edad: [módulo Vuelos](../../../src/modules/vuelos/README.md)

← Volver a [frontend/src/README.md](../README.md)
