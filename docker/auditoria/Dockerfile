# Imagen del servicio "auditoria" (demo con docker compose; produccion en Azure sigue con el Dockerfile de la raiz).
# El contexto es la RAIZ del repo:  docker build -f docker/auditoria/Dockerfile -t ram-auditoria .
# Las etapas de compilacion son identicas en los cuatro servicios backend: con BuildKit la cache se comparte.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production     PORT=3001     LOG_TO_FILES=false     NODE_OPTIONS=--max-old-space-size=384     SERVICE_ROLE=auditoria
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY contracts ./contracts
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5   CMD wget -qO- http://127.0.0.1:3001/health >/dev/null || exit 1
CMD ["node", "dist/servicios/auditoria/main.js"]
