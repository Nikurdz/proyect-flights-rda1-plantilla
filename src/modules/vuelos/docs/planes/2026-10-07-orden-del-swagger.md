# Plan de implementación: orden y claridad del Swagger de Vuelos

- **Fecha:** 2026-10-07
- **Agente:** Claude Code Desktop
- **Área:** backend (documentación de la API)
- **Rama:** `vuelos`

## Objetivo
Que el Swagger se lea como el recorrido de una compra (acceso → búsqueda → oferta → pago → viaje), con lo que no se usa claramente separado, para poder defender el e-commerce desde `/api/docs` sin perderse.

## Alcance
- Incluye: etiquetas numeradas y ordenadas con descripción, prefijo "Paso N" en el resumen de cada operación del recorrido, orden de las rutas dentro de cada etiqueta, texto de portada con el recorrido y los tokens de prueba, sección aparte para lo "No implementado" (501), Swagger UI con el token persistente y las etiquetas plegadas.
- No incluye: cambiar rutas, DTO ni comportamiento de la API; el contrato `vuelos-openapi.yaml`; otros dominios (Alojamientos, Autos y Atracciones no están montados, así que no aparecen: solo se aclara en la portada).

## Contexto y referencias
- Solo `VuelosModule` está montado en `app.module.ts`; los demás dominios no salen en Swagger.
- Hoy las etiquetas mezclan el e-commerce (`E-commerce · …`) con el núcleo GDS (`Búsqueda y Catálogo`, `Bloqueo de Cupos`, …) y los stubs 501 (`Postventa`, `Check-in`, `Webhooks`) sin un orden pensado; `main.ts` describe los cuatro dominios.

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `common/swagger-tags.ts` (nuevo) | Constantes de las etiquetas, en orden, con su descripción. |
| `swagger.ts` (nuevo) | Configuración del documento (título, portada con el recorrido), orden de rutas y opciones de Swagger UI. |
| `src/main.ts` | Usa `swagger.ts` en lugar de la configuración en línea (cambio mínimo en el archivo compartido). |
| Controladores de `ecommerce/*` y `vuelos.controller.ts` | Etiquetas por constante; resumen con "Paso N" en el recorrido; etiquetas "No implementado" para los 501. |

## Impacto en la API / contrato
Ninguno: solo metadatos de documentación (etiquetas, resúmenes y orden).

## Pasos
1. Constantes y configuración.
2. Etiquetas y resúmenes en los controladores.
3. Orden de rutas y opciones de Swagger UI en `main.ts`.
4. Comprobar el documento generado (orden, etiquetas) y la UI en el navegador; pruebas y build.

## Riesgos y decisiones abiertas
- Cambiar nombres de etiquetas rompe cualquier enlace profundo a `#/<etiqueta>` de Swagger UI (no hay ninguno en el repo).
- Los resúmenes con "Paso N" son texto: si se agrega un endpoint al recorrido hay que numerarlo a mano.

## Verificación
- `npm run build` y `npm test` (la documentación no debe cambiar ningún comportamiento).
- Comprobar en `/api/docs-json` que las etiquetas salen en el orden previsto y que ninguna ruta queda sin etiqueta; abrir `/api/docs` y revisar el orden y la portada.
