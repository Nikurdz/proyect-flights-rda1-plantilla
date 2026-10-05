# Agentes de IA del proyecto Vuelos

Reparto de responsabilidades entre los agentes que trabajan en este repositorio (rama `vuelos`).

## Roles

| Área | Agente(s) | Alcance |
|------|-----------|---------|
| Documentación | **OpenCode** y **Antigravity** | Auditorías y revisiones del sistema. Escriben en `src/modules/vuelos/docs/`. No modifican código de producción. |
| Sistema de información, backend y base de datos | **Claude Code Desktop** | Servicios, entidades, migraciones, seeds, contrato OpenAPI y pruebas del módulo Vuelos. |
| UI/UX | **Antigravity** | Frontend completo, conectado directamente al backend (API `api/v1`, contrato `contracts/vuelos-openapi.yaml`) sin generar errores de integración. |

## Regla: todo desarrollo requiere un plan de implementación

Cuando un agente vaya a **realizar desarrollo** (código nuevo o cambios de comportamiento), debe generar **antes de escribir código** un plan de implementación y adjuntarlo al proyecto:

- Ubicación: `src/modules/vuelos/docs/planes/AAAA-MM-DD-<tema>.md`
- Formato: copiar `src/modules/vuelos/docs/planes/PLANTILLA.md`.
- El plan se versiona en la rama `vuelos` junto con el cambio que describe.
- Las auditorías y revisiones puramente documentales no requieren plan.

## Reglas de coordinación

- Todo el trabajo ocurre en la rama `vuelos`, nunca directo en `main`.
- El frontend consume el backend solo a través del contrato (`contracts/vuelos-openapi.yaml` y Swagger en `/api/docs`). Si necesita un endpoint o campo nuevo, lo solicita en su plan y lo implementa Claude Code Desktop.
- Cambios de backend que alteren la API deben actualizar el contrato en el mismo cambio, para no romper el frontend.
- Los agentes de documentación reportan hallazgos en `docs/`; las correcciones de código las ejecuta el agente dueño del área.
