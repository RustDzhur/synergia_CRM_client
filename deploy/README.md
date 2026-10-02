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

### Проверено сквозным тестом

Токен, подписанный тем же `JWT_SECRET`, что и в оригинале, принят дубликатом — значит сессии
пользователей переносятся без повторного входа. Запросы вернули реальные данные из PostgreSQL:

```
/api/contacts          → Rustem Dzhur
/api/deals             → сделка со своей стадией
/api/products          → «Брус сосновий 50×50»
/api/finance/settings  → Firm Space AI, UA/UAH
/api/notifications     → 3 непрочитанных
```

Проверка расшифровки секретов: **28 из 28** записей интеграций читаются ключом `JWT_SECRET`
(отдельного `ENCRYPTION_KEY` оригинал не использует). То есть пароли почты и токены каналов
на дубликате рабочие.

### Бэкапы

Ежедневный `pg_dumpall` в 02:30 дампит весь кластер, включая базу `crm` (хранение 14 дней) —
`/opt/infrastructure/backup/postgres/`. Отдельно настроена автопроверка: раз в 15 минут
`/api/health`, при отказе контейнер перезапускается.

### Файлы из Firebase Storage

По данным CRM таких файлов **17** (14 документов и 3 вложения сообщений); остальные 160 документов —
ссылки на Google Диск, байты им не нужны. Перенос одной командой (нужны `FIREBASE_SERVICE_ACCOUNT`
и `FIREBASE_STORAGE_BUCKET` из Vercel):

```
FIREBASE_SERVICE_ACCOUNT=... FIREBASE_STORAGE_BUCKET=... LOCAL_STORAGE_ROOT=/data/storage \
  node deploy/copy-firebase-files.mjs --write
```

Без ключей список того, что переносить, показывает и сухой прогон (без `--write`).

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

### СТОП-ФАКТОР: у сервера нет публичного IPv4 (DS-Lite)

Проверено на сервере:

- путь наружу: `1 → 192.168.178.1 (роутер) → 2 → 192.0.0.2` — это адрес AFTR, то есть
  подключение **DS-Lite**: IPv4 ходит через IPv6-туннель провайдера;
- публичный `92.208.2.202` — адрес шлюза Vodafone (`...pools.vodafone-ip.de`), а не роутера,
  поэтому **входящие IPv4-соединения до сервера в принципе не доходят**: проброс портов на
  роутере тут не поможет;
- `ufw` при этом уже разрешает 80 и 443 (проверено `iptables -L ufw-user-input -v`:
  правила есть, счётчик 443 — трафик только из локальной сети);
- у сервера есть **публичный IPv6** `2a02:8071:6541:7120:be24:11ff:fe55:b584` из /64 провайдера,
  Caddy отвечает по нему на :80 (308), но неясно, пропускает ли входящие IPv6 роутер.

Значит переключение `A`-записи `firmspace.de` на `92.208.2.202` **нерабочее**: трафик уйдёт
в никуда, а сертификат не выпустится. Варианты, по возрастанию надёжности:

1. **AAAA-запись на IPv6 сервера** — бесплатно и сразу, но IPv4-only посетители не смогут открыть
   сайт, и, скорее всего, потребуется разрешить входящий IPv6 в роутере (у FritzBox — «IPv6-Freigaben»).
2. **Cloudflare Tunnel** (рекомендуется при DS-Lite) — туннель устанавливает исходящее соединение,
   входящие порты и проброс не нужны, наружу выходит двустековый адрес Cloudflare. Нужен аккаунт
   Cloudflare и перенос DNS домена на Cloudflare. `cloudflared` можно запустить контейнером
   (`docker run -d --restart unless-stopped cloudflare/cloudflared:latest tunnel --no-autoupdate run --token <TOKEN>`),
   права root не нужны; маршрут — на `http://192.168.178.129:3210`.
3. **Запросить у Vodafone Dual Stack (публичный IPv4)** — тогда заработает обычный проброс 80/443,
   а Caddy выпустит сертификат как обычно.

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

## Публикация по IPv6 (выбранный вариант)

Сервер отдаёт сайт по своему глобальному IPv6 **2a02:8071:6541:7120:be24:11ff:fe55:b584**,
Caddy к нему готов (маршрут `firmspace.de, www.firmspace.de → 127.0.0.1:3210`, ACME переведён
на Let's Encrypt, ZeroSSL отключён — у него ломаются старые аккаунты Caddy).

Что нужно сделать владельцу:

1. **DNS (Vercel → Domains → DNS):** добавить `AAAA` для `@` и `www` со значением
   `2a02:8071:6541:7120:be24:11ff:fe55:b584`. Записи `A` можно пока **оставить** — тогда
   IPv4-посетители по-прежнему попадут на живой сайт Vercel, а IPv6 увидят дубликат
   (это и есть параллельная работа без простоя).
2. **Роутер (FritzBox):** разрешить входящий IPv6 — «Internet → Freigaben → IPv6» с правилом
   для TCP 80 и 443 на этот адрес (или Exposed Host для сервера).
3. Проверить с телефона по мобильной сети: `https://firmspace.de/api/health`.

Проверка на сервере: `bash deploy/check-public.sh` — покажет локальное здоровье, совпадение
AAAA, ответ Caddy по IPv6 и выдачу сертификата.

**Важно про стабильность адреса:** при DS-Lite префикс IPv6 может меняться при переподключении
провайдера. Скрипт `deploy/update-aaaa.sh` сравнивает адрес сервера с записью в DNS и (с токеном
Vercel) обновляет её: `VERCEL_TOKEN=... bash deploy/update-aaaa.sh --write`. Его можно поставить в cron.

## Публичный адрес

Пока DNS на поддомен не указывает на `92.208.2.202`, наружу контур не выставляем.
После появления записи (например `crm.firmspace.eu` → `92.208.2.202`) добавить в `/etc/caddy/Caddyfile`:

```
crm.firmspace.eu {
    reverse_proxy 127.0.0.1:3210
}
```

и выполнить `sudo systemctl reload caddy`, а в `.env` поставить `APP_URL=https://crm.firmspace.eu`.
