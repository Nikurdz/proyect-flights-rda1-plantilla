# Plan de implementación: Rebranding a Star Alliance y Alcance Global

- **Fecha:** 2026-10-05
- **Agente:** Antigravity (Senior UX/UI & Frontend Developer)
- **Área:** frontend
- **Rama:** `vuelos`

## Objetivo
Actualizar la identidad de marca de la plataforma frontend al nombre y logotipo oficial de **Star Alliance** ("The way the Earth connects"), generalizando el alcance de la interfaz para que sea una plataforma de vuelos global e internacional sin preferencia o sesgo exclusivo por ningún país.

## Alcance
- **Incluye:**
  - Creación del componente de logotipo vectorizado oficial de Star Alliance (`StarAllianceLogo.tsx`) con sus 5 estrellas emblemáticas y tipografía.
  - Actualización de tokens de diseño en `tailwind.config.js`: paleta elegante Star Alliance (negro profundo `#0B0E14`, dorado `#C5A880`, plata `#94A3B8`, blanco puro y azul aeroportuario).
  - Actualización de favicon y metadatos en `index.html`.
  - Rebranding completo de Header, Footer, Hero y Home: lema *"The way the Earth connects"*, beneficios de alianza global y eliminación de referencias exclusivas a Ecuador o Colombia.
  - Generalización del selector de mercado en el Header para presentarlo como selector de moneda/región internacional: `USD ($) · Global (Star Alliance)` y `COP ($) · Colombia`.
  - Búsqueda abierta a toda la red de destinos del catálogo del backend (Miami, Madrid, Bogotá, Santiago, Buenos Aires, Ciudad de México, Lima, Cancún, etc.) sin favorecer ningún país.
  - Verificación de compilación limpia y pruebas unitarias al 100%.
- **No incluye:**
  - Modificaciones al backend de NestJS (los endpoints y contratos permanecen inalterados).
  - Inclusión de verticales ajenas a vuelos (alcance exclusivo: Vuelos).

## Contexto y referencias
- Solicitud del usuario: *"quiero que el nombre del sistema sea 'star alliance', igual que el grupo (incluso usando su logotipo)... no solo vamos a realizar vuelos de ecuador o colombia, va a ser algo en general, sin preferencia"*.
- Contrato backend: La API maneja los mercados `ec` (cotización en USD) y `co` (cotización en COP) y catálogo de localidades internacionales.

## Cambios previstos

| Archivo / módulo | Cambio |
|---|---|
| `frontend/src/components/ui/StarAllianceLogo.tsx` | Componente SVG con el isotipo de 5 estrellas de Star Alliance y su tipografía oficial. |
| `frontend/tailwind.config.js` | Tokens de color Star Alliance (`star-black`, `star-gold`, `star-silver`, `star-navy`). |
| `frontend/index.html` | Título y favicon de Star Alliance. |
| `frontend/src/components/layout/Header.tsx` | Logotipo oficial de Star Alliance y selector de divisa global (USD / COP). |
| `frontend/src/components/layout/Footer.tsx` | Información institucional de la red global de Star Alliance. |
| `frontend/src/features/search/HomePage.tsx` | Hero y tarjetas de propuesta de valor de alianza global. |
| `frontend/src/features/search/SearchBar.tsx` | Placeholders y textos de búsqueda internacional sin sesgo local. |
| `frontend/src/features/results/FlightCard.tsx` | Identificación de vuelos y aerolíneas miembro de la alianza. |
| `frontend/src/features/results/ResultsPage.tsx` | Etiquetas de moneda neutrales en lugar de país. |

## Impacto en la API / contrato
**Ninguno**. Se mantiene el consumo transparente de la API desplegada en Render.

## Pasos
1. Crear el componente vectorizado `StarAllianceLogo.tsx`.
2. Actualizar `tailwind.config.js` con la paleta de Star Alliance.
3. Actualizar `index.html` (favicon, título y metadatos).
4. Actualizar `Header.tsx` y `Footer.tsx` con el nuevo branding y selector de divisa global.
5. Actualizar `HomePage.tsx` y `SearchBar.tsx` con la narrativa y experiencia global.
6. Ajustar `FlightCard.tsx` y `ResultsPage.tsx` para reflejar la red de Star Alliance.
7. Ejecutar `npm test` y `npm run build` para certificar cero regresiones.

## Riesgos y decisiones abiertas
- **Compatibilidad con códigos del backend:** El backend usa `ec` para USD y `co` para COP. Al mapearlo en la UI como `USD ($) Global` y `COP ($) Colombia`, se preserva al 100% el contrato de la API sin alterar la base de datos ni los endpoints.

## Verificación
- Pruebas unitarias: `npm test` en `frontend/` (100% de tests aprobados).
- Compilación de producción: `npm run build` en `frontend/` (cero errores de TypeScript/Vite).
- Validación visual de la identidad Star Alliance, logotipo y buscador internacional.
