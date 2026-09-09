# Промпт: аудит IMS со стороны ИБ

Роль: ты — application security инженер. Проводишь ревью проекта IMS
(React/Vite фронт + Laravel 13 API, кастомный JWT на `firebase/php-jwt`,
MySQL). Цель — найти уязвимости и слабые места конфигурации, оценить риск,
предложить конкретные правки в коде.

## Что проверить

### 1. Аутентификация и сессии
- Хранение и подпись JWT: алгоритм, секрет (не переиспользуется ли `APP_KEY`),
  обязательность `JWT_SECRET` на проде, `iss`/`nbf`/`exp`/`leeway`.
- Ручной разбор токена в обход библиотеки (`decodeIgnoringExpiry`) —
  проверка подписи, отсутствие alg-confusion, окно refresh.
- Denylist отозванных `jti`: переживает ли рестарт (cache-драйвер), TTL.
- Ротация токена при `/auth/refresh`, инвалидация при `/auth/logout`.
- Брутфорс: есть ли `throttle` на `/auth/login`, `/auth/refresh`.
- Enumeration пользователей по ответу логина / по времени ответа.
- Политика паролей (`Password::defaults()`), `BCRYPT_ROUNDS`.

### 2. Авторизация (IDOR / privilege escalation)
- Каждый роут в `routes/api.php`: правильный ли middleware (`auth.jwt`,
  `role:admin`), нет ли забытых публичных.
- `IncidentPolicy`: может ли `on_duty` править/удалять чужой инцидент,
  переназначать `on_duty_user_id`, менять `created_by`.
- Mass assignment: `$fillable`, `except([...])` при `store`/`update`,
  выставляется ли `sla`, `code`, `created_by` только на сервере.
- `UserController::index` — какой объём данных о пользователях отдаётся
  не-админу (username = логин, роль, должность).
- Записные роуты справочников — точно ли только `role:admin`.

### 3. Валидация ввода и инъекции
- Все `FormRequest`: типы, `exists`, enum, границы (`per_page`, длины строк).
- `task_link` и любые URL-поля: схема (`javascript:`, `data:`), рендер во
  фронте (`href={...}` без санитайза → stored XSS).
- Поля, которые фронт выводит: `cause`, `impact`, `title`, `callee_name` —
  экранирование, отсутствие `dangerouslySetInnerHTML`.
- Фильтры/поиск в `Incident::filter()` — параметризованные ли запросы,
  нет ли `whereRaw` с конкатенацией.
- Загрузка файлов (если появится).

### 4. Конфигурация и инфраструктура
- `APP_DEBUG`, `APP_ENV` на проде; не утекает ли stacktrace в JSON-ответ.
- CORS: `allowed_origins` (не `*`), `supports_credentials`, заголовки.
- Заголовки безопасности: HSTS, `X-Content-Type-Options`, `X-Frame-Options`
  / CSP, `Referrer-Policy`.
- Секреты: `.env` не в гите, `.env.example` без реальных значений,
  `ADMIN_PASSWORD` обязателен на проде.
- HTTPS-редирект / `URL::forceScheme` за прокси, `TrustProxies`.
- Логи: не пишутся ли токены, пароли, PII; `LOG_LEVEL` на проде.
- Зависимости: `composer audit`, `npm audit` — известные CVE.
- Docker: не рутом ли процесс, какие порты наружу.

### 5. Прочее
- Rate limiting на API в целом.
- Обработка ошибок: единый формат, без утечки внутренних деталей.
- Массовые операции / отсутствие пагинации как вектор DoS (`per_page` до 2000).

## Формат вывода
Таблица находок: `Severity (Critical/High/Medium/Low) | Компонент | Описание |
Как эксплуатируется | Рекомендация`. Затем — патчи по приоритету.
