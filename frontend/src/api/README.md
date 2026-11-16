# frontend/src/api — cliente HTTP, endpoints por dominio, errores y tipos

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| `client.ts` | `apiClient<T>` (JWT, `Idempotency-Key`, `X-Correlation-Id`, problem+json), `apiBlob`/`saveBlob` (CSV), aviso de servidor dormido (`onServerWakeUpChange`) |
| `problem-details.ts` | `ProblemDetailsError`; traduce cada `code` a un mensaje en español (nunca muestra el `detail` en inglés) |
| `graphql.ts` | Cliente mínimo de `/graphql` (fuera del prefijo `api/v1`); errores → `ProblemDetailsError` |
| `types.ts` | Tipos escritos a mano de las respuestas (mapa de asientos, verificación de ticket…) |
| `schema.d.ts` | Generado por `npm run generate-api`; no se edita |
| `endpoints/auth.ts` | Login, invitado, registro, verificación de correo |
| `endpoints/catalog.ts`, `markets.ts` | Disponibilidad/tarifas (`yth` incluido) y mercado |
| `endpoints/offers.ts` | Ofertas, pasajeros, mapa de asientos, checkout y pago |
| `endpoints/orders.ts` | Mis órdenes, recuperar, verificar QR, añadir viaje |
| `endpoints/experiencias.ts` | Catálogo de socios y reservas de experiencias |
| `endpoints/admin.ts` | Órdenes, reservas de mostrador, vuelos, aeropuertos, usuarios, observabilidad, webhooks |
| `endpoints/facturas.ts`, `facturacion-booking.ts` | Facturas y conciliación Booking |
| `endpoints/proveedores.ts` | Proveedores socios, salud, sincronizar |
| `endpoints/trazabilidad.ts` | Línea de tiempo, flujo y mapa (`/admin/trazabilidad*`) |

## Cómo se conecta

Base: `VITE_API_URL` (por defecto `/api/v1` con el proxy de Vite). Los hooks de `endpoints/*` envuelven `apiClient` con TanStack Query; las páginas de `features/` los consumen. Un 401 cierra la sesión y vacía la caché (`lib/auth-actions.ts`).

## Más a fondo

Contrato REST completo: [módulo Vuelos](../../../src/modules/vuelos/README.md) · Errores en pruebas: [tests/README.md](../../tests/README.md)

← Volver a [frontend/src/README.md](../README.md)
