# IMS API — бэкенд системы управления инцидентами

Laravel 13 · PHP 8.5 · SQLite · JWT (HS256).

REST API для фронтенда IMS: инциденты, хронология-постмортем, справочники и
агрегированная аналитика для дашборда. Аутентификация — stateless JWT, две роли:
`engineer` (полный доступ) и `viewer` (только чтение).

## Запуск

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
# впишите JWT_SECRET в .env (любая длинная случайная строка);
# без него используется APP_KEY
php artisan migrate --seed
php artisan serve         # http://127.0.0.1:8000
```

Быстро сгенерировать секрет:
`php -r "echo bin2hex(random_bytes(32));"` → в `JWT_SECRET`.

SQLite-файл создаётся автоматически (`database/database.sqlite`). Повторный
прогон демо-данных — `php artisan migrate:fresh --seed`.

### Тестовые учётки

| Роль | Email | Пароль |
|------|-------|--------|
| engineer | `engineer@ims.local` | `password` |
| viewer | `viewer@ims.local` | `password` |

## Тесты

```bash
php artisan test
```

14 feature-тестов (`tests/Feature`): аутентификация, ролевой доступ, CRUD
инцидента с хронологией, метрики, аналитика. БД — SQLite in-memory.

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
  Models/           User, Service, Incident, TimelineStep
  Services/         JwtService, AnalyticsService, IncidentMetrics
  Support/          Duration, TimelineSync
database/
  migrations/       services, incidents, timeline_steps, role в users
  seeders/          Service/User/Incident — демо-данные (~26 инцидентов)
routes/api.php
```
