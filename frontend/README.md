# RAM Alliance · Frontend de venta de vuelos

Aplicación web (SPA) de la plataforma de venta de vuelos directos **RAM Alliance**: React 18, Vite 6, TypeScript, Tailwind CSS, TanStack Query, React Hook Form + Zod. Consume la API NestJS del repositorio (`/api/v1`) y no guarda secretos en el cliente.

> Proyecto académico: los pagos son **simulados**, los correos son simulados y no se emiten boletos reales.

## Marca y estilo

- Marca propia **RAM Alliance** (formal, sin beneficios ni millas). Emblema original (`src/components/ui/Logo.tsx`, `public/favicon.svg`).
- Estilo inspirado en sitios de alianzas aéreas: cabecera negra, acento dorado (`brand-gold` `#AB9159`), superficies claras, tipografía Inter, footer en columnas. Tokens en `tailwind.config.js` (`brand-*`, `airline-*`).
- Solo **USD**: no hay selector de mercado; la constante `MERCADO` (`src/lib/market.ts`) se envía a la API.

## Pantallas

| Ruta | Descripción |
|---|---|
| `/` | Buscador (ida/vuelta, aeropuertos con autocompletado, fechas, pasajeros) y rutas populares |
| `/resultados` | Vuelos por tramo, orden, navegación de fechas; estado «no hay vuelos» amable con días cercanos |
| `/checkout/:offerId` | Pasajeros → facturación → condiciones → pago, con cuenta regresiva de la reserva |
| `/confirmacion/:orderNumber` | Código de reserva, billetes, itinerario en hora local, imprimir |
| `/recuperar-orden` | Recuperar un viaje sin cuenta (código u orden + apellido) |
| `/registro`, `/login`, `/verificar-correo` | Crear cuenta, iniciar sesión, confirmar el correo |
| `/mis-ordenes`, `/mi-cuenta` | Solo clientes: sus viajes (paginados) y sus preferencias |
| `/admin/ordenes`, `/admin/vuelos` | Solo rol ADMIN: órdenes de todos los clientes y vuelos con su inventario |
| `/admin/proveedores` | Solo ADMIN: registrar proveedores socios, semáforo (texto + color), latencia, circuito, comprobar, sincronizar catálogo, kill-switch, eliminar e historial de salud (se refresca cada 30 s) |
| `/admin/facturacion` | Solo ADMIN: facturas de vuelos y experiencias con filtros, total emitido y detalle con líneas e IVA |
| `/admin/auditoria` | Solo ADMIN: transacciones y sagas (GraphQL `/graphql`), filtro por correlation id (`?correlationId=`) y pasos de cada saga |
| `/admin/salud` | Solo ADMIN: estado de todos los nodos y gráfico SVG del histórico de latencia del nodo elegido |
| `/experiencias`, `/experiencias/:id` | Catálogo público de experiencias de los socios y reserva pagada con token de la pasarela simulada (resultado con factura) |
| `/mis-experiencias` | Reservas de experiencias de la sesión (cliente o invitado) con cancelación |
| `/transparencia`, `/condiciones-transporte`, `/terminos`, `/privacidad`, `/ayuda` | Páginas legales y de ayuda |

## Sesión y acceso

- `src/lib/session.ts` lee el JWT (solo para decidir qué mostrar): invitado, cliente o admin. **La API es la que autoriza**; las guardas de ruta (`src/routes/guards.tsx`) solo evitan llegar a pantallas que responderían 401/403.
- Un invitado compra pero no ve «Mis viajes»; un cliente solo ve sus órdenes; solo un admin entra a `/admin`.
- Al iniciar o cerrar sesión (y ante un 401) se borra la caché de consultas: nadie hereda datos de otra persona en el mismo navegador.
- Una orden vista o recuperada se guarda en `sessionStorage` de la pestaña, para que refrescar o imprimir siga funcionando.

## GraphQL

`/graphql` queda fuera del prefijo `api/v1`. `src/api/graphql.ts` es un cliente mínimo con `fetch` que reutiliza el token y convierte `errors[0].extensions.code` en el mismo `ProblemDetailsError` del cliente REST (un `UNAUTHORIZED` cierra la sesión igual que un 401). Solo lo usa la consola de Auditoría.

## Errores

`src/api/problem-details.ts` traduce cada `code` de la API a un mensaje en español y nunca muestra el `detail` (en inglés, para desarrolladores) ni cuerpos HTML. Los problemas por campo se muestran con etiquetas en español. Si hay `X-Correlation-Id`, el usuario puede copiar un código para soporte.

## Pago simulado

El formulario no pide número de tarjeta: se elige cómo debe responder el pago de prueba (`tok_*` en el API). Con `VITE_SHOW_TEST_CARDS=true` aparecen además todos los escenarios (Amex, Diners, fondos insuficientes, vencida, antifraude, fallo de captura) y el token. Cada intento de pago usa su propia `Idempotency-Key`; solo un reintento idéntico la reutiliza.

## Variables de entorno

| Variable | Uso |
|---|---|
| `VITE_API_URL` | Base de la API. En desarrollo `/api/v1` (pasa por el proxy de Vite) |
| `VITE_BACKEND_TARGET` | Destino del proxy de Vite en desarrollo (`http://localhost:3000` o la URL de Render) |
| `VITE_SHOW_TEST_CARDS` | `true` muestra todos los escenarios de pago de prueba |
| `VITE_GRAPHQL_URL` | Opcional: URL del gateway GraphQL. Si falta, se deriva de `VITE_API_URL` (`https://host/api/v1` -> `https://host/graphql`); en desarrollo el proxy de Vite reenvía `/graphql` |

En producción, `VITE_API_URL` debe ser la URL completa de la API (p. ej. `https://<app>.onrender.com/api/v1`) y el origen del front debe estar en `CORS_ORIGINS` del backend.

## Comandos

```bash
npm install
npm run dev          # http://localhost:5173 (o el siguiente puerto libre)
npm run build        # tsc + vite build
npm test             # Vitest: dinero, errores, sesión, registro, etiquetas, fechas
npm run lint         # ESLint 9 (typescript-eslint, react-hooks, jsx-a11y strict); `npm run lint:fix` corrige lo automático
npm run generate-api # regenera src/api/schema.d.ts desde el OpenAPI (ajusta la URL del script si usas el backend local)
```

## Despliegue gratuito (Vercel, Netlify o Cloudflare Pages)

1. Importa el repositorio y usa `frontend` como directorio raíz.
2. Build: `npm run build`; salida: `dist`.
3. Variable `VITE_API_URL` con la URL de la API.
4. `public/_redirects` ya reescribe las rutas a `index.html` (SPA). En Vercel añade una regla de rewrite equivalente.
5. Pon la URL resultante en `CORS_ORIGINS` del backend.
