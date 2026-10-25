# Facebook / Instagram Ads — структура и тексты (Firmspace, Германия)

Подготовлено для запуска в Ads Manager. Ничего в Meta пока не создано: это план и готовые тексты.

## 1. Рамки

- Рынок: Германия. Язык объявлений: немецкий. Аудитория B2B (малые и средние компании, налоговые бюро).
- Оффер: бесплатная процесс-анализ; пилотная фаза — первые 500 пользователей бесплатно; автоматизация в существующем ПО, без миграции.
- Запрещено в текстах: гарантии результата, «Nr. 1», проценты экономии, обещания сроков. Только факты с сайта.
- Цель кампании: заявки (Leads). События: `Lead` (отправка формы) и `Contact` (клик по телефону/почте) — после установки пикселя.

## 2. Структура

Кампания: **FS | Leads | DE | Search-Intent-Nachfrage** (objective: Leads, budget: ad set level / ABO)

| Ad set | Тема | Лендинг | Бюджет/день | Аудитория |
|---|---|---|---|---|
| AS1 | Dokumente & Rechnungen | /de/automatisierung/dokumentenverarbeitung | 6 € | Interest: DATEV, Buchhaltung, Rechnungswesen, Dokumentenmanagement |
| AS2 | CRM & Vertrieb | /de/automatisierung/crm-workflows | 6 € | Interest: CRM-Software, Vertrieb, Kundenmanagement, ERP |
| AS3 | Schnittstellen & Integration | /de/automatisierung/schnittstellen | 6 € | Interest: Schnittstellen/API, Softwareintegration, IT-Dienstleistungen, Digitalisierung |

Итого 18 €/день. В каждом ad set — 2 объявления (A/B: разный первый экран и заголовок).

Позже (волна 2): отдельная кампания **FS | Copilot | Kanzleien** (Kanzleien, DATEV) и ретаргетинг посетителей сайта 30 дней.

## 3. Аудитории

- Гео: Германия (без Австрии/Швейцарии на старте).
- Возраст: 25–65. Пол: все.
- Детализация (интересы/поведение) — по одной-две на ad set, чтобы не сузить до <200k.
- Исключения: сотрудники собственных страниц/аккаунтов; пользователи, уже отправившие заявку (позже — через Custom Audience).
- Язык: немецкий.

Ретаргетинг (волна 2, после пикселя):
1) Посетители сайта 30 дней, исключая лидов → объявление «Kostenlose Prozessanalyse».
2) Просмотр 50% видео/взаимодействия с Reels 14 дней.
3) Lookalike 1% от лидов (после 30–50 заявок).

## 4. Тексты (проверены по лимитам)

### Основной текст (primary, ≤125 символов)

1. Weniger Routine, mehr Zeit: Automatisierung in Ihren bestehenden Programmen. Kostenlose Prozessanalyse. (103)
2. Dokumente, Rechnungen und CRM-Aufgaben laufen automatisch – in der Software, die Sie schon nutzen. (98)
3. Erste 500 Nutzer testen kostenlos: Sehen Sie in einer kostenlosen Prozessanalyse, was sich automatisieren lässt. (112)
4. Systeme verbinden statt Daten kopieren: Schnittstellen und Übergaben automatisieren, ohne neues System. (103)
5. Ihr Team behält die Kontrolle: Automatisierung mit Prüfschritten, nachvollziehbar und dokumentiert. (99)

### Заголовки (≤40)

- Kostenlose Prozessanalyse (25)
- Automatisierung ohne neues System (33)
- Dokumente automatisch verarbeiten (33)
- Weniger Routine im CRM (22)
- Systeme sauber verbinden (24)
- Für Kanzleien: Belege & DATEV (29)

### Описания (≤30)

- Jetzt Prozessanalyse anfragen (29)
- Ohne neues System (17)
- Für kleine Unternehmen (22)
- Kostenlos und unverbindlich (27)
- Beratung in 20 Minuten (22)

### Связки по ad set

| Ad set | Primary | Headline | Description | Кнопка |
|---|---|---|---|---|
| AS1 Dokumente | 2 | Dokumente automatisch verarbeiten | Jetzt Prozessanalyse anfragen | Mehr erfahren |
| AS2 CRM | 1 | Weniger Routine im CRM | Kostenlos und unverbindlich | Mehr erfahren |
| AS3 Schnittstellen | 4 | Systeme sauber verbinden | Ohne neues System | Mehr erfahren |

Второе объявление в каждом ad set — тот же лендинг, другой первый экран (Primary 3/5) и другой заголовок.

## 5. Креативы

- Форматы: 1:1 (1080×1080) и 4:5 (1080×1350); для Reels/Stories — 9:16 (1080×1920).
- 3 варианта на старт: (а) скриншот схемы агентов с сайта; (б) крупный текст «Weniger Routine. Mehr Zeit.» на тёмном фоне сайта; (в) фото рабочего места/документов (нейтральное, без стоковых улыбок).
- Текст на картинке: максимум 3–5 слов, крупно, читаемо на телефоне.
- Не использовать логотипы DATEV и чужие бренды.

## 6. Настройки показа

- Плейсменты: Facebook Feed, Instagram Feed, Reels, Stories. Audience Network — выключить на старте.
- Advantage+ placements: включить, но с исключением AN.
- Оптимизация: Leads (после пикселя). До пикселя — Traffic на лендинг (как тест креативов).
- Атрибуция: 7 дней по клику, 1 день по просмотру.

## 7. Метрики и решения

- Целевой CPL: 30–60 €. CTR > 1%. Частота < 2,5 за неделю.
- Решение по ad set — после 1 000 показов или 7 дней, что раньше.
- Если CPL > 80 € два периода подряд — пауза ad set, пересборка аудитории/креатива.
- Масштабирование: +20% бюджета раз в 3 дня при стабильном CPL.

## 8. Что нужно перед запуском

1. Рекламный аккаунт в портфеле FirmSpace CRM (создаётся в Ads Manager) + способ оплаты.
2. Пиксель Meta на firmspace.de (Events Manager → Data sources → Pixel; скрипт в <head> с согласием, как у Google-тега).
3. Facebook-страница (у портфеля 0 страниц — нужна страница Firmspace).
4. События: `Lead` на успешную отправку формы, `Contact` на клик по телефону/почте.
5. Верификация бизнеса — для стабильных показов и WhatsApp.

## 9. Волна 2 и 3

- Волна 2: Copilot для Kanzleien (интересы DATEV, Steuerberatung, Kanzleisoftware), ретаргетинг посетителей, lookalike от лидов.
- Волна 3: видео-креативы (15–20 с), Advantage+ Shopping для услуг не подходит; тест Reels-хуков; расширение на Австрию/Швейцарию.

## 10. Статус на 25.10.2026

- В Meta **ничего не создано**: системный токен без `ads_management`/`ads_read`, аккаунт отвечает `(#200)`. Точный текст
  ошибки, что проверено и какое право запросить — `docs/FACEBOOK_ADS_API.md`.
- Пикселя на `firmspace.de` нет: в коде сайта и в живом HTML только Google Ads `AW-18467574110`; GTM-контейнера нет.
- Готовые payload'ы для заливки — `docs/facebook-ads/campaign-plan.json`, загрузчик — `scripts/fb-ads-upload.mjs`
  (создаёт только `PAUSED`; AS2 ждёт пиксель и Custom Audience).
- Лендинги из раздела 2 живы и отвечают `200`; Impressum на сайте пока из плейсхолдеров — до запуска заполнить.
