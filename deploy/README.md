# Дубликат CRM на сервере

Отдельный контур того же кода: **PostgreSQL** вместо MongoDB, **локальный диск** вместо Firebase Storage.
Оригинал (ветка `main` и деплой на Vercel) не затрагивается.

## Что где лежит на сервере

- код: `~/crm-duplicate` (пользователь `server`; каталог `/opt/projects` принадлежит root)
- образ: `firmspace-crm:latest`, контейнер `firmspace-crm`
- файлы: том `crm-duplicate_crm_storage`, внутри — `/data/storage`
- база: контейнер `postgres` (сеть `infrastructure`), база `crm`, роль `crm_app`
- порт: `127.0.0.1:3210` (наружу не публикуется)

## Обновление

```bash
cd ~/crm-duplicate
tar xzf - -C ~/crm-duplicate            # или git pull
docker compose -f deploy/docker-compose.yml up -d --build
```

## Проверка

```bash
curl -s http://127.0.0.1:3210/api/health
```

С Mac — через туннель:

```bash
ssh -N -L 3210:127.0.0.1:3210 server@10.50.0.1
open http://127.0.0.1:3210
```

## Состояние (проверено)

- контейнер `firmspace-crm` работает, `/api/health` отвечает `{"ok":true,"db":"ok"}`;
- `DATABASE_URL`, `JWT_SECRET`, `APP_URL`, `LOCAL_STORAGE_ROOT`, `CRON_SECRET` заданы;
- клиент Prisma внутри контейнера читает перенесённые данные: 6 пользователей, 86 контактов,
  17 счетов, 1218 движений по складу;
- база — отдельная (`crm` в контейнере `postgres`), оригинал на MongoDB не затронут.

### Две грабли сборки (обе учтены в Dockerfile)

1. `npm ci` падает на транзитивной `@types/react@19.3.0`, которой нет в lock-файле → используем
   `npm install`.
2. Prisma выбирает движок по версии libssl **в момент генерации**: без `openssl` в build-стадии
   в образ попадает `libquery_engine-debian-openssl-1.1.x`, а bookworm работает на OpenSSL 3 —
   движок не загружается, и `/api/health` отвечает «Database error». `openssl` ставится в обе стадии.

## Крон на сервере

На Vercel напоминания обходил Vercel Cron. На своём сервере то же делает пользовательский crontab
(тот же секрет `CRON_SECRET` из `deploy/.env`):

```
5 7 * * * curl -s -m 120 -H "Authorization: Bearer <CRON_SECRET>" http://127.0.0.1:3210/api/cron/reminders
```

Проверка вручную: `curl -H "Authorization: Bearer <CRON_SECRET>" http://127.0.0.1:3210/api/cron/reminders`
→ `{"orgs":1,"reminders":0,"jobs":0}`.

## Чего не хватает из секретов

В `/opt/projects/firmspace/.env` лежат только реквизиты инфраструктуры того проекта (Postgres/Redis/MinIO) —
секретов CRM там нет. Если дубликату нужны интеграции и ИИ, перенесите из Vercel → Settings → Environment
Variables: `ENCRYPTION_KEY` (обязательно тот же, что в оригинале — иначе сохранённые токены интеграций не
расшифруются), `GOOGLE_CLIENT_ID/SECRET`, `META_APP_ID/SECRET`, `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`,
`STRIPE_*`, `NOWPAYMENTS_*`, `ADMIN_EMAILS`.

## Переключение домена firmspace.de (боевое)

Сервер уже готов принять боевой домен: Caddy настроен на `firmspace.de, www.firmspace.de` →
`127.0.0.1:3210`, `APP_URL=https://firmspace.de`, данные догнаны из Mongo (`--upsert`).

**Шаг, который делает владелец (я не имею доступа к DNS):** в панели Vercel → Domains → DNS
заменить записи `A` для `@` и `www` на `92.208.2.202` (сейчас там IP Vercel). После этого
трафик уйдёт на сервер, а Caddy сам получит сертификат Let's Encrypt (порты 80/443 открыты).
Чтобы Vercel не отвечал за домен, там же домен из проекта лучше убрать.

Откат: вернуть в Vercel исходные A-записи (Vercel снова начнёт обслуживать сайт).

Проверка после переключения:

```
curl -s https://firmspace.de/api/health      # {"ok":true,"db":"ok"}
dig +short firmspace.de                       # 92.208.2.202
```

Перед переключением стоит убедиться, что `MONGODB_URI` в оригинале больше не меняется —
иначе нужен ещё один `node .zz-migrate-mongo-to-pg.mjs --upsert`.

## Публичный адрес

Пока DNS на поддомен не указывает на `92.208.2.202`, наружу контур не выставляем.
После появления записи (например `crm.firmspace.eu` → `92.208.2.202`) добавить в `/etc/caddy/Caddyfile`:

```
crm.firmspace.eu {
    reverse_proxy 127.0.0.1:3210
}
```

и выполнить `sudo systemctl reload caddy`, а в `.env` поставить `APP_URL=https://crm.firmspace.eu`.
