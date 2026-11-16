# Auditoría — <tema> — AAAA-MM-DD

<!-- Plantilla oficial de auditorías. Copiar a AUDITORIA-AAAA-MM-DD-<tema>.md y rellenar.
Sigue EXACTAMENTE las 5 secciones oficiales:
1. Resumen ejecutivo.
2. Hallazgos críticos, altos, medios y bajos.
3. Evidencia concreta indicando archivo y elemento afectado.
4. Recomendación de corrección para cada hallazgo.
5. Pruebas que deberían repetirse después de corregir.
Estilo de las auditorías antiguas: ver ../../RDA1-docs/AUDITORIA-10-6-2026-Backend.md -->

- **Plan:** <enlace relativo al plan, p. ej. [`AAAA-MM-DD-tema.md`](../../planes/AAAA-MM-DD-tema.md)>
- **Fecha del plan:** AAAA-MM-DD
- **Commits auditados:** <hash corto, fecha, asunto, archivos/inserciones/borrados (de `git show --shortstat`)>
- **Alcance:** <qué se revisa (backend `src/`, frontend `frontend/`, contratos, CI y despliegue) y qué no>
- **Método:** <cómo se revisó: lecturas de código, exploraciones, pruebas ejecutadas>. Marcas en cada hallazgo:
  - **[V]** releído en el código por quien audita.
  - **[E]** procede de una exploración y no se releyó.
  - **[observado]** visto al ejecutar o usar el sistema.
  - **[confirmado en producción]** comprobado contra el despliegue real.
- **No cubierto:** <lo que queda fuera: pruebas de penetración, carga, accesibilidad, configuración real de servicios, `.env`…>

## 1. Resumen ejecutivo

<!-- Cómo rellenar: valoración en 3 líneas: 1) lo bien construido; 2) el hallazgo principal (y si está confirmado en producción); 3) los temas que agrupan el resto. Después, contar los hallazgos de la sección 2 por severidad. -->

| Severidad | Cantidad |
|---|---|
| Crítica | 0 |
| Alta | 0 |
| Media | 0 |
| Baja | 0 |

## 2. Hallazgos críticos, altos, medios y bajos

<!-- Cómo rellenar: una fila por hallazgo en la tabla de su severidad, con ID (C-n, A-n, M-n, B-n), título breve con su marca [V]/[E]/[observado]/[confirmado en producción] y estado (abierto, corregido, aceptado). Se puede añadir una columna opcional «Impacto» (qué pasa y a quién afecta). Dejar la sub-lista «Qué revisar» solo si se prepara la auditoría antes de transcribirla.
Criterios de severidad:
- Crítico: pérdida o exposición de datos, dinero o caída de producción.
- Alto: fallo funcional grave, o riesgo de seguridad explotable con condiciones.
- Medio: defecto con solución alternativa, o deuda con impacto.
- Bajo: mejora, estilo o documentación. -->

### 2.1 Críticos

| ID | Hallazgo | Estado |
|---|---|---|
| C-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | abierto |

### 2.2 Altos

| ID | Hallazgo | Estado |
|---|---|---|
| A-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | abierto |

### 2.3 Medios

| ID | Hallazgo | Estado |
|---|---|---|
| M-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | abierto |

### 2.4 Bajos

| ID | Hallazgo | Estado |
|---|---|---|
| B-1 | <título del hallazgo> **[V / E / observado / confirmado en producción]** | abierto |

### 2.5 Revisado y sin hallazgo

<!-- Lo comprobado que está bien, con la marca de cómo se comprobó. -->

## 3. Evidencia concreta (archivo y elemento afectado)

<!-- Cómo rellenar: una fila por hallazgo, con el mismo ID de la sección 2. -->

_Por cada hallazgo indicar ruta del archivo y el elemento (función, endpoint, columna, variable, línea)._

| ID | Archivo | Elemento afectado | Evidencia |
|---|---|---|---|
| C-1 | <ruta/del/archivo.ts> | <función, endpoint, columna, variable o línea> | <ruta:línea y qué se observa> |
| A-1 | <ruta/del/archivo.ts> | <función, endpoint, columna, variable o línea> | <ruta:línea y qué se observa> |
| M-1 | <ruta/del/archivo.ts> | <función, endpoint, columna, variable o línea> | <ruta:línea y qué se observa> |
| B-1 | <ruta/del/archivo.ts> | <función, endpoint, columna, variable o línea> | <ruta:línea y qué se observa> |

## 4. Recomendación de corrección

<!-- Cómo rellenar: una recomendación concreta por cada hallazgo y quién la aplica. -->

| ID | Recomendación | Responsable (backend/BD, frontend, infra) |
|---|---|---|
| C-1 | <cambio propuesto> | <backend/BD, frontend o infra> |
| A-1 | <cambio propuesto> | <backend/BD, frontend o infra> |
| M-1 | <cambio propuesto> | <backend/BD, frontend o infra> |
| B-1 | <cambio propuesto> | <backend/BD, frontend o infra> |

## 5. Pruebas que deberían repetirse después de corregir

<!-- Cómo rellenar: 5.1 lista las pruebas existentes que cubren el plan; 5.2 las que hay que repetir, agrupadas (Seguridad, Fechas, Backend, Frontend…), una por hallazgo corregido, con el comando y el resultado esperado. -->

### 5.1 Pruebas existentes que cubren el plan

- <ruta de la prueba> (unitaria / integración: requiere `TEST_DATABASE_URL`)

### 5.2 Pruebas a repetir (sugeridas)

1. <ID del hallazgo>: <prueba y resultado esperado>
2. Regresión general: `npm run lint`, `npm run build`, `npm test`; en `frontend/`: `npm run lint`, `npm run build`, `npm test`.
