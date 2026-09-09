# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────
# Stage 1 — build the SPA
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build          # → /app/dist

# ─────────────────────────────────────────────────────────────
# Stage 2 — nginx: раздаёт статику SPA и проксирует /api на backend
# ─────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# nginx:alpine прогоняет envsubst по *.template; фильтр — чтобы не затронуть
# собственные переменные nginx ($uri, $host, …), а только BACKEND_URL.
ENV BACKEND_URL=http://backend:8000
ENV NGINX_ENVSUBST_FILTER=BACKEND_URL

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
