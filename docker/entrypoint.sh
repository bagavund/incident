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

# ── SQLite database ──────────────────────────────────────────
db_file="${DB_DATABASE:-/var/www/html/database/database.sqlite}"
mkdir -p "$(dirname "$db_file")"
fresh_db=0
if [ ! -s "$db_file" ]; then
    fresh_db=1
    : > "$db_file"
fi
chown -R www-data:www-data "$(dirname "$db_file")" storage bootstrap/cache

# ── Migrations (seed only on a brand-new database) ────────────
if [ "$fresh_db" -eq 1 ]; then
    php artisan migrate --seed --force
else
    php artisan migrate --force
fi

# ── Optimize ─────────────────────────────────────────────────
php artisan config:cache

exec "$@"
