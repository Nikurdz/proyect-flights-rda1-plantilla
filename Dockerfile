# Backend de Vuelos (NestJS) para Azure Container Apps. El frontend va aparte (Netlify).
#   docker build -t vuelos .
#   docker run --env-file .env -p 3000:3000 vuelos

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Las devDependencies hacen falta: el Nest CLI que compila la app es una de ellas.
RUN npm ci --include=dev
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_TO_FILES=false \
    NODE_OPTIONS=--max-old-space-size=384
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# La app lee estos contratos en tiempo de ejecucion (esquemas de eventos y /api/docs-v2).
COPY contracts ./contracts
USER node
EXPOSE 3000
# Migra el esquema, lanza el seed (idempotente) EN SEGUNDO PLANO y arranca la API sin esperarlo: con una base
# lejana el seed puede tardar minutos y la sonda de arranque reiniciaria el contenedor.
CMD ["npm", "run", "start:container"]
