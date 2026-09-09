# IMS API — бэкенд системы управления инцидентами

Laravel 13 · PHP 8.3+ · MySQL 8 · JWT (HS256).

REST API для фронтенда IMS: инциденты, хронология-постмортем, справочники и
агрегированная аналитика для дашборда. Аутентификация — stateless JWT, вход по
логину. Две роли: `admin` (полный доступ) и `on_duty` (дежурный — правит только
свои инциденты).

## Запуск

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
# создайте БД и пропишите доступы в .env:
#   DB_DATABASE=ims  DB_USERNAME=...  DB_PASSWORD=...
# впишите JWT_SECRET в .env (любая длинная случайная строка);
# без него используется APP_KEY
php artisan migrate --seed
php artisan serve         # http://127.0.0.1:8000
```

Быстро сгенерировать секрет:
`php -r "echo bin2hex(random_bytes(32));"` → в `JWT_SECRET`.

Нужен MySQL 8 (или совместимый MariaDB). Создать пустую БД:
`CREATE DATABASE ims CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
Пересоздать схему — `php artisan migrate:fresh --seed`.

Через Docker БД поднимается автоматически: `docker compose up` (сервис `db`,
MySQL 8.4, том `ims-db`).

### Сиды

`php artisan db:seed` заводит справочники (типы инцидентов, критичности) и одну
учётку администратора `admin`. Пароль — из `ADMIN_PASSWORD` (обязателен при
`APP_ENV=production`; вне прода без неё генерируется случайный и печатается в
вывод). Каталог сервисов/зон, дежурных и сами инциденты заводятся уже в
работающей системе.

## Тесты

```bash
php artisan test
```

Feature-тесты (`tests/Feature`): аутентификация, ролевой доступ, CRUD
инцидента с хронологией, метрики, аналитика. БД — MySQL, отдельная схема
`ims_testing` (см. `phpunit.xml`); создайте её один раз:
`CREATE DATABASE ims_testing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`

## Аутентификация

JWT в заголовке `Authorization: Bearer <token>`. Токен живёт `JWT_TTL` минут
(по умолчанию 12 ч), после `logout` попадает в denylist (cache) до момента
истечения. `POST /auth/refresh` принимает даже просроченный токен в течение
`JWT_REFRESH_TTL` и выдаёт новый, отзывая старый.

## Эндпоинты

Базовый префикс — `/api`.

### Auth

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| POST | `/auth/register` | public | Регистрация (роль всегда `viewer`, если не создаёт инженер) |
| POST | `/auth/login` | public | `{ email, password }` → `{ token, token_type, expires_in, user }` |
| GET | `/auth/me` | auth | Текущий пользователь |
| POST | `/auth/logout` | auth | Отозвать текущий токен |
| POST | `/auth/refresh` | auth* | Обменять токен на новый |

### Инциденты

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/incidents` | auth | Список с пагинацией и фильтрами |
| GET | `/incidents/{id}` | auth | Детали + хронология + метрики |
| POST | `/incidents` | engineer | Создать |
| PATCH/PUT | `/incidents/{id}` | engineer | Обновить (поле `timeline` синхронизирует шаги) |
| DELETE | `/incidents/{id}` | engineer | Удалить |
| POST | `/incidents/{id}/timeline` | engineer | Добавить шаг |
| PATCH/PUT | `/incidents/{id}/timeline/{step}` | engineer | Изменить шаг |
| DELETE | `/incidents/{id}/timeline/{step}` | engineer | Удалить шаг |

Фильтры `GET /incidents`: `search`, `status`, `type`, `sla`, `category`,
`service` (id или имя), `from`, `to` (по `detected_at`), `per_page`, `page`.

### Справочники и аналитика

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/services` | auth | Список сервисов с числом инцидентов |
| GET | `/meta` | auth | Все enum-справочники (типы, статусы, SLA, стороны, категории, виды шагов, роли, периоды) |
| GET | `/analytics/dashboard?period=7\|30\|90\|180\|365` | auth | Полный payload дашборда |

`GET /analytics/dashboard` возвращает: `kpis`, `time_analytics` (время до
обнаружения / на диагностику, с подсказками), `by_day`, `by_category`,
`by_type`, `top_services`, `heatmap` (7×8, день недели × 3-часовые корзины).

## Модель инцидента

```
code            INC-2026-00042 (генерируется)
title           string
service_id      → services
type            our_side | external | service_problem | stub
category        service | infrastructure | access | payments | data | other
status          new | in_progress | waiting | resolved
sla             met | breached
side            our | external
started_at      начало проблемы
detected_at     когда дежурный обнаружил
resolved_at     когда устранена
stub_installed  bool + stub_on / stub_off
cause, impact   text
task_link       url
zones           string[] (зоны ответственности)
timeline[]      шаги: { kind, action, time|occurred_at, position }
```

Виды шагов хронологии: `detected`, `diagnosis`, `handed_off`, `resolved`
(четыре обязательных) и `custom` (промежуточный). При создании без `timeline`
подставляются четыре пустых обязательных шага.

Метрики (`incidents/{id}.metrics`) считаются на бэке:

- **to_detect** = `detected_at − started_at`
- **to_diagnose** = время шага `handed_off` − время шага `diagnosis`
- **to_resolve** = `resolved_at − started_at`

## Конфиг (`.env`)

```
AUTH_GUARD=api
JWT_SECRET=...              # обязателен
JWT_TTL=720                 # минуты
JWT_REFRESH_TTL=20160
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
ADMIN_PASSWORD=...          # пароль сидируемого администратора (обязателен на проде)
```

## Структура

```
app/
  Enums/            типы/статусы/… как PHP-enum с label() (RU)
  Http/
    Controllers/    Auth, Incident, TimelineStep, Service, Meta, Analytics
    Middleware/     JwtAuthenticate, EnsureRole, ForceJsonResponse
    Requests/       валидация (FormRequest)
    Resources/      сериализация ответов
  Models/           User, Service, Incident, TimelineStep, …
  Services/         JwtService, AnalyticsService, IncidentMetrics, SlaEvaluator
  Support/          Duration, TimelineSync, EscalationSync, IncidentAuditor
database/
  migrations/       users, services, incidents, timeline_steps, справочники, аудит
  seeders/          справочники + учётка администратора
  factories/        для тестов
routes/api.php
```
