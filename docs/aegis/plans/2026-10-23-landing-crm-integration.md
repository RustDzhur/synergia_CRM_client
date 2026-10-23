# План: объединение CRM и лендингов — формы → CRM, виджет чата, 4 контейнера на одном сервере

Дата: 2026-10-23. Владелец работ: Rustem. Репозитории: `crm_client` (этот), `burokratie-landing-page`,
`automatisation-landing-page`, `burokratie-copilot` — все в `/Users/rustem/Documents/WebDevelopment/`.
Сервер: `server@213.160.78.88` (Ubuntu, Docker, 4 CPU / 7.8 GB RAM / 67 GB disk).

## Aegis Visibility

Новая публичная поверхность CRM (webhook-приём заявок лендингов), новое владение заявками
(карточка клиента в CRM вместо локальной таблицы лендинга) и новая топология деплоя (4 compose-проекта
за одним Caddy) — план фиксирует контракт, чтобы три репозитория и сервер менялись согласованно.

## Goal

1. Заявки с форм обоих лендингов приходят в CRM: автоматически создаётся карточка клиента (Contact +
   сделка в колонке «New Lead»), в CRM приходит уведомление и уведомление команде в Telegram.
2. На оба лендинга установлен виджет чата CRM (`widget.js`) с кнопками подключённых мессенджеров
   (Telegram, WhatsApp, Messenger; Viber — появится автоматически после подключения канала в CRM).
3. На сервере 213.160.78.88 всё работает в отдельных контейнерах за одним Caddy:
   - `crm.firmspace.de` (+ сохранённые `firmspace.de`, `www.firmspace.de`) → CRM (уже работает),
   - `automatisation.firmspace.de` → automatisation-landing-page (новый контейнер),
   - `copilot.firmspace.de` → burokratie-landing-page (лендинг Copilot, новый контейнер),
   - `burokratie.firmspace.de` → burokratie-copilot платформа (пилот: postgres + api + web).

## Architecture

```
                         ┌───────────────────────────────────────────────┐
                         │            Caddy (host network :80/:443)       │
                         │  firmspace.de, crm.firmspace.de → 127.0.0.1:3210 (CRM)
                         │  automatisation.firmspace.de    → 127.0.0.1:3220
                         │  copilot.firmspace.de           → 127.0.0.1:3230
                         │  burokratie.firmspace.de        → 127.0.0.1:3240 (web)
                         │  burokratie.firmspace.de/api/v1/* → 127.0.0.1:3250 (api)
                         └──────────────┬────────────────────────────────┘
   формы лендингов ──POST https://crm.firmspace.de/api/webhooks/landing/<token>──► CRM:
      валидация → rate limit → Contact (source=landing:<site>) → Deal «New Lead» (externalId=id запроса,
      защита от дублей) → automation emit → notify() (уведомление в CRM) → notifyTeamTelegram()
   виджет: <script src="https://crm.firmspace.de/widget.js" data-token="<webchat>" data-lang="de">
```

Контракт endpoint (единый для обоих лендингов):

- `POST https://crm.firmspace.de/api/webhooks/landing/<token>`
- Заголовки: `Authorization: Bearer <landing-токен>`, `Content-Type: application/json`.
- Тело — супермножество полей обоих лендингов (все строки, обрезаются по лимитам):
  `name, company, email, phone, message | processDescription, mandantCount, belegVolume, datevWorkflow,
  contactChannel, companySize, industry, software, preferredContact, marketingConsent, consent,
  requestType ("demo"|"process_analysis"), sourcePage, id, receivedAt, utm{source,medium,campaign,term,content,gclid}`.
- Ответы: `201 {ok:true}`; ошибки `400/404/429/500 {ok:false, message}`.
- Поведение: contact ищется по `email` (case-insensitive), иначе создаётся (source=`landing:<site>`);
  deal создаётся в первой колонке (`ensureStages`), `externalId = "<site>:<id>"` — повторная отправка
  того же id не плодит дубли; `source="landing"`, `utm` — строка `utm_source|utm_medium|utm_campaign` или
  `sourcePage`; activities: `created`, `note` с текстом заявки, `note` с site/sourcePage;
  `emit(owner,{type:"lead_created",…})`, `notify(owner,{type:"lead",link:"/crm/crm",key:"landing:<site>:<email>:<дата>"})`,
  `notifyTeamTelegram(owner, …)`.

## Tech Stack

CRM: Next.js 13.4 (App Router) + Prisma/PostgreSQL (models `Contact`, `Deal`, `Stage`, `Integration`,
`Notification`). Лендинги: Next.js 15 + TS. Copilot: Spring Boot (Java 21) + Next.js 15 web. Сервер: Docker Compose,
Caddy 2.

## Baseline / Authority Refs

- Запрос владельца (2026-10-23): формы обоих лендингов → CRM (карточка + уведомление), виджет CRM с мессенджерами
  на лендинги, 4 проекта в отдельных контейнерах на одном сервере; субдомены: crm/burokratie/automatisation/copilot.firmspace.de.
- Паттерны кода CRM (переиспользуем, не дублируем): создание лидов из почты `lib/leads.ts` (contact+deal+notify+emit);
  публичный приём с токеном `app/api/webchat/[token]/…` + `lib/integrations.ts findByToken`; лимиты `lib/rateLimit.ts rateLimited(key,max,ms)`;
  виджет `public/widget.js` (готов, мессенджер-кнопки приходят из `GET /api/webchat/<token>`); Dockerfile CRM (standalone) — образец для лендингов.
- Лендинги уже умеют доставлять заявки во внешний webhook с Bearer-токеном:
  burokratie `src/app/api/demo-request/route.ts` (`DEMO_REQUEST_WEBHOOK_URL/TOKEN`),
  automatisation `lib/leads.ts` (`LEADS_API_URL/LEADS_API_TOKEN`) — код менять не нужно, только env на сервере.
- Сервер: compose `firmspace` в `~/crm-duplicate/deploy/vps` (caddy host-network + crm + postgres + speaches + tts),
  автодеплой CRM по вебхуку GitHub. Лендинги — не git-репозитории → развёртываются rsync'ом.
- Copilot: `infra/docker-compose.yml` + `infra/docker-compose.prod.yml` (никогда не запускались; runbook
  фиксирует блокеры: worker-профиль не стартует, регистрация 403 из-за CSRF — известные ограничения пилота).

## Compatibility Boundary

- Существующие API и UI CRM не меняются; добавляется только новый публичный маршрут
  `app/api/webhooks/landing/[token]/route.ts`.
- Лендинги: логика форм не меняется; при отсутствии env-переменных webhook поведение прежнее
  (dev-fallback в файл / 503). Виджет добавляется в layout через env-флаг — локальная разработка без изменений.
- Таблица `leads` в PostgreSQL automatisation-лендинга и путь `DATABASE_URL` в `storeLead` **сохраняются**
  как запасной путь (не удаляем: нет разрешения на миграцию данных лендинга; в прод-контейнере
  `DATABASE_URL` не задаётся, работает только `LEADS_API_URL` → CRM).
- Caddyfile перестраивается на **отдельные site-блоки** по доменам: сбой выпуска сертификата нового
  поддомена не должен ронять сертификат и работу CRM (сейчас все домены — один блок с общими SAN).

## TDD Route

Mode: `off` → decision: **skipped** (нет явного запроса strict TDD). Тестовая позиция: юнит-тесты
нормализации/валидации нового кода по конвенциям репозитория (`tests/`, vitest), затем сборка и живой
smoke-тест на сервере. Verification-first: контракт зафиксирован выше; каждый таск завершается
запуском существующих тестов и/или production build.

## Tasks

### Task 1 — CRM: приём заявок лендингов (владелец: crm-backend)

Файлы (все в `crm_client`):
- `lib/landingLeads.ts` (новый): нормализация обоих payload в один `LandingLead`, валидация
  (name≥2, email regex, message/processDescription≥10, лимиты длин как на лендингах), dedupe по externalId.
- `app/api/webhooks/landing/[token]/route.ts` (новый): `findByToken("landing", token)` → owner;
  `rateLimited(landing:<token>:<ip>, 10, 60_000)`; CORS-заголовки как в webchat (`corsJson`);
  создание contact/deal по паттерну `lib/leads.ts` (ensureStages, mkActivity, emit, notify,
  notifyTeamTelegram); источник сайта — из `config.site` интеграции («copilot» / «automatisation»).
- `scripts/seed-landing-tokens.mjs` (новый): идемпотентно создаёт/показывает `Integration` строки
  `type:"landing"`, name «Burokratie landing» (config.site="copilot") и «Automatisation landing»
  (config.site="automatisation"), `token` = случайный 32-байтовый hex; owner из аргумента/env.
- Тесты: `tests/landingLeads.test.ts` (валидация/нормализация/дедуп) по образцу существующих.
- Проверка: `npm test`, `npm run build` локально.

### Task 2 — burokratie-landing-page → контейнер copilot.firmspace.de (владелец: landing-copilot)

Файлы (`/Users/rustem/Documents/WebDevelopment/burokratie-landing-page`):
- `src/app/layout.tsx`: перед `</body>` скрипт виджета, управляемый env:
  `NEXT_PUBLIC_CRM_WIDGET_SRC` (default `https://crm.firmspace.de/widget.js`) + `NEXT_PUBLIC_CRM_WIDGET_TOKEN`
  (пусто = виджет не подключается); `data-lang="de"`, `async`.
- `next.config.ts`: `output: "standalone"`.
- `Dockerfile` (новый, по образцу CRM, node:22-bookworm-slim, standalone, `npm ci` по lock-файлу — он есть).
- `.env.example`: добавить `NEXT_PUBLIC_CRM_WIDGET_SRC/TOKEN`; `DEMO_REQUEST_WEBHOOK_URL/TOKEN` уже описаны —
  дополнить примером значения `https://crm.firmspace.de/api/webhooks/landing/<token>`.
- `README.md`: секция «Deployment (Docker)».
- Проверка: `npm test`, `npm run build` (локально), виджет-тег в собранном HTML.

### Task 3 — automatisation-landing-page → контейнер automatisation.firmspace.de (владелец: landing-automatisation)

Файлы (`/Users/rustem/Documents/WebDevelopment/automatisation-landing-page`):
- `app/layout.tsx`: скрипт виджета (те же env-переменные, что в Task 2).
- `next.config.ts`: `output: "standalone"`.
- `Dockerfile` (новый, node:22-bookworm-slim, standalone).
- `.env.example`: добавить `LEADS_API_URL` (пример `https://crm.firmspace.de/api/webhooks/landing/<token>`),
  `LEADS_API_TOKEN`, `NEXT_PUBLIC_CRM_WIDGET_SRC/TOKEN`.
- `README.md`: секция «Deployment (Docker)».
- Проверка: `npm run build` (локально), виджет-тег в собранном HTML.

### Task 4 — сервер: CRM-изменения, Caddy, контейнеры лендингов (владелец: lead)

1. Перед изменениями: `~/crm-duplicate/deploy/vps/backup.sh` (БД CRM).
2. Запушить `crm_client` в GitHub main (после Task 1 и зелёных тестов) → автодеплой пересоберёт CRM;
   проконтролировать `.crm-deployed` = новый коммит, контейнер healthy.
3. В БД CRM: `docker exec firmspace-crm node scripts/seed-landing-tokens.mjs --owner <org>` — получить два токена.
4. Caddy: переписать `deploy/vps/Caddyfile` на отдельные блоки:
   `firmspace.de, www.firmspace.de, crm.firmspace.de` → 127.0.0.1:3210; `automatisation.firmspace.de` → 127.0.0.1:3220;
   `copilot.firmspace.de` → 127.0.0.1:3230; `burokratie.firmspace.de` → handle /api/v1/* → 127.0.0.1:3250, иначе 127.0.0.1:3240.
   Обновить `SITE_DOMAINS` в `deploy/vps/.env` (без новых поддоменов в блоке CRM), `docker compose up -d caddy`.
5. rsync обоих лендингов → `/home/server/landing-copilot`, `/home/server/landing-automatisation`
   (исключить node_modules/.next/.data/.env); у каждого — `deploy/` с compose
   (проекты `landing-copilot`, `landing-automatisation`; порты 127.0.0.1:3230/3220; env:
   `NEXT_PUBLIC_SITE_URL`, webhook URL+token, виджет-токен из БД, rate-limit) → `docker compose up -d --build`.
6. Smoke: обе формы отправить тестовые заявки → в CRM появились Contact + Deal «New Lead» + Notification;
   `GET /api/webchat/<токен>` возвращает links; виджет-скрипт отдаётся с обоих доменов.

### Task 5 — сервер: burokratie-copilot пилот (владелец: lead)

1. rsync `burokratie-copilot` → `/home/server/burokratie-copilot`.
2. `infra/.env` из `.env.example`: реальные `BC_DB_PASSWORD`, `BC_ENCRYPTION_KEY` (openssl rand -base64 32),
   `BC_PUBLIC_BASE_URL=https://burokratie.firmspace.de`, `BC_COOKIE_SECURE=true`, S3-заглушки из документации
   (пилот: local-fs, если прод-гард позволяет иначе — явный флаг из application.yml), OCR выключен
   (`BC_OCR_ENABLED=false`, при необходимости `BC_ALLOW_NO_OCR=true`), лимиты JVM.
3. Кастомный override `infra/docker-compose.vps-pilot.yml`: только `postgres + api + web`;
   `web` → 127.0.0.1:3240:3000, `api` → 127.0.0.1:3250:8080, прокси-профиль **не поднимать**
   (иначе конфликт портов 80/443 с Caddy фирмы); memory limits.
4. `docker compose up -d --build`; `/actuator/health` UP; `https://burokratie.firmspace.de/` отвечает.
5. Известные ограничения пилота зафиксировать в отчёте: worker не стартует, регистрация 403 (CSRF),
   OCR/AI выключены.

### Task 6 — финальная проверка и отчёт (владелец: lead)

- Все 4 домена отвечают по HTTPS; `docker ps` — новые контейнеры healthy.
- Обе формы: заявка → карточка клиента в CRM (contact+deal), уведомление в CRM, Telegram (если настроен бот фирмы).
- Виджет на обоих лендингах открывается, кнопки подключённых мессенджеров видны.
- Отчёт: изменённые файлы, результаты тестов/сборок, действия владельца (A-записи DNS для 4 поддоменов;
  подключить Viber-бота в CRM → Настройки → Интеграции, кнопка появится в виджете автоматически).

## Risks

- **DNS**: A-записи для новых поддоменов должен добавить владелец; Caddy повторит выпуск сертификатов сам.
  Раздельные site-блоки изолируют новый домен от CRM.
- **RAM (7.8 GB)**: copilot JVM + postgres добавляют нагрузку — лимиты памяти обязательны; наблюдать `docker stats`.
- **Прод-гард copilot** может отказать в старте без полного набора секретов — разбираемся по
  `application*.yml`, не выдумываем значения; если пилотный запуск невозможен с prod-профилем,
  фиксируем блокер в отчёте, а не ослабляем продакшн-защиту молча.
- **Push в main CRM** запускает прод-автодеплой: пушить только после зелёных локальных тестов и сборки.

## Retirement

Новых дублирующих владельцев не создаём. Локальные хранилища заявок лендингов (jsonl) остаются
dev-фолбэками; таблица `leads` automatisation-лендинга сохраняется как запасной путь (retirement trigger:
после подтверждения владельца о полном переходе на CRM — отдельная миграция данных и удаление кода).
