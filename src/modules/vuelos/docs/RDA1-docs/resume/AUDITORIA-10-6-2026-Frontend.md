# Auditoría 6-oct-2026 — Frontend (accesibilidad y móvil)

**Estado:** base sana (landmarks, un h1 por página, skip-link, foco visible, QR con etiqueta, ErrorBoundary). Fallan teclado y lector de pantalla.
**Hallazgos:** 4 críticos · 6 altos · 8 medios · 6 bajos.

## Críticos
- C1 `AirportPicker` no se usa con teclado (opciones sin foco, sin flechas ni Escape)
- C2 `Dialog` sin trampa de foco ni retorno; `FareComparisonModal` sin Escape
- C3 Formularios de pasajero y facturación: `label` sin `htmlFor`, errores sin `role="alert"`
- C4 Al cambiar de página o error, el foco no se mueve

## Altos
- A1 Botones de estado sin `aria-pressed` / `aria-current`
- A2 `Select` sin `aria-describedby`; `label` opcional
- A3 Contraste menor a 4.5:1 (botón y badge secundarios, footer, "copiar código", placeholder)
- A4 Objetivos táctiles menores de 44 px
- A5 Tablas de admin con scroll no enfocable; tablas legales desbordan a 320 px
- A6 Íconos sin `aria-hidden`; flechas de fecha sin `aria-label`

## Medios
- M1 Contador anuncia MM:SS cada segundo
- M2 Sin avisos en conteos de resultados y pasajeros
- M3 Mapa de asientos solo con Tab, sin flechas; tabs sin `tabpanel`
- M4 `PriceChangedModal` en 2 columnas fijas; Escape inerte sin avisar
- M5 Píldoras legales sin `aria-current`; marcas y nav admin sin `wrap`
- M6 `Button` sin `type` por defecto
- M7 `ProblemAlert` con `h4`; leyenda del QR en 10 px
- M8 `main` sin `tabindex=-1`; `Dialog` sin altura máxima

## Bajos
- B1 `Dialog` con `describedby` opcional sin contenido
- B2 `Skeleton` sin anuncio en el contenedor
- B3 Barra de `WakeUpBanner` sin `progressbar` (documentar)
- B4 Logo y título apretados a 320 px
- B5 `Card` sin `min-w-0`
- B6 Título de página genérico en todas las rutas

## Qué cumple
Estructura semántica · un h1 por página · `PaymentForm` bien asociado · imágenes solo SVG y QR con alternativa · sin errores JS ni PII en consola.

## Qué hacer
* Combobox accesible o `select` nativo ·
* foco en `Dialog` y rutas ·
* copiar el patrón de `PaymentForm` ·
* subir contraste y tamaño táctil ·
* envolver tablas con `role="region"`.

## Pruebas
- Búsqueda y compra completas solo con teclado
- Modales: foco dentro, Tab circular, Escape y retorno
- Lector (NVDA): anuncios de errores y estados
- axe sin violaciones críticas
- 320 / 390 / 768 px sin desbordar la página

**Cierre:** axe y teclado en cada PR; matriz de viewports antes de RDA2.
