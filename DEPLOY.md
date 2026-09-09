# Развёртывание IMS

Два независимых сервиса, каждый — свой образ и свой CI:

| Сервис | Каталог / repo | Образ | Роль |
|---|---|---|---|
| backend | `backend/` → `domains/it/ims/backend/core` | PHP 8.4 + Apache | REST API, миграции, JWT |
| frontend | `frontend/` → `domains/it/ims/frontend/admin` | nginx | раздаёт SPA, проксирует `/api` на backend |

Домен: `ims.av.ru` (внутренний). БД: MySQL 8 (или MariaDB 10.6+).

Трафик: `браузер → [реверс-прокси, TLS] → frontend (nginx) → backend → MySQL`.
Наружу торчит только frontend; backend доступен ему по внутренней сети.

---

## Что должно быть готово до деплоя

| Ресурс | Комментарий |
|---|---|
| Платформа для контейнеров | Docker-хост / Kubernetes / внутренний PaaS |
| MySQL 8, пустая БД + пользователь | схему backend создаёт сам миграциями |
| DNS `ims.av.ru` → реверс-прокси | только внутренняя сеть |
| TLS-сертификат для `ims.av.ru` | HTTPS терминируется на реверс-прокси перед `frontend` |
| Container registry | два образа: `ims/backend`, `ims/frontend` |
| Хранилище секретов | `APP_KEY`, `JWT_SECRET`, `DB_PASSWORD`, `ADMIN_PASSWORD` |

---

## backend — переменные окружения

Обязательные:

| Переменная | Значение / как получить |
|---|---|
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_URL` | `https://ims.av.ru` |
| `APP_KEY` | `base64:...` — `php artisan key:generate --show` |
| `JWT_SECRET` | 32+ байт — `php -r "echo bin2hex(random_bytes(32));"`. **На проде обязателен**, иначе backend падает при старте. |
| `DB_CONNECTION` | `mysql` |
| `DB_HOST`, `DB_PORT` | адрес MySQL |
| `DB_DATABASE` | напр. `ims` |
| `DB_USERNAME`, `DB_PASSWORD` | учётка БД |
| `CACHE_STORE` | `database` или `redis`. **Не `array`** — в кеше denylist отозванных JWT (logout). |
| `ADMIN_PASSWORD` | пароль первой учётки `admin`. Нужен только для первого сида, потом убрать. |

Опциональные: `TRUSTED_PROXIES` (список IP реверс-прокси/frontend через запятую;
по умолчанию доверяем всем — сузить в проде), `QUEUE_CONNECTION=database`,
`LOG_LEVEL=warning`.

При старте [`backend/docker/entrypoint.sh`](backend/docker/entrypoint.sh) сам:
создаёт `.env` из примера → генерит `APP_KEY`/`JWT_SECRET`, если не переданы →
ждёт БД → применяет миграции (**сид справочников + `admin` только на пустой
схеме**) → `config:cache` → запускает Apache. Healthcheck: `GET /up`.

---

## frontend — переменные окружения

| Переменная | Значение |
|---|---|
| `BACKEND_URL` | внутренний адрес backend-сервиса, напр. `http://ims-backend:80` или `http://ims-backend.ims.svc.cluster.local`. Подставляется в конфиг nginx при старте. |

Фронт обращается к API по относительному `/api` — nginx внутри контейнера
проксирует его на `BACKEND_URL`. Отдельный публичный адрес API не нужен.
Healthcheck: `GET /healthz`.

> Если понадобится указать API на другом хосте на этапе сборки — переменная
> сборки `VITE_API_BASE_URL` (по умолчанию `/api`).

---

## Сборка и запуск

```bash
# backend
docker build -t <registry>/ims-backend:<tag> ./backend
docker push <registry>/ims-backend:<tag>

# frontend
docker build -t <registry>/ims-frontend:<tag> ./frontend
docker push <registry>/ims-frontend:<tag>
```

Запуск (пример через docker run; в проде — k8s/compose оркестратора):

```bash
docker network create ims

docker run -d --name ims-backend --network ims \
  -e APP_ENV=production -e APP_DEBUG=false \
  -e APP_URL=https://ims.av.ru \
  -e APP_KEY='base64:...' -e JWT_SECRET='...' \
  -e DB_CONNECTION=mysql -e DB_HOST=<host> -e DB_PORT=3306 \
  -e DB_DATABASE=ims -e DB_USERNAME=ims -e DB_PASSWORD='<секрет>' \
  -e CACHE_STORE=database -e ADMIN_PASSWORD='<сильный пароль>' \
  <registry>/ims-backend:<tag>

docker run -d --name ims-frontend --network ims -p 8080:80 \
  -e BACKEND_URL=http://ims-backend:80 \
  <registry>/ims-frontend:<tag>
```

Реверс-прокси компании смотрит на `ims-frontend:8080`, терминирует TLS для
`ims.av.ru`, проставляет `X-Forwarded-Proto: https`.

---

## После первого запуска

1. Открыть `https://ims.av.ru`, войти `admin` / `ADMIN_PASSWORD`.
2. Сменить пароль: **«Настройки» → «Сменить пароль»**.
3. Убрать `ADMIN_PASSWORD` из окружения backend (повторный сид на непустой БД не выполняется).
4. Завести дежурных и справочники через экран **«Администрирование»**.

---

## Обновление версии

Новый образ нужного сервиса → пересоздать контейнер. Миграции backend
применяются на старте, схему не сбрасывают. Фронт и бэк деплоятся независимо —
следи за совместимостью API при раздельных релизах.

---

## Тесты (в CI backend)

```bash
cd backend && composer install && php artisan test
```

Нужна пустая БД `ims_testing` (см. `backend/phpunit.xml`):

```sql
CREATE DATABASE ims_testing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## Чего в репозитории пока нет

- **CI/CD пайплайны** (`.gitlab-ci.yml` в каждом repo): сборка образа → тесты → пуш → деплой. Пишет девопс.
- **Прод-манифесты** (k8s / helm / compose оркестратора). `docker-compose.yml` в корне — **только локальная разработка** (`APP_ENV=local`, слабые пароли, встроенная MySQL).
- Разделение монорепо на два GitLab-репозитория — см. [REPO.md](REPO.md).
