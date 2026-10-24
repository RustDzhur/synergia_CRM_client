# План: единый большой сайт firmspace-website (firmspace.de)

Дата: 2026-10-23. Спека: `docs/aegis/specs/2026-10-23-firmspace-website.md` (утверждена владельцем).

## Goal / Architecture / Tech Stack

Собрать новый сайт в отдельном репозитории и выкатить на firmspace.de; платформы остаются за
поддоменами со входом вместо маркетинга; старые лендинги удаляются с сервера.

- Стек сайта: Next.js 15 App Router + TS, next-intl (de/en), Tailwind (дизайн-система
  automatisation-landing-page), output standalone, Dockerfile node:22-bookworm-slim.
- Репозиторий: приватный GitHub `RustDzhur/firmspace-website` (создаётся лидом), локальная копия в
  `/Users/rustem/Documents/WebDevelopment/firmspace-website` (база — копия automatisation-landing-page).
- Деплой: `~/firmspace-website` на сервере, compose-проект `firmspace-website`, контейнер
  `127.0.0.1:3260→3000`, env в `deploy/.env` (0600).
- Caddy: firmspace.de/www → 3260; crm.firmspace.de → 3210; burokratie.firmspace.de → 3240;
  automatisation.firmspace.de → 301 /automatisierung; copilot.firmspace.de → 301 /buerokratie-copilot.
- Формы: POST `https://crm.firmspace.de/api/webhooks/landing/<token>` + Bearer (контракт
  lib/landingLeads.ts); токены создаются в CRM владельца («Формы с сайтов»: website-contact,
  website-copilot-demo). Виджет: `<script src="https://crm.firmspace.de/widget.js" data-token=…>`.

## Compatibility Boundary

- Приложение CRM и платформа Copilot функционально не меняются; в CRM добавляется только
  редирект маркетинговых путей на вход при host `crm.firmspace.de` (обратимо).
- Старые домены лендингов остаются 301 (контейнеры удаляются).
- Локальные репо лендингов не удаляются (источник контента; копии — в новом сайте).

## TDD Route

Mode: off → decision: skipped. Позиция: переносим существующие юнит-тесты лендингов (ROI-калькулятор,
валидация форм) в новый репо; новый код покрывается там же; финальная проверка — build + smoke на сервере.

## Tasks

### Task 1 — каркас репозитория и деплой-обвязка (лид, до остальных)
1. `gh repo create firmspace-website --private` (или по инструкции владельца), локальный клон.
2. База: скопировать automatisation-landing-page (без node_modules/.next), почистить от
   db/scripts/task.md, обновить package.json name.
3. next-intl de/en: `messages/de.json`, `messages/en.json`, `i18n.ts`, middleware-локали;
   layout с переключателем языка; SEO-metadata (canonical, OG, sitemap, robots).
4. Шапка/подвал нового сайта (навигация по новой карте), cookie-consent, CSP (виджет-хост
   условно по токену), CrmWidget, Dockerfile (ARG/ENV NEXT_PUBLIC_*, standalone), deploy/docker-compose.yml
   + deploy/.env.example.
5. Локально: `npm run build` зелёный на заглушках страниц.
6. Сервер: `~/firmspace-website` (rsync), `deploy/.env` (сайт-URL, виджет-токен, webhook-токены
   после их создания в CRM), `docker compose up -d --build` → healthy на 127.0.0.1:3260
   (Caddy пока не переключаем — сайт виден по IP-порту для проверки).

### Task 2 — главная + направления + контакт + legal (тиммейт site-pages-1, после Task 1)
Страницы (de/en, контент — вырезка из automatisation-landing-page + CRM site):
- `/` (hero «интеграции в ваше ПО», 4 направления, продукты-опции, how-it-works, benefits,
  ROI-калькулятор, FAQ, CTA);
- `/automatisierung/{dokumentenverarbeitung,crm-workflows,schnittstellen,ki-verarbeitung}`;
- `/kontakt` (форма → webhook, токен из env NEXT_PUBLIC-независимого server-переменной
  `CRM_WEBHOOK_URL`/`CRM_WEBHOOK_TOKEN`, валидация/honeypot/rate-limit как в automatisation);
- `/impressum`, `/datenschutz`, `/agb`, `/cookies` (тексты из CRM site).
Проверка: `npm run build`; перенесённые юнит-тесты (ROI, форма) зелёные.

### Task 3 — продукты + über-uns + блог (тиммейт site-pages-2, после Task 1)
- `/buerokratie-copilot` — полная вырезка из burokratie-landing-page (workflow, DATEV, проблемы,
  security, ROI, FAQ, demo-форма → webhook website-copilot-demo);
- `/firmspace-crm` — фичи/тарифы→CTA из CRM site;
- `/ueber-uns`, `/blog` (+ перенос статей блога из CRM content/, de/en).
Проверка: `npm run build`; тесты ROI/форм.

### Task 4 — CRM: вход вместо маркетинга на crm.firmspace.de (тиммейт crm-backend, параллельно)
В crm_client: на host `crm.firmspace.de` маркетинговые пути (`/`, `/features`, `/about`, `/blog`,
`/contacts`, …) редиректят на `/login` (или страницу входа); `/crm/*`, `/api/*`, `/login*` — без
изменений; host firmspace.de/www теперь не обслуживается CRM (маршрут уходит сайту, но код в CRM
остаётся до фазы 2). Реализация — middleware.ts или редирект-функция в корневой странице; покрыть
тестом. Проверка: tsc, build, CI-зелёный, push → автодеплой.

### Task 5 — переключение и вывод из эксплуатации (лид)
1. Токены форм в CRM владельца (карточка «Формы с сайтов»: website-contact, website-copilot-demo)
   → вписать в deploy/.env сайта, recreate контейнера.
2. Caddyfile (в CRM-репо, чтобы автодеплой не затёр): firmspace.de/www → 3260, 301 для старых
   доменов; на сервере: git pull (или после push Task 4), `docker compose up -d --force-recreate caddy`.
3. Smoke: все домены HTTPS 200/301; заявка с /kontakt → карточка в CRM владельца (тест → удаление
   тестовых строк); виджет грузится; вход CRM по crm.firmspace.de/.
4. Удаление лендингов: `docker compose down` (в deploy/ обоих лендингов), `docker rmi` образов,
   удаление `~/landing-copilot`, `~/landing-automatisation`.
5. Отчёт владельцу: файлы, проверки, что осталось (фаза 2 удаления маркетинга CRM, контент блога
   в переводе).

## Verification
- build сайта и CRM зелёные; CI CRM зелёный.
- Таблица доменов из спеки §5 проверена curl'ами; формы прошли сквозной тест (данные удалены).
- `docker ps` без landing-*; каталоги лендингов на сервере отсутствуют.

## Risks
- Переключение firmspace.de в проде — точечное, откат через git-историю Caddyfile.
- Контент-объём (3 источника × 2 языка) — переносим как есть, без переписывания; en для новых
  страниц — из en-версий CRM site, остальное помечается как черновик-перевод.
- Блог CRM — перенос слагов de/en; 301 со старых /blog-путей CRM не настраиваем (фаза 2).

## Retirement
Лендинги: удалены с сервера (Task 5.4), домены — 301. Маркетинг CRM: фаза 1 — редирект (Task 4),
фаза 2 — удаление components/website и маркетинговых роутов отдельным PR (триггер: 1 неделя
стабильной работы нового сайта).
