# Развёртывание IMS

Приложение — один Docker-образ: [`Dockerfile`](Dockerfile) собирает React-фронт
и кладёт его в `public/` Laravel-бэкенда, наружу торчит Apache на порту `80`.
Отдельно деплоить SPA не нужно.

Домен: `ims.av.ru` (внутренний). БД: MySQL 8 (или MariaDB 10.6+).

---

## Что должно быть готово до деплоя

| Ресурс | Комментарий |
|---|---|
| Платформа для контейнера | Docker-хост / Kubernetes / внутренний PaaS |
| MySQL 8, пустая БД + пользователь | схему приложение создаёт само миграциями |
| DNS `ims.av.ru` → платформа | только внутренняя сеть |
| TLS-сертификат для `ims.av.ru` | HTTPS терминируется на реверс-прокси перед контейнером |
| Container registry | куда CI пушит собранный образ |
| Хранилище секретов | `APP_KEY`, `JWT_SECRET`, `DB_PASSWORD`, `ADMIN_PASSWORD` |

---

## Переменные окружения (прод)

Обязательные:

| Переменная | Значение / как получить |
|---|---|
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_URL` | `https://ims.av.ru` |
| `APP_KEY` | `base64:...` — `php artisan key:generate --show` |
| `JWT_SECRET` | 32+ байт случайности — `php -r "echo bin2hex(random_bytes(32));"`. **На проде обязателен**: без него приложение падает при старте. |
| `DB_CONNECTION` | `mysql` |
| `DB_HOST`, `DB_PORT` | адрес MySQL |
| `DB_DATABASE` | напр. `ims` |
| `DB_USERNAME`, `DB_PASSWORD` | учётка БД |
| `CACHE_STORE` | `database` (или `redis`). **Не `array`** — в кеше живёт список отозванных JWT (logout), при `array` разлогин не переживает рестарт. |
| `ADMIN_PASSWORD` | пароль первой учётки `admin`. Нужен только для первого сида; потом можно убрать. |

Опциональные:

| Переменная | Значение |
|---|---|
| `QUEUE_CONNECTION` | `database` (очереди сейчас не используются) |
| `LOG_CHANNEL` | `stack`; `LOG_LEVEL=warning` |
| `TRUSTED_PROXIES` | список IP реверс-прокси через запятую; по умолчанию доверяем всем (`*`) — сузить, если прокси с фиксированным адресом |
| `CORS_ALLOWED_ORIGINS` | не нужен: фронт и API на одном домене |

---

## Запуск образа

Сборка (это делает CI, вручную — для проверки):

```bash
docker build -t <registry>/ims:<tag> .
docker push <registry>/ims:<tag>
```

Запуск:

```bash
docker run -d --name ims -p 80:80 \
  -e APP_ENV=production \
  -e APP_DEBUG=false \
  -e APP_URL=https://ims.av.ru \
  -e APP_KEY='base64:...' \
  -e JWT_SECRET='...' \
  -e DB_CONNECTION=mysql \
  -e DB_HOST=<mysql-host> -e DB_PORT=3306 \
  -e DB_DATABASE=ims -e DB_USERNAME=ims -e DB_PASSWORD='<секрет>' \
  -e CACHE_STORE=database \
  -e ADMIN_PASSWORD='<сильный пароль>' \
  <registry>/ims:<tag>
```

При старте [`docker/entrypoint.sh`](docker/entrypoint.sh) сам:

1. создаёт `.env` из `.env.example`, если его нет;
2. генерит `APP_KEY` / `JWT_SECRET`, если не переданы (лучше передавать явно и хранить в секретах);
3. ждёт доступности БД;
4. применяет миграции; **сид справочников + учётка `admin` — только если схема пустая**;
5. кеширует конфиг (`config:cache`);
6. запускает Apache.

Healthcheck для оркестратора: `GET /up` → `200`.

---

## Реверс-прокси

Контейнер слушает `:80` (plain HTTP). Перед ним — nginx/Traefik/Ingress:

- терминирует TLS для `ims.av.ru`;
- проксирует всё на контейнер;
- проставляет `X-Forwarded-Proto: https`, `X-Forwarded-For` (Laravel им доверяет — см. `TRUSTED_PROXIES`).

SPA-роутинг и `/api` разруливаются внутри контейнера (Apache + `.htaccess` + catch-all Laravel), от прокси ничего дополнительно не нужно.

---

## После первого запуска

1. Открыть `https://ims.av.ru`, войти `admin` / `ADMIN_PASSWORD`.
2. Сменить пароль: меню **«Настройки» → «Сменить пароль»**.
3. Убрать `ADMIN_PASSWORD` из окружения (повторный сид на непустой БД не выполняется — пароль не перезатрётся).
4. Завести дежурных и справочники (сервисы, зоны, типы, критичности) через экран **«Администрирование»**.

---

## Обновление версии

Новый образ → `docker pull` + пересоздать контейнер (или `kubectl set image`).
Миграции применятся автоматически при старте. Схему не сбрасывает, данные не трогает.

---

## Тесты (в CI)

```bash
cd backend
composer install
php artisan test
```

Нужна отдельная пустая БД `ims_testing` (см. `backend/phpunit.xml`):

```sql
CREATE DATABASE ims_testing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## Чего в репозитории пока нет

- **CI/CD пайплайн** (`.gitlab-ci.yml`): сборка образа → тесты → пуш в registry → деплой. Пишет девопс.
- **Прод-манифест** (compose для сервера / k8s / helm-чарт). В репо только `docker-compose.yml` — он **локальный** (`APP_ENV=local`, слабые пароли, встроенная MySQL), для прода не использовать.
