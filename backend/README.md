# IMS API — бэкенд системы управления инцидентами

Laravel 13 · PHP 8.3+ · MySQL 8 · JWT (HS256).

REST API для фронтенда IMS: инциденты, хронология-постмортем, эскалации,
справочники и агрегированная аналитика для дашборда. Аутентификация —
собственный stateless JWT, вход **по логину** (не email). Две роли:
`admin` (полный доступ) и `on_duty` (дежурный — правит только те инциденты,
где вписан сам).

Полное системное описание, алгоритмы и метрики — в
[../SYSTEM_ANALYSIS.md](../SYSTEM_ANALYSIS.md), часть II.

## Запуск

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
# создайте БД и пропишите доступы в .env:
#   DB_DATABASE=ims  DB_USERNAME=...  DB_PASSWORD=...
# впишите JWT_SECRET в .env (любая длинная случайная строка);
# без него вне прода — фолбэк на APP_KEY, на APP_ENV=production обязателен
php artisan migrate --seed
php artisan serve         # http://127.0.0.1:8000
```

Быстро сгенерировать секрет:
`php -r "echo bin2hex(random_bytes(32));"` → в `JWT_SECRET`.

Нужен MySQL 8 (или совместимый MariaDB). Создать пустую БД:
`CREATE DATABASE ims CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
Пересоздать схему — `php artisan migrate:fresh --seed`.

Через Docker БД поднимается автоматически: `docker compose up` из корня
репозитория (сервис `db`, MySQL 8.4, том `ims-db`).

### Сиды

`php artisan db:seed` заводит справочники (типы инцидентов, критичности,
зоны) и одну учётку администратора `admin`. Пароль — из `ADMIN_PASSWORD`
(обязателен при `APP_ENV=production`; вне прода без неё генерируется
случайный и печатается в вывод). Каталог сервисов, дежурных и сами
инциденты заводятся уже в работающей системе.

## Тесты

```bash
php artisan test
```

Feature-тесты (`tests/Feature`): аутентификация, ролевой доступ, CRUD
инцидента с хронологией и эскалациями, метрики, вердикт SLA, аналитика,
справочники, пользователи. БД — MySQL, отдельная схема `ims_testing`
(см. `phpunit.xml`); создайте её один раз:
`CREATE DATABASE ims_testing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`

## Аутентификация

JWT в заголовке `Authorization: Bearer <token>`. Токен живёт `JWT_TTL`
минут (по умолчанию 720 = 12 ч), после `logout` / `refresh` / смены пароля
`jti` попадает в denylist (кэш) до момента истечения `exp`.
`POST /auth/refresh` принимает даже просроченный токен в течение
`JWT_REFRESH_TTL` (по умолчанию 20160 = 14 дней) и выдаёт новый, отзывая
старый. Самостоятельной регистрации нет — учётки заводит администратор.

`POST /auth/login` отвечает `422` на неверную пару логин/пароль (не `401`),
поэтому `401` на клиенте всегда однозначно означает «токен непригоден».

## Эндпоинты

Базовый префикс — `/api`. Публичный только `POST /auth/login`
(`throttle:5,1`); остальные требуют `Authorization: Bearer <token>`
(middleware `auth.jwt`). Запись в справочники, SLA и пользователей —
дополнительно `role:admin`.

### Auth

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| POST | `/auth/login` | публичный, `throttle:5,1` | `{ username, password }` → `{ token, token_type, expires_in, user }` |
| GET | `/auth/me` | auth | Текущий пользователь |
| POST | `/auth/logout` | auth | Отозвать текущий токен |
| POST | `/auth/refresh` | auth, `throttle:10,1` | Обменять токен на новый (старый в denylist) |
| POST | `/auth/password` | auth, `throttle:5,1` | Смена своего пароля (нужен текущий); старый токен в denylist, в ответе новый |

### Инциденты

Идентификатор в пути — человекочитаемый `code` (`INC-2026-00042`).

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/incidents` | auth | Список; фильтры `search, status, type, sla, criticality, zone, service, from, to`, `per_page` (до 2000) |
| GET | `/incidents/{code}` | auth | Детали + хронология + эскалации + `metrics` |
| GET | `/incidents/{code}/audit` | auth | Журнал изменений (дифф полей) |
| POST | `/incidents` | auth (admin или дежурный) | Создать (поле `timeline` синхронизирует шаги, всё в транзакции) |
| PATCH/PUT | `/incidents/{code}` | admin / свой дежурный (`IncidentPolicy`) | Обновить |
| DELETE | `/incidents/{code}` | admin / свой дежурный | Удалить со связанными записями + аудит |

Поле `sla` из запроса игнорируется — вердикт выносит `SlaEvaluator` на
сервере.

### Справочники

Одинаковый контракт для `services`, `zones`, `incident-types`, `criticalities`.

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/{справочник}` | auth | Значения + `usage_count` |
| POST | `/{справочник}` | admin | Добавить (дубли отклоняются без учёта регистра и языка) |
| PATCH/PUT | `/{справочник}/{id}` | admin | Переименовать (каскадом во все инциденты) |
| DELETE | `/{справочник}/{id}` | admin | Удалить (`409 Conflict`, если значение используется) |

### Аналитика, SLA, пользователи

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | `/analytics/dashboard?period=7\|30\|90\|180\|365` (или `from`/`to`) | auth | Полный payload дашборда |
| GET | `/sla-setting` | auth | Текущий порог SLA (минуты) |
| PATCH/PUT | `/sla-setting` | admin | Сменить порог (сервер пересчитывает вердикт) |
| GET | `/users` | auth | Список (нужен для выбора дежурного в форме) |
| POST | `/users` | admin | Завести учётку |
| PATCH/PUT | `/users/{user}/password` | admin | Сброс пароля пользователя |

`GET /analytics/dashboard` возвращает: `kpis`, `time_analytics` (время до
обнаружения / на диагностику / до эскалации), `by_day`, `by_zone`,
`by_type`, `top_services`, `top_services_pie`, `heatmap` (7 × 24, день
недели × час обнаружения), `channel_speed`, `reliability` (пять долей),
`period` (эхо запроса). Разбор каждого поля — в SYSTEM_ANALYSIS §4.3.

Ошибки валидации — `422` с `{ message, errors: { поле: [...] } }`;
`ForceJsonResponse` гарантирует JSON на все ответы под `/api`.

## Модель инцидента

```
code            INC-2026-00042 (генерирует Incident::nextCode())
title           string
services        many-to-many через incident_service
type            nullable string — значение из справочника incident_types по имени
                (external | internal как категория проблемы), обязателен при публикации
criticality     nullable string — значение из справочника criticalities по имени,
                обязателен при публикации
status          draft | published
sla             met | breached — пишет только SlaEvaluator, из запроса не принимается
created_by      → users (автор)
on_duty_user_id → users (дежурный, реальный аккаунт)
started_at      начало инцидента (первый шаг хронологии «Начало инцидента»)
detected_at     когда дежурный обнаружил
resolved_at     когда устранена (последний шаг «Решена»)
stub_installed  bool + stub_on / stub_off ("ЧЧ:ММ")
cause, impact   text
impact_targets  json — влияние на сайт / МП
task_link       url (валидируется url:http,https)
zones           json — массив имён зон ответственности
timeline[]      шаги: { kind, action, occurred_at, position, custom }
escalations[]   попытки: { time, callee_name, kind, channel, result, attempts, position }
```

Виды шагов хронологии (`TimelineKind`): `detected`, `diagnosis`,
`handed_off`, `resolved` (четыре обязательных, в этом порядке) плюс
опциональные `informed`, `war_room` и произвольные промежуточные
(`custom = true`). При создании без `timeline` подставляются четыре пустых
обязательных шага.

**Время шагов.** Форма присылает у каждого шага только время суток
`"ЧЧ:ММ"`. При сохранении `TimelineSync` идёт по шагам в порядке `position`,
привязывает время к дате `started_at` и переносит на следующие сутки, пока
последовательность не перестанет «идти назад» (`Duration::resolveClock`) —
ночной инцидент не схлопывается. В БД лежит готовый `occurred_at`
(timestamp). Время первого и последнего шагов берётся из `started_at` и
`resolved_at`.

Метрики (`incidents/{code}.metrics`, считает `IncidentMetrics`):

- **to_detect** (MTTD) = `detected_at − started_at`
- **to_escalate** = `detected_at` → шаг `handed_off`
- **to_diagnose** = шаг `diagnosis` → шаг `handed_off`
- **to_resolve** (MTTR) = `resolved_at − started_at`
- **stub_duration**, **escalation.total_calls**, **escalation.\*_span** —
  см. SYSTEM_ANALYSIS §4.1

## Конфиг (`.env`)

```
JWT_SECRET=...              # обязателен на проде, иначе фолбэк на APP_KEY
JWT_TTL=720                 # минуты (12 ч)
JWT_REFRESH_TTL=20160       # минуты (14 дней)
JWT_LEEWAY=30               # секунды
CACHE_STORE=database        # держит denylist JWT и счётчики троттлинга — не array
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
ADMIN_PASSWORD=...          # пароль сидируемого администратора (обязателен на проде)
```

Политика паролей (`Password::defaults()`): вне прода `min(8)`, на проде
`min(12)` + разный регистр + цифры + проверка по базе утечек, `max(72)`
(предел bcrypt) в обеих ветках.

## Структура

```
app/
  Enums/            типы/статусы/каналы/… как PHP-enum с label() (RU)
  Http/
    Controllers/    Auth, Incident, Analytics, SlaSetting, User,
                    Service/Zone/IncidentType/Criticality (общий CategorizedLookup)
    Middleware/     JwtAuthenticate, EnsureRole, ForceJsonResponse
    Requests/       валидация (FormRequest)
    Resources/      сериализация ответов, трейт SerializesEnum
  Models/           User, Service, Incident, TimelineStep, EscalationAttempt,
                    Zone, IncidentType, Criticality, SlaSetting, IncidentAudit
  Policies/         IncidentPolicy — «кто правит инцидент»
  Services/         JwtService, AnalyticsService, IncidentMetrics, SlaEvaluator
  Support/          Duration, TimelineSync, EscalationSync, IncidentAuditor
database/
  migrations/       users, services, incidents, timeline_steps, escalation_attempts,
                    зоны/типы/критичности, sla_settings, incident_audits
  seeders/          справочники + учётка администратора
  factories/        для тестов
routes/api.php
```
