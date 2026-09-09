#!/bin/sh
set -e

cd /var/www/html

# ── .env ─────────────────────────────────────────────────────
if [ ! -f .env ]; then
    cp .env.example .env
fi

# ── APP_KEY (skip if provided via environment) ───────────────
if [ -z "$APP_KEY" ] && ! grep -q '^APP_KEY=base64:' .env; then
    php artisan key:generate --force
fi

# ── JWT secret (skip if provided via environment) ────────────
if [ -z "$JWT_SECRET" ] && grep -q '^JWT_SECRET=$' .env; then
    secret="$(php -r 'echo bin2hex(random_bytes(32));')"
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${secret}|" .env
fi

chown -R www-data:www-data storage bootstrap/cache

# ── Wait for MySQL ───────────────────────────────────────────
echo "Waiting for database ${DB_HOST:-db}:${DB_PORT:-3306} ..."
until php -r '
    try {
        new PDO(
            sprintf("mysql:host=%s;port=%s", getenv("DB_HOST") ?: "db", getenv("DB_PORT") ?: "3306"),
            getenv("DB_USERNAME") ?: "root",
            getenv("DB_PASSWORD") ?: ""
        );
        exit(0);
    } catch (Throwable $e) {
        exit(1);
    }
'; do
    sleep 2
done

# ── Migrations (seed only when the schema is still empty) ─────
if php artisan migrate:status >/dev/null 2>&1; then
    php artisan migrate --force
else
    php artisan migrate --seed --force
fi

# ── Optimize ─────────────────────────────────────────────────
php artisan config:cache

exec "$@"
