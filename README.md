# IMS — Incident Management System

Система управления IT-инцидентами: дашборд, реестр инцидентов и постмортемы.

Один репозиторий, две самодостаточные части — свой Dockerfile у каждой,
общаются по HTTP:

| Каталог | Что |
|---|---|
| [backend/](backend/) | Laravel 13 + MySQL 8 + JWT, только API. Своя [README](backend/README.md) |
| [frontend/](frontend/) | React + TS + Tailwind + Recharts, SPA-админка для сотрудников поддержки; nginx раздаёт её и проксирует `/api` на бэкенд |

Интерфейс минималистичный в духе iOS / Notion: тёмная тема, приглушённые
границы, зелёный акцент точечно, моноширинный шрифт для чисел и времени.

## Запуск в Docker (одна команда)

Нужен только Docker с Compose. Из корня:

```bash
docker compose up --build
```

Три контейнера: `frontend` (nginx, отдаёт SPA и проксирует `/api`), `backend`
(PHP 8.4 + Apache), `db` (MySQL 8.4). Приложение — **http://localhost:8080**.
Миграции и сиды применяются автоматически. База в томе `ims-db`, переживает
пересборку; снести — `docker compose down -v`.

Сид создаёт учётку `admin` (пароль — `ADMIN_PASSWORD`, локально `password`).

## Запуск без Docker

**Бэкенд** (`backend/`):

```bash
cd backend
composer install && cp .env.example .env
php artisan key:generate     # JWT_SECRET и ADMIN_PASSWORD впишите в .env
php artisan migrate --seed
php artisan serve            # http://127.0.0.1:8000
```

**Фронтенд** (`frontend/`, в отдельном терминале):

```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173, проксирует /api на :8000
```

Вход по логину `admin`, пароль — `ADMIN_PASSWORD` из `backend/.env`
(вне прода, если не задан, сид напечатает сгенерированный).

## Деплой в прод

См. [DEPLOY.md](DEPLOY.md) — два образа, реверс-прокс, переменные окружения.

## Структура фронтенда

```
frontend/
  src/
    components/ui.tsx    — Card, Button, Badge, Input, Select, Checkbox, …
    components/Sidebar.tsx, components/PasswordModal.tsx
    screens/             — Login, Dashboard, Incidents, IncidentDetail,
                           CreateIncident, IncidentForm, Admin
    router.tsx           — лёгкий роутер на History API
    lib/api.ts           — типизированный клиент к бэкенду
    lib/url.ts           — safeExternalUrl (http/https-only)
    adapters.ts          — API-формат ⇄ модель экранов
    auth.tsx · store.tsx · theme.tsx — сессия, данные, тема
    data.ts · types.ts · App.tsx
  nginx.conf.template    — прод: раздача SPA + проксирование /api
```
