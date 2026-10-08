> **Какой compose боевой.** На облачном сервере работает стек `deploy/vps/` (проект `firmspace`, сети `firmspace_db` и `firmspace_ai`, автовыкладка `deploy/vps/autodeploy.sh`). Файлы `deploy/docker-compose.yml`, `deploy/autodeploy.sh` и `deploy/migrate.sh` относятся к прежнему одиночному серверу. Схему базы в боевом стеке накатывает сам контейнер при старте (`deploy/entrypoint.sh`), отдельного шага миграции в автовыкладке нет и не нужен.

# Дубликат CRM на сервере

Отдельный контур того же кода: **PostgreSQL** вместо MongoDB, **локальный диск** вместо Firebase Storage.
Оригинал (ветка `main` и деплой на Vercel) не затрагивается.

## Что где лежит на сервере

- код: `~/crm-duplicate` (пользователь `server`; каталог `/opt/projects` принадлежит root)
- образ: `firmspace-crm:latest`, контейнер `firmspace-crm`
- файлы: том `crm-duplicate_crm_storage`, внутри — `/data/storage`
- база: контейнер `postgres` (сеть `firmspace_db`), база `crm`, роль `crm_app`
- порт: `127.0.0.1:3210` (наружу не публикуется)

## Автоматическая выкладка из GitHub (без Vercel)

Схема: **GitHub → CI → сервер забирает сам**. Входящие соединения серверу не нужны —
у подключения DS-Lite их нет, поэтому сервер сам опрашивает GitHub (pull-модель).

1. **CI** — `.github/workflows/ci.yml`: на каждый пуш и пул-реквест ставит зависимости,
   генерирует клиент Prisma, проверяет типы (`tsc --noEmit`) и собирает приложение (`next build`).
2. **Автовыкладка** — `deploy/autodeploy.sh` на сервере, запускается по cron раз в 2 минуты:
   делает `git fetch` ветки выкладки и, если появился новый коммит **с зелёным CI**,
   выполняет `git reset --hard` и `docker compose up -d --build`.

Cron на сервере:

```
*/2 * * * * flock -n /tmp/crm-autodeploy.lock /home/server/crm-duplicate/deploy/autodeploy.sh
```

Настройки (ветка, репозиторий, обязателен ли зелёный CI) — в `deploy/autodeploy.env`
(образец: `deploy/autodeploy.env.example`). Выкладывается ветка `main` — единственная основная ветка (с 03.10.2026 миграцию на
PostgreSQL слили в `main`; прежняя линия на MongoDB сохранена тегом `backup/main-before-merge-20261003`).

**Какая версия живёт на сервере** — видно в ответе `/api/health`:

```
curl -s https://firmspace.de/api/health
{"ok":true,"commit":"2f0ed1e59216d7c5c158e2ed78d323382501176a","db":"ok",...}
```

Поле `commit` пишет `deploy/autodeploy.sh` в `deploy/.env` перед сборкой — это аналог номера
деплоя в Vercel. Проверено на живом контуре: пуш → CI зелёный → сервер сам пересобрал
и перезапустил контейнер (журнал `~/crm-autodeploy.log`, строка «готово: запущено в …»).

Журнал выкладок: `~/crm-autodeploy.log`. Откат: `git reset --hard <нужный коммит>` в
`~/crm-duplicate` и `docker compose -f deploy/docker-compose.yml up -d --build`.

Если хочется мгновенно, как Vercel, вместо опроса можно поставить на сервер
self-hosted runner GitHub Actions (тогда выкладка запускается самим GitHub) — но это
дополнительный процесс на сервере; pull-модель проще и уже работает.

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

Скрипт удобнее запускать на Mac (там есть `firebase-admin`), а файлы залить в том сервера:

```
node deploy/copy-firebase-files.mjs --write     # скачает в LOCAL_STORAGE_ROOT (задайте временный каталог)
tar czf - -C "$LOCAL_STORAGE_ROOT" . | ssh server@10.50.0.1 'docker run --rm -i -v deploy_crm_storage:/data alpine:3.24.2 tar xzf - -C /data'
```

Пути внутри хранилища совпадают с бакетом (`users/<id>/<файл>/<имя>`), поэтому CRM найдёт файлы сразу.

### Две грабли сборки (обе учтены в Dockerfile)

1. `npm ci` падает на транзитивной `@types/react@19.3.0`, которой нет в lock-файле → используем
   `npm install`.
2. Prisma выбирает движок по версии libssl **в момент генерации**: без `openssl` в build-стадии
   в образ попадает `libquery_engine-debian-openssl-1.1.x`, а bookworm работает на OpenSSL 3 —
   движок не загружается, и `/api/health` отвечает «Database error». `openssl` ставится в обе стадии.

## Крон на сервере (включить при переключении)

**Пока оригинал работает, крон дубликата выключен.** У оригинала на Vercel есть свои расписания
(`vercel.json`: `/api/cron/automation` в 06:00 UTC и `/api/cron/reminders` в 07:00 UTC). Если
запустить обход и здесь, обе системы обработают одни и те же задачи — клиенты получат письма
и уведомления дважды. Крон включается в момент переключения:

```
crontab -e
# добавить строку (секрет — из deploy/.env):
5 7 * * * curl -s -m 120 -H "Authorization: Bearer <CRON_SECRET>" http://127.0.0.1:3210/api/cron/reminders
```

Сторожевая проверка `/api/health` раз в 15 минут работает постоянно — она ничего не отправляет

## Крон: как это устроено

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
`ADMIN_EMAILS`.

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

**Входящий IPv6 уже работает — роутер менять не нужно.** Проверено внешним запросом
(сервис Jina AI на Google Cloud, `2600:1900::/28`):

- в conntrack сервера появилось `ESTABLISHED` соединение с внешнего IPv6 на **порт 80**
  (`src=2600:1900:0:2104::801 dport=80 [ASSURED]`);
- счётчики `ip6tables` выросли и на **80** (4 → 6), и на **443** (13 → 21) после двух внешних
  попыток: туннель IPv6 пропускает оба порта;
- TLS-рукопожатие при этом падает с `ERR_SSL_PROTOCOL_ERROR` — это ожидаемо: сертификата для
  «голого» IP у Caddy нет, он появится, когда в DNS будет AAAA для домена.

Что нужно сделать владельцу (один шаг):

1. **DNS (Vercel → Domains → DNS):** добавить `AAAA` для `@` и `www` со значением
   `2a02:8071:6541:7120:be24:11ff:fe55:b584`. Записи `A` можно пока **оставить** — тогда
   IPv4-посетители по-прежнему попадут на живой сайт Vercel, а IPv6 увидят дубликат
   (это и есть параллельная работа без простоя).
2. Проверить с телефона по мобильной сети: `https://firmspace.de/api/health`.

Либо выдать токен Vercel (Account Settings → Tokens) и выполнить на сервере:

```
VERCEL_TOKEN=... bash ~/crm-duplicate/deploy/update-aaaa.sh --write
```

Сертификат Caddy выпустит сам в течение пары минут после появления AAAA (проверка HTTP-01
идёт по IPv6:80, который уже доступен).

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
