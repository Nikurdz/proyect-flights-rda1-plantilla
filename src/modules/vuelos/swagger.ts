import { DocumentBuilder, OpenAPIObject, SwaggerCustomOptions } from '@nestjs/swagger';
import { SWAGGER_TAG_LIST } from './common/swagger-tags';

const DESCRIPTION = `
## Recorrido de una compra (en este orden)

| # | Sección | Qué haces |
|---|---------|-----------|
| 1 | **Acceso** | \`POST /auth/invitado\` (o registra una cuenta y entra con \`/auth/login\`). Copia el \`accessToken\` y pulsa **Authorize**. |
| 2 | **Buscar vuelos** | \`GET /disponibilidad\` (origen, destino, fecha) y, con el \`itinerarioId\` elegido, \`GET /itinerarios/{id}/tarifas\`. |
| 3 | **Oferta y checkout** | \`POST /ofertas\` → \`PUT /ofertas/{id}/pasajeros\` (asiento opcional) → \`PUT …/facturacion\` → \`POST …/condiciones\`. |
| 4 | **Pagar y emitir** | \`POST /ofertas/{id}/compra\` con un token de tarjeta de prueba. |
| 5 | **Mis viajes y billetes** | \`GET /ordenes/{numero}\` o recuperar con PNR y apellido; \`GET /tickets/verificar\` con el código del QR. |
| 6 | **Administración** | Solo con el token del ADMIN. |

Las operaciones de los pasos 1 a 5 llevan "Paso N" en el título. **Pasos que piden \`Idempotency-Key\`**: crear la oferta y pagar; usa un UUID nuevo y repítelo para comprobar que no cobra dos veces.

## Tarjetas de prueba (pasarela simulada, nunca se envía un número real)
\`tok_visa_ok\` · \`tok_mastercard_ok\` · \`tok_amex_ok\` · \`tok_diners_ok\` aprueban. \`tok_declined\`, \`tok_insufficient\`, \`tok_expired\` y \`tok_fraud\` fuerzan un rechazo; \`tok_3ds\` y \`tok_review\` piden verificación; \`tok_<marca>_capture_fail\` falla el cobro tras emitir (queda para la reconciliación). Un monto mayor a 5,000 USD pasa a revisión.

## Qué no se usa
- **Alojamientos, Autos y Atracciones** son de otros equipos y no están montados: no aparecen aquí.
- Sección **7 · Núcleo GDS**: es el contrato de vuelos que el e-commerce usa por dentro; no hace falta para comprar.
- Las secciones **⛔ No implementado** (postventa, check-in y webhooks) están en el contrato pero responden \`501\` en esta fase.
`.trim();

export function buildVuelosSwaggerConfig(): Omit<OpenAPIObject, 'paths'> {
  const builder = new DocumentBuilder()
    .setTitle('RAM Alliance · API de Vuelos')
    .setDescription(DESCRIPTION)
    .setVersion('1.0')
    .addBearerAuth();
  // Declared in order: Swagger UI shows the sections in this same order.
  for (const tag of SWAGGER_TAG_LIST) builder.addTag(tag.name, tag.description);
  return builder.build();
}

type Operation = { summary?: string; tags?: string[] };
const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/**
 * Sort key of a path: its first "Paso N" operation, so each section reads in the order of the walkthrough.
 * Everything without a step goes after the numbered ones, by path (so the admin routes group by resource).
 */
function stepKey(path: string, item: Record<string, unknown>): string {
  const step = METHODS.map((m) => (item[m] as Operation | undefined)?.summary).find((s): s is string => Boolean(s) && /^Paso /.test(s as string));
  return step ?? `~${path}`;
}

/**
 * Reorders the routes so that, inside a section, the "Paso 3A / 3B / …" operations come in order and the
 * rest follow. Swagger UI keeps the order the document has, so this is all it takes.
 */
export function orderVuelosPaths(document: OpenAPIObject): void {
  const entries = Object.entries(document.paths).map(([path, item]) => ({ path, item, key: stepKey(path, item as Record<string, unknown>) }));
  // Plain code-unit comparison on purpose: '~' sorts after every letter, which a locale-aware compare would not do.
  entries.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  document.paths = Object.fromEntries(entries.map((e) => [e.path, e.item]));
}

/** Swagger UI: keep the token between reloads, show timings, and start with the sections collapsed so the order is visible at a glance. */
export const vuelosSwaggerUiOptions: SwaggerCustomOptions = {
  customSiteTitle: 'RAM Alliance · API de Vuelos',
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: 'none',
    displayRequestDuration: true,
    defaultModelsExpandDepth: -1,
  },
};
