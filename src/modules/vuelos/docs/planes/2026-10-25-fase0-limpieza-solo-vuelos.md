# Plan de implementación: Fase 0 — dejar el repositorio solo con Vuelos

- **Fecha:** 2026-10-25
- **Agente:** Claude Code Desktop
- **Área:** backend y documentación
- **Rama:** `vuelos`
- **Plan general:** `C:\Users\david\.claude\plans\` (arquitectura por capas, proveedores y BD normalizada); este documento cubre solo la Fase 0.

## Objetivo
Que el repositorio contenga únicamente el sistema de Vuelos: sin los módulos de otros equipos, sin las instrucciones de la plantilla del curso y sin referencias a los demás dominios.

## Alcance
- Incluye: borrar `src/modules/alojamientos`, `autos`, `atracciones`; borrar `CommonModule` y los DTO de paginación (solo los usaba atracciones); limpiar `app.module.ts`; mover los contratos de los otros equipos a `contracts/socios/` (los consumirá nuestra capa anticorrupción en la Fase 2); reescribir README, `package.json`, Swagger de `main.ts`, `CLAUDE.md`; quitar `ALOJAMIENTOS/CARROS` de ejemplos y del seed de mercados.
- No incluye: desconectar el fork en GitHub (el repositorio es público y GitHub solo permite «Leave fork network» en forks privados; hay que pedirlo al soporte de GitHub o crear un repositorio nuevo, decisión del usuario), ni borrar ramas remotas.

## Cambios previstos
| Archivo / módulo | Cambio |
|------------------|--------|
| `src/modules/{alojamientos,autos,atracciones}/` | Eliminados |
| `src/common/common.module.ts`, `dto/pagination-*.dto.ts`, `dto/paginated-response.dto.ts` | Eliminados |
| `src/app.module.ts`, `vuelos.module.ts` | Sin `CommonModule` ni bloque «ATENCIÓN ALUMNO» |
| `contracts/*-openapi.yaml` de otros equipos, `atracciones.proto` | `contracts/socios/` |
| `README.md`, `package.json`, `main.ts`, `CLAUDE.md`, `eslint.config.mjs` | Textos de Vuelos |
| `seed/ecommerce.seed.ts`, `mercado.dto.ts` | Sin `ALOJAMIENTOS/CARROS` |

## Impacto en la API / contrato
Ninguno en rutas. El contrato `vuelos-ecommerce-openapi.yaml` se regenera por el ejemplo de `productosBuscador`.

## Verificación
`npm run lint`, `npm run build`, `npm test` con `TEST_DATABASE_URL`; `git grep -i "alojamientos\|atracciones\|autos"` solo debe encontrar documentos históricos y `contracts/socios/`.
