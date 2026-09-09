# Размещение в GitLab и разделение репозитория

По внутреннему правилу размещения проектов значимы **последние 3 уровня** пути:
`{service}/{platform}/{repo}`, где `platform` — строго `backend`, `frontend`
или `mobile`. Монорепо в эту схему не укладывается, поэтому IMS разбивается на
два репозитория.

## Целевые пути

| Каталог сейчас | Путь в GitLab | Разбор |
|---|---|---|
| `backend/` | `domains/it/ims/backend/core` | `ims` — устоявшаяся аббревиатура (как OMS/DMS); единственный backend → `core` |
| `frontend/` | `domains/it/ims/frontend/admin` | SPA для сотрудников поддержки (вход по логину, роли admin/on_duty) → аудитория `admin`, не `public` |

- **namespace** `domains/it/` — IMS принадлежит одному владельцу (ИТ) как
  бизнес-домен, это не shared-сервис для нескольких доменов (иначе был бы
  `platform/`).
- **`ims`** vs `incident`: выбрана аббревиатура — совпадает с доменом `ims.av.ru`,
  правила разрешают устоявшиеся аббревиатуры. Расшифровка — в этом файле и README.
- Запрещённого `backend/backend`, `frontend/web` и т.п. — нет.

## Структура каталогов уже подготовлена

`backend/` и `frontend/` — самодостаточные проекты: свои `Dockerfile`,
`.dockerignore`, зависимости, без перекрёстных ссылок в коде. Разделение
сводится к `git filter-repo` по одному каталогу с сохранением истории.

## Процедура разделения (когда GitLab-группы созданы)

Ставим [git-filter-repo](https://github.com/newren/git-filter-repo)
(`pip install git-filter-repo`).

### backend → domains/it/ims/backend/core

```bash
git clone <текущий origin> ims-backend && cd ims-backend
git filter-repo --path backend/ --path-rename backend/:
git remote add origin https://gitlab.av.ru/domains/it/ims/backend/core.git
git push -u origin master
```

### frontend → domains/it/ims/frontend/admin

```bash
git clone <текущий origin> ims-frontend && cd ims-frontend
git filter-repo --path frontend/ --path-rename frontend/:
git remote add origin https://gitlab.av.ru/domains/it/ims/frontend/admin.git
git push -u origin master
```

### Что остаётся вне обоих репозиториев

`README.md`, `DEPLOY.md`, `REPO.md`, `SYSTEM_ANALYSIS.md`, `docs/`,
`docker-compose.yml` — общесистемная документация и локальный compose. Варианты:

- продублировать `DEPLOY.md`/`README.md` в оба репо (актуальные части);
- либо завести отдельный `domains/it/ims/docs` (или wiki группы `ims`) и
  держать их там; локальный `docker-compose.yml` — в нём же.

После разделения каждый репозиторий получает свой `.gitlab-ci.yml`
(сборка образа → тесты → пуш в registry → деплой) — их пишет девопс.

## До разделения

Пока это один репозиторий на GitHub — работаем в нём. Каталоги `backend/` и
`frontend/` уже разведены, чтобы разделение прошло механически и без правок кода.
