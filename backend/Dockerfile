# syntax=docker/dockerfile:1
# Контекст сборки — каталог backend/. Фронтенд собирается и деплоится отдельно
# (repo ims/frontend/admin); этот образ — только API.

# ─────────────────────────────────────────────────────────────
# Stage 1 — PHP-зависимости (без dev, оптимизированный автолоадер)
# ─────────────────────────────────────────────────────────────
FROM composer:2 AS vendor
WORKDIR /app

COPY . ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist \
        --no-scripts --ignore-platform-reqs \
 && composer dump-autoload --no-dev --optimize --no-scripts

# ─────────────────────────────────────────────────────────────
# Stage 2 — runtime: PHP 8.4 + Apache
# ─────────────────────────────────────────────────────────────
FROM php:8.4-apache AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
        libicu-dev libzip-dev \
 && docker-php-ext-install -j"$(nproc)" pdo_mysql bcmath intl zip opcache \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN a2enmod rewrite \
 && echo "ServerName localhost" >> /etc/apache2/apache2.conf
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf

WORKDIR /var/www/html

COPY --from=vendor /app ./

COPY docker/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint \
 && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 80
ENTRYPOINT ["entrypoint"]
CMD ["apache2-foreground"]
