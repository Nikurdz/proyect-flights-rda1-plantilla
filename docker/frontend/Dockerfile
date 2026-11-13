# Frontend (Vite + React) servido por nginx. El contexto es frontend/:
#   docker build --build-context nginxconf=docker/frontend -f docker/frontend/Dockerfile --build-arg VITE_API_URL=http://localhost:8000/api/v1 -t ram-frontend frontend
# nginx.conf llega como contexto adicional "nginxconf" (el contexto principal es frontend/); el compose ya lo declara.
# VITE_API_URL se incrusta al compilar y debe terminar en /api/v1 (el cliente lo usa como base de la API);
# el gateway GraphQL se deriva de ella (http://localhost:8000/graphql).

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=http://localhost:8000/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=nginxconf nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
