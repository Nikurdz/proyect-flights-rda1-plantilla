# docs — documentación del módulo de Vuelos

## Qué hay aquí

| Archivo o subcarpeta | Qué hace |
|---|---|
| [planes/](planes/README.md) | Planes de implementación por fecha (uno antes de cada desarrollo) |
| [RDA1-docs/](RDA1-docs/README.md) | Auditorías históricas de la etapa RDA1 |
| [RDA2-docs/](RDA2-docs/README.md) | Etapa RDA2: contratos v1/v2, eventos, microservicios, Nielsen, auditorías C01-C14 y cuaderno |
| `MODELO-DE-DATOS.md` | Diagrama ER y tablas; **generado** con `npm run docs:modelo`, no se edita |
| `ARQUITECTURA-CAPAS.md` | ESB, bus RabbitMQ, gateway GraphQL, logs |
| `ARQUITECTURA-EVENTOS.md` | SOA/EDA, catálogo de eventos y webhooks |
| `DESPLIEGUE-NORMALIZACION.md` | Despliegue y migración a 3FN |
| `GUIA-DEFENSA-SWAGGER.md` | Recorrido de una compra en Swagger para la defensa |
| `SRS_Plataforma_Ecommerce_LATAM.md`, `Levantamiento_Requerimientos_LATAM_Nucleo_Vuelos_1.md` | Requisitos (e-commerce R1 y núcleo de vuelos) |
| `AGENTES.md` | Roles de los agentes y regla de planes |
| `INFORME-DESARROLLO-FRONTEND.md`, `PROMPT-FRONTEND-ANTIGRAVITY.md` | Informe y encargo del frontend |
| `arquitectura-completa-vuelos.mermaid` / `.svg` / `-HD.png` | Diagrama general de la arquitectura |

## Cómo se conecta

- Los planes alimentan las auditorías: `planes/` → `RDA2-docs/auditorias/`.
- El estado vigente del sistema está en `CLAUDE.md` (raíz); los documentos viejos describen su fecha.

## Más a fondo

- [README del módulo](../README.md) · [Auditorías](RDA2-docs/auditorias/README.md) · [Cuaderno Reto 2](RDA2-docs/auditorias/RETO-2-CUADERNO/README.md)

← Volver a [vuelos](../README.md)
