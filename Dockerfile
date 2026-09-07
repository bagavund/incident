# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────
# Stage 1 — build the React/Vite frontend into backend/public
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY src ./src
RUN npm run build
# vite writes index.html + assets/ to /app/backend/public

# ─────────────────────────────────────────────────────────────
# Stage 2 — install PHP dependencies (no dev, optimized)
# ─────────────────────────────────────────────────────────────
FROM composer:2 AS vendor
WORKDIR /app

COPY backend/ ./
# Platform extensions are provided by the runtime image, not this build image.
RUN composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist \
        --no-scripts --ignore-platform-reqs \
 && composer dump-autoload --no-dev --optimize --no-scripts

# ─────────────────────────────────────────────────────────────
# Stage 3 — runtime: PHP 8.3 + Apache serving Laravel
# ─────────────────────────────────────────────────────────────
FROM php:8.3-apache AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
        libicu-dev libzip-dev \
 && docker-php-ext-install -j"$(nproc)" pdo_sqlite bcmath intl zip opcache \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN a2enmod rewrite \
 && echo "ServerName localhost" >> /etc/apache2/apache2.conf
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf

WORKDIR /var/www/html

COPY --from=vendor /app ./
COPY --from=frontend /app/backend/public/ ./public/

COPY docker/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint \
 && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 80
ENTRYPOINT ["entrypoint"]
CMD ["apache2-foreground"]
