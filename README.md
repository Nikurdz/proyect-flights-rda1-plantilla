# RAM Alliance · Sistema de venta de vuelos

Plataforma web de venta de vuelos con enfoque API-first: núcleo GDS (búsqueda, retención de cupos, reservas, billetes, posventa, check-in y webhooks), e-commerce (identidad, ofertas, pagos simulados, órdenes) y panel de administración. Proyecto integrador de Integración de Sistemas.

| Parte | Tecnología | Carpeta |
|---|---|---|
| API | NestJS 10, TypeORM, PostgreSQL 16 | `src/modules/vuelos/` |
| Interfaz | React 18, Vite, Tailwind CSS | `frontend/` |
| Contratos | OpenAPI 3 | `contracts/` |
| Documentación | Markdown | `src/modules/vuelos/docs/` |

## Puesta en marcha

```bash
npm install
cp .env.example .env              # JWT_SECRET de al menos 32 caracteres
docker compose up -d              # PostgreSQL en el puerto 5432
npm run start:dev                 # API en http://localhost:3000/api/v1
npm run seed:vuelos               # vuelos, tarifas, localidades, plantillas (ADMIN_EMAIL y ADMIN_PASSWORD crean un administrador)
cd frontend && npm install && npm run dev
```

- Swagger: `http://localhost:3000/api/docs`
- Pruebas: `npm test` (con `TEST_DATABASE_URL` también corre las de integración) y `cd frontend && npm test`
- Lint: `npm run lint` (backend) y `cd frontend && npm run lint`
- Contrato del sistema completo: `npm run contract:export` (genera `contracts/vuelos-ecommerce-openapi.yaml` desde la API en ejecución)

## Contratos

- `contracts/vuelos-openapi.yaml`: contrato original del núcleo GDS (escrito a mano).
- `contracts/vuelos-ecommerce-openapi.yaml`: todo el sistema, generado.
- `contracts/socios/`: contratos de los proveedores externos que integra nuestra capa anticorrupción (atracciones, autos, alojamientos).

## Documentación

Empieza por [`src/modules/vuelos/README.md`](src/modules/vuelos/README.md); el modelo de datos está en [`docs/MODELO-DE-DATOS.md`](src/modules/vuelos/docs/MODELO-DE-DATOS.md), la arquitectura de eventos en [`docs/ARQUITECTURA-EVENTOS.md`](src/modules/vuelos/docs/ARQUITECTURA-EVENTOS.md) y los planes de cada cambio en [`docs/planes/`](src/modules/vuelos/docs/planes/). Las guías de trabajo para quien desarrolla con Claude Code están en [`CLAUDE.md`](CLAUDE.md).

## Despliegue

Frontend en Netlify, API en Railway (o Render, ver `render.yaml`) y base de datos en Neon. El arranque aplica las migraciones, siembra los datos de referencia y levanta la API (`npm run start:render`).
