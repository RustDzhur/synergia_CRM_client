# Facebook / Instagram Ads: доступ к Marketing API и готовый план заливки

Проверка 25.10.2026. Рекламный аккаунт `act_4436277693` («Firmspace»), бизнес-портфель `2436697483042476`
(«Рустем Джураев»), приложение Meta `FirmSpace` (`1094471060236854`), системный пользователь `firmspace-bot`.
Связанные документы: план и тексты — `docs/FACEBOOK_ADS.md`, общий раздел про рекламу в CRM — `docs/ADS.md`.

## 1. Коротко

| Вопрос | Ответ |
|---|---|
| Доступ к Marketing API `act_4436277693` | **Нет** |
| Что создано в Meta | **Ничего**: ни кампании, ни адсета, ни объявления, ни лид-формы, ни пикселя, ни картинки |
| Причина | у системного токена нет прав `ads_management` и `ads_read` |
| Пиксель на `firmspace.de` | **Нет** (проверено по коду сайта и по живому HTML) |
| Готово к заливке | `docs/facebook-ads/campaign-plan.json` + `scripts/fb-ads-upload.mjs` (создаёт только `PAUSED`) |

Точный ответ Meta на запрос из задания:

```json
{
  "error": {
    "message": "(#200) Ad account owner has NOT grant ads_management or ads_read permission, refer to https://developers.facebook.com/docs/marketing-api/get-started/authorization/#permissions-and-features for details.",
    "type": "OAuthException",
    "code": 200,
    "fbtrace_id": "A9d-89M5Ebh6ByIIC_yPE8Q"
  }
}
```

Ошибка объектная (`OAuthException`, код `200`), а не «не тот токен»: сам токен валиден, приложение читает бизнес и страницы.
Это ответ на **любой** запрос к аккаунту — и чтение, и запись.

## 2. Что именно проверено

`debug_token`: `is_valid: true`, `type: SYSTEM_USER`, `app_id 1094471060236854`, срок не истекает.
Выданные права:

```
pages_show_list, business_management, instagram_basic, instagram_content_publish,
instagram_manage_messages, pages_read_engagement, pages_manage_metadata,
pages_manage_posts, public_profile
```

`ads_management` и `ads_read` отсутствуют — отсюда и `#200`.

| Запрос | Ответ |
|---|---|
| `GET /v23.0/act_4436277693?fields=name,account_status,currency,timezone` | `#200` — текстом выше (`fbtrace A9d-89M5Ebh6ByIIC_yPE8Q`) |
| `GET /v23.0/act_4436277693/campaigns` | `#200`, тот же текст (`fbtrace AuyPUd-paz4fvSkRL1f7GFo`) |
| `GET /v23.0/act_4436277693/adspixels` | `#200`, тот же текст (`fbtrace AoOqpUhSlQJMpPI5DJx1xx9`) |
| `POST /v23.0/act_4436277693/campaigns` (тестовая попытка, `status=PAUSED`) | `#100 / subcode 33`: «Unsupported post request. Object with ID 'act_4436277693' does not exist, cannot be loaded due to missing permissions, or does not support this operation» (`fbtrace Aw88sI_vchtxRE-lrixSmff`) |
| `GET /me/adaccounts` | `#100` Unsupported get request |
| `GET /me/assigned_ad_accounts` | `#100 / subcode 33` |
| `GET /2436697483042476/owned_ad_accounts` | `{"data": []}` |
| `GET /2436697483042476/owned_pages` | `{"data": []}` |
| `GET /2436697483042476/system_users` | `#10` — нужен `VIEW_SYSTEM_USERS` |
| `GET /1334056129793648` (страница) | `name: Firmspace`, `verification_status: not_verified` |
| `GET /17841462923280272` (Instagram) | `username: firmspace_ki_agenten`, `followers_count: 0` |
| `GET /search?type=adinterest` | **работает** — ID интересов получены (нужны для плана) |
| `GET /search?type=adlocale` | **работает** — `Deutsch = 5` |

Запись в аккаунт не выполнялась: POST-попытка отклонена правами до создания объекта, поэтому в аккаунте ничего не появилось.

## 3. Побочные находки (важны до запуска)

1. **Аккаунт не виден в портфеле.** `owned_ad_accounts` и `owned_pages` бизнеса `2436697483042476` пусты. Это либо
   отсутствие прав системного пользователя на просмотр ассетов, либо аккаунт и страница вообще не добавлены в этот портфель.
   Проверить в Business Settings → Accounts → Ad accounts / Pages.
2. **Instagram не тот, что в задаче.** У `17841462923280272` username `firmspace_ki_agenten` (не `firm.space`), 0 подписчиков.
   Для объявлений это рабочий аккаунт (он привязан к приложению), но имя стоит сверить.
3. **Страница не верифицирована** (`not_verified`) — влияет на доверие и на часть форматов.
4. **Impressum на сайте — заглушки** («[ Platzhalter – bitte ergänzen: Firmenname … ]»). Для показов в ЕС Meta требует
   `dsa_beneficiary` / `dsa_payor`, и они должны совпадать с реальным юрлицом. В плане стоят `Firmspace`, но до запуска
   Impressum надо заполнить.
5. **Лендинги из плана живые**: `https://firmspace.de/de/automatisierung/dokumentenverarbeitung`, `/crm-workflows`,
   `/schnittstellen` отдают `200` (это репозиторий сайта `firmspace-website`, не CRM).
6. **Валюта аккаунта неизвестна** (нет `ads_read`). Бюджеты в плане — в минорных единицах валюты аккаунта: `600` = 6,00
   только если `currency=EUR`. Скрипт предупреждает, если валюта другая.

## 4. Пиксель: нет

| Проверка | Результат |
|---|---|
| Код сайта (`firmspace-website`): `connect.facebook.net`, `fbq(`, `fb-pixel` | 0 совпадений |
| Живой HTML `firmspace.de/de` и трёх лендингов (`/de/automatisierung/*`) | 0 `fbq` / `connect.facebook.net` |
| Что стоит из трекинга | только Google Ads `gtag/js?id=AW-18467574110` с Consent Mode v2 |
| GTM-контейнер (куда пиксель мог быть спрятан) | отсутствует |
| `GET /act_4436277693/adspixels` | `#200` — со стороны аккаунта проверить нельзя |

Вывод: **Meta Pixel на firmspace.de не установлен**, поэтому ретаргетинг и оптимизация на конверсии сайта сейчас невозможны.

Что нужно (не создавал — нет прав, и по заданию события не заводим):
1. Events Manager → Data sources → **создать пиксель** (это действие в Business Settings, не через API).
2. Базовый код в `<head>` — **после согласия**, по той же схеме, что gtag/Consent Mode v2.
3. События: `Lead` (успешная отправка формы) и `Contact` (клик по телефону/почте).
4. Custom Audience «FS | Website visitors 30d» из `PageView` и исключение уже отправивших заявку.
5. Только после этого включается адсет AS2 (он уже описан в плане, но помечен `ready: false`).

## 5. Что нужно от владельца

1. **Доступ к аккаунту.** Business Settings → Users → System users → `firmspace-bot` → Add assets → **Ad accounts** →
   `4436277693` → *Manage campaigns* (или *Full control*). Заодно проверить, что аккаунт и страница лежат в портфеле
   `2436697483042476`.
2. **Новый токен с правами.** Тот же системный пользователь → *Generate new token* → приложение `FirmSpace` →
   отметить **`ads_management`** и **`ads_read`** (остальные текущие права можно сохранить). Старый токен после этого
   отозвать.
3. **App Review.** Для работы на аккаунтах, где приложение не является владельцем, нужен **Advanced Access** на
   `ads_management` и `ads_read` (App Review + подтверждение бизнеса). Standard Access действует только для админов,
   тестировщиков и пользователей с ролью в приложении — для боевой системы этого мало.
4. **Способ оплаты** на аккаунте (Ads Manager → Billing). Не добавлял: по заданию платежи не вводим.
5. **Impressum** на сайте — заполнить реквизиты (от них зависят DSA-поля и модерация).

## 6. Готовый план заливки

`docs/facebook-ads/campaign-plan.json` — весь план одним файлом, все объекты `status: PAUSED`:

| Объект | Что внутри |
|---|---|
| Кампания | «Firmspace — Lead Gen DE», `OUTCOME_LEADS`, `special_ad_categories: [NONE]`, бюджет на уровне адсетов |
| AS1 | DE 25–60, нем. локаль, интересы Kleinunternehmen + Selbstständigkeit (ID получены через API), 6 €/день, `LEAD_GENERATION` + Instant Form |
| AS2 | ретаргетинг посетителей 30 дней, 6 €/день, `OFFSITE_CONVERSIONS`; `ready: false` — нет пикселя и Custom Audience |
| Лид-форма | 4 поля (имя, e-mail, телефон, компания), privacy policy → `/de/datenschutz`, thank-you page |
| Креативы | 4 (по 2 на адсет), тексты и лимиты — из `docs/FACEBOOK_ADS.md`, картинка `public/brand/cover.png` |
| DSA | `dsa_beneficiary` / `dsa_payor` = `Firmspace` (уточнить по Impressum) |

Заливка: `scripts/fb-ads-upload.mjs` (Node 18+, без зависимостей). Порядок: картинка → лид-форма → кампания →
адсет AS1 → креативы → объявления. AS2 пропускается до появления пикселя.

```bash
export FB_SYSTEM_TOKEN=...        # токен с ads_management
export FB_APP_SECRET=...          # необязательно, для appsecret_proof
node scripts/fb-ads-upload.mjs --check     # только проверить доступ
node scripts/fb-ads-upload.mjs             # dry-run: печатает все запросы
node scripts/fb-ads-upload.mjs --confirm   # заливка, всё PAUSED
```

Предохранители в скрипте: отказ при любом статусе, отличном от `PAUSED`; `ready: false` пропускается; проверка
дубликата кампании по имени; при отказе в доступе — выход с текстом ошибки Meta, без частично созданных объектов.

## 7. Что не проверено

- **Сама заливка.** Ни один POST не прошёл: прав нет. Скрипт проверен только в dry-run и на предохранителе статуса.
- **Поля лид-формы.** `privacy_policy_url` против `privacy_policy: {url}` и endpoint `/<page_id>/leadgen_forms` против
  `/act_<id>/leadgen_forms` отличаются между версиями API — скрипт пробует четыре комбинации и печатает ошибки.
- **`LEAD_GENERATION` + `ON_AD`.** Это Instant Form внутри ленты, а не заявка с сайта. Альтернатива после пикселя —
  `OFFSITE_CONVERSIONS` на событие `Lead` (см. AS2).
- **Размер аудитории в Германии** — без `ads_read` не считается; интересы взяты по глобальным размерам.
- **DSA-поля** могут потребовать юридическое название, отличное от «Firmspace».

## 8. Секреты

Токен и `app secret` в репозиторий не попали: скрипт читает их из `FB_SYSTEM_TOKEN` / `FB_APP_SECRET`. Секрет приложения
передавался в чате — при желании перевыпустить его в Settings → Basic приложения `FirmSpace`.
