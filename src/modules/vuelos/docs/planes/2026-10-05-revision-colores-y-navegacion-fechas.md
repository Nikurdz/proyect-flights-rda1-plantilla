# Plan: Corrección de Colores Star Alliance y Navegación Dinámica de Fechas

## Contexto y Diagnóstico
1. **Contraste de Colores:** En la captura compartida por el usuario, el Header y el Hero se aprecian en fondo blanco con texto blanco. El servidor de desarrollo Vite retenía en caché en memoria una compilación anterior donde los nombres de clase extendidos `star-*` no se resolvían.
2. **Restricción de Fechas del Backend:** El backend valida las fechas usando `todayUtc()`. En horarios vespertinos/nocturnos de América del Sur (UTC-5), el día de hoy local ya es "ayer" en UTC para Render, provocando el error `Departure date in the past`. Además, en la pantalla de resultados no existía una forma ágil de cambiar de fecha para consultar otros días contiguos.

## Solución Planificada
- **Protección de Estilos:** Incorporar utilitarios CSS específicos (`star-header-bg`, `star-hero-bg`, `star-tab-active`, etc.) y valores hexadecimales explícitos para que el Header y Hero tengan garantizado su fondo oscuro (`#0B0E14`) y tipografía blanca y dorada de alto contraste sin depender del caché de Tailwind.
- **Navegación Dinámica de Fechas:** Añadir el componente interactivo `DateNavigator` en la pantalla de resultados (`ResultsPage`) con tira de 7 días (+/- 3 días), navegación por botones de día anterior/siguiente y selector directo de fecha en calendario, además de sugerir por defecto fechas futuras válidas según UTC.
