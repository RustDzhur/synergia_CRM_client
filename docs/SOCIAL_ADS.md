# Реклама в социальных сетях — второй этап (документация)

Первый этап (публикация в YouTube/TikTok) намеренно **не создаёт рекламных кампаний и не тратит
бюджет**. Этот документ фиксирует, что нужно для второго этапа: реклама TikTok, реклама YouTube через
Google Ads API и отложенная реклама Meta. Код рекламы в первом этапе не менялся.

## Коротко: что уже есть и чего нет

| Направление | Что есть в CRM | Статус доступа | Что мешает запуску |
| --- | --- | --- | --- |
| Публикация YouTube | `lib/social/youtube.ts`, карточка настроек | Google OAuth настроен, канал подключается владельцем | Нужен аудит YouTube API Services для публичных видео; квота 10 000 units/день |
| Публикация TikTok | `lib/social/tiktok.ts`, карточка настроек | **Ключей приложения нет**; нужен TikTok for Developers + review | App review, scopes `video.upload`/`video.publish`, redirect URI |
| Реклама Google/YouTube | `lib/ads/google.ts`, `lib/ads/googleWrite.ts`, Marketing → Ad performance | Developer token в окружении есть (`/api/health` → `googleAds: true`); уровень доступа нужно подтвердить | Уровень доступа проекта, brand verification, привязанный YouTube-канал, биллинг |
| Реклама TikTok | нет | не начато | Business Center, рекламный аккаунт, Marketing API app + review |
| Реклама Meta | `lib/ads/meta.ts`, `docs/FACEBOOK_ADS.md`, `docs/FACEBOOK_ADS_API.md` | **Отложено**: верификация бизнеса Meta | Business verification, затем app review и доступ к рекламному аккаунту |

## 1. TikTok Business API (Marketing API)

Это **не** Content Posting API из первого этапа. Публикация видео и управление рекламой — разные
продукты, разные scopes и часто разные приложения.

### Что нужно владельцу

1. **TikTok for Business** и **Business Center** (<https://business.tiktok.com/>):
   - Business Center создан и подтверждён;
   - рекламный аккаунт (**Advertiser Account ID**) с способом оплаты и ненулевым балансом/лимитом;
   - пользователь-владелец имеет доступ к рекламному аккаунту.
2. **Верификация бизнеса** в TikTok (Business Center → Business verification). Для рекламных API
   TikTok обычно требует подтверждённые данные компании; срок — от нескольких дней.
3. **Приложение TikTok for Developers** для Marketing API:
   - <https://developers.tiktok.com/> → Manage apps → создать приложение;
   - добавить продукт **TikTok Ads Manager / Business API** (название в кабинете меняется, суть —
     Marketing API, а не Content Posting);
   - запросить доступ к **Ads Management** и **Reporting**;
   - указать redirect URI для OAuth рекламы (например,
     `https://firmspace.de/api/ads/tiktok/callback` — адрес нужно создать на этапе реализации);
   - отправить приложение на **review**; до одобрения доступен sandbox с тестовым рекламным аккаунтом.
4. **Авторизация рекламного аккаунта**: владелец проходит OAuth, CRM получает `access_token` и
   список `advertiser_ids`, затем сохраняет выбранный Advertiser ID. Токен и `app secret` —
   только в зашифрованных настройках (`integrations` типа `ads` или `platformsettings/tiktokBusiness`).
5. Для конверсий (если нужны): **TikTok Pixel / Events API**, домен подтверждён в Business Center.

### Как устроен Marketing API (для реализации)

- Базовый адрес: `https://business-api.tiktok.com/open_api/v1.3/`.
- OAuth: redirect на `https://business-api.tiktok.com/portal/auth?app_id=…&state=…&redirect_uri=…`;
  обмен `auth_code` на токен (`/oauth2/access_token/`), обновление (`/oauth2/refresh_token/`).
- Кампании/группы/объявления: `/campaign/create/`, `/adgroup/create/`, `/ad/create/`,
  `/ad/update/`, `/campaign/update/`; отчёты: `/report/integrated/get/`.
- Все создающие вызовы должны идти в статусе **PAUSED** (или `DISABLE`) и запускаться только после
  явного подтверждения владельца — тот же принцип, что у Google Ads в `lib/ads/googleWrite.ts`.
- Ограничения: дневные лимиты запросов, задержка отчётов, обязательные поля под формат рекламы,
  проверка креативов (review) перед показом. Бюджет задаётся в валюте аккаунта; нужен защитный
  максимум на кампанию/день.
- Реклама видео: используется видео, уже опубликованное в TikTok (или Spark Ads с кодом
  авторизации автора); для Spark Ads владелец получает код в приложении TikTok. Закрытые/черновые
  видео для рекламы не подходят — сначала публикация (первый этап), потом продвижение.

### Ограничения и риски

- Review приложения и верификация бизнеса — ручные, занимают дни/недели; автоматически ускорить нельзя.
- Без одобренного Marketing API приложение не сможет создавать кампании в продакшене.
- Расходы реальные: нужна двухступенчатая проверка (создать PAUSED → подтвердить запуск), лимиты
  бюджета и журнал действий.
- TikTok может менять версии API и требования к креативам; интеграция требует сопровождения.

## 2. YouTube-реклама через Google Ads API

YouTube-реклама — это **Google Ads API**, а не YouTube Data API. Публикация видео (первый этап)
использует scope `youtube.upload`; реклама использует `https://www.googleapis.com/auth/adwords`.
Это разные разрешения, и одно не заменяет другое.

### Что нужно владельцу

1. **Google Ads аккаунт** (не просто Google-аккаунт) с биллингом и правами администратора.
   Желательно MCC (manager account) для управления клиентскими аккаунтами.
2. **Developer token / доступ к Google Ads API**. В проекте уже есть
   `GOOGLE_ADS_DEVELOPER_TOKEN` (`/api/health` → `googleAds: true`), и код `lib/ads/google.ts`
   работает с версиями v22–v26. Но доступ проверяется на уровне проекта Google Cloud:
   - **Test** — только тестовые аккаунты;
   - **Explorer** — продакшн-аккаунты, 2 880 операций/день;
   - **Basic** — продакшн, 15 000 операций/день, требуется brand verification;
   - **Standard** — без дневного лимита, ручной аудит и подтверждённый permissible use.

   С 9 сентября 2026 Google перевёл доступ с отдельных developer token на уровень проекта
   Google Cloud. Нужно открыть Google Ads API Overview в Cloud Console и убедиться, что проект
   имеет нужный уровень (Basic или Standard). Если доступ остался Test/Explorer, создание
   кампаний в реальном аккаунте может быть отклонено.
3. **Привязанный YouTube-канал**: Google Ads → Tools & Settings → Linked accounts → YouTube →
   привязать канал, на котором лежит рекламируемое видео. Без этого видео-кампания не соберётся.
4. **Видео для рекламы**: public или unlisted. **Private видео не подходит для рекламы** — это
   важно, потому что публикация по умолчанию в первом этапе как раз private. Перед продвижением
   владелец должен явно перевести ролик в public/unlisted.
5. **Конверсии и аудитории** (по необходимости): Google Ads conversion tracking, цели, аудитории,
   гео/язык; для YouTube-кампаний — YouTube-канал, тематики, ключевые слова/аудитории.
6. **Политики**: реклама проходит проверку Google Ads; запрещённые тематики, медицинские/финансовые
   утверждения и персональные данные требуют осторожности.

### Как устроена реализация (план)

- Расширить `lib/ads/types.ts`: `AdsPlatform = "google" | "meta" | "tiktok"`, добавить кампании
  типа Video.
- Google Ads API:
  - `Campaign` с `advertising_channel_type: VIDEO`, `video_budget`/`campaign_budget`;
  - `AdGroup` с `ad_group_ad` типа `VideoAd` (`video.video_id` — id из первого этапа);
  - таргетинг: гео, язык, аудитории, тематики, каналы; ставки/стратегия;
  - создание всегда `PAUSED`, затем отдельное подтверждение запуска;
  - отчёты — `GoogleAdsService.Search` (уже используется в `lib/ads/google.ts`).
- UI: Marketing → Ad performance → карточка YouTube Ads: выбрать видео из опубликованных
  (id/URL из `social_posts`/YouTube), бюджет, гео, даты; создать PAUSED; показать предпросмотр и
  кнопку «Запустить» с подтверждением.
- Ограничения Google Ads API: не все форматы YouTube доступны через API (часть — только в
  интерфейсе Google Ads); версии API регулярно снимаются с поддержки — версия задаётся
  `GOOGLE_ADS_API_VERSION`; дневные лимиты операций; модерация объявлений.

## 3. Meta (Facebook/Instagram) — отложено

Причина отсрочки — **верификация бизнеса Meta**. До неё рекламный кабинет и API не дают полноценный
доступ, а обходные пути нарушают правила Meta.

Когда верификация пройдёт, понадобится:

1. Подтверждённый бизнес в Meta Business Suite, рекламный аккаунт с оплатой.
2. Приложение Meta с доступом к рекламе (`ads_management`, `ads_read`), app review.
3. Токен пользователя/системного пользователя с доступом к рекламному аккаунту; в проекте уже есть
   `lib/ads/meta.ts` и `docs/FACEBOOK_ADS.md` / `docs/FACEBOOK_ADS_API.md`.
4. Пиксель/Conversions API, аудитории, политика конфиденциальности.
5. Только после этого — включение карточки Meta Ads в Marketing → Ad performance.

До верификации Meta ничего не включаем: существующий код остаётся, но кампании не создаются.

## 4. Общая архитектура второго этапа

Реклама не должна смешиваться с публикацией:

- **Публикация** (`lib/social`) отвечает за контент и organic-публикацию. Она не тратит деньги.
- **Реклама** (`lib/ads`) отвечает за кампании, бюджеты, отчёты и подтверждения. Она не публикует
  контент.
- Связь — по идентификатору опубликованного видео: `social_posts.youtubeVideoId` /
  `social_posts.tiktokPublishId` (для TikTok реклама обычно использует уже опубликованный пост).
- Платформенные ключи приложений (TikTok Business, Google Ads developer token) — в
  `platformsettings`/кабинете администратора, зашифрованно; клиентские рекламные аккаунты — в
  `integrations` типа `ads` с шифрованными токенами.
- Любая кампания создаётся **PAUSED**; запуск — отдельное действие с подтверждением владельца,
  журналом и лимитом бюджета. Робот не запускает рекламу сам.
- Отчётность: Google Ads `Search`, TikTok `report/integrated/get/`, Meta Insights; данные
  складываются в существующий формат `AdsInsights` (`lib/ads/types.ts`) — интерфейс не меняется.

## 5. Чек-лист перед вторым этапом

**TikTok (публикация, первый этап):**
- [ ] Приложение в TikTok for Developers создано.
- [ ] Login Kit + Content Posting API, scopes `user.info.basic`, `video.upload`, `video.publish`.
- [ ] Redirect URI ровно `https://firmspace.de/api/social/tiktok/callback`.
- [ ] Приложение отправлено на review; для тестов добавлены тестовые аккаунты.
- [ ] Client Key/Secret внесены в Настройки → Интеграции → TikTok.

**YouTube (публикация):**
- [ ] YouTube Data API v3 включён в Google Cloud.
- [ ] OAuth consent screen содержит `youtube.upload`, `youtube.readonly`.
- [ ] Redirect URI `https://firmspace.de/api/mail/oauth/callback` зарегистрирован.
- [ ] Для публичных роликов пройден аудит YouTube API Services; иначе видео останутся private.
- [ ] При необходимости запрошено увеличение квоты (стандарт — 6 загрузок/день).

**TikTok Ads:**
- [ ] Business Center и рекламный аккаунт с оплатой.
- [ ] Business verification пройдена.
- [ ] Приложение Marketing API одобрено; redirect URI для рекламы зарегистрирован.
- [ ] Advertiser ID авторизован; токены сохранены зашифрованно.
- [ ] Определены бюджет, KPI, пиксель/события и ответственный за запуск.

**Google/YouTube Ads:**
- [ ] Уровень доступа проекта — Basic или Standard, brand verification пройдена.
- [ ] Google Ads аккаунт с биллингом; YouTube-канал привязан.
- [ ] Рекламное видео в public/unlisted.
- [ ] Конверсии и аудитории настроены; бюджет/лимиты согласованы.
- [ ] Создание кампаний — только PAUSED, запуск — с подтверждением.

**Meta Ads:**
- [ ] Business verification Meta завершена.
- [ ] App review на `ads_management`/`ads_read` пройден.
- [ ] Рекламный аккаунт, пиксель, оплата готовы.

## Ссылки

- TikTok Content Posting API: <https://developers.tiktok.com/doc/content-posting-api-get-started/>
- TikTok for Business / Marketing API: <https://business-api.tiktok.com/portal/docs>
- YouTube Data API — quota: <https://developers.google.com/youtube/v3/determine_quota_cost>
- YouTube API Services — audit/quota: <https://developers.google.com/youtube/terms/developer-policies>
- Google Ads API — access levels: <https://developers.google.com/google-ads/api/docs/api-policy/access-levels>
- Google Ads API — YouTube campaigns: <https://developers.google.com/google-ads/api/docs/campaigns/video>
- Meta Marketing API: <https://developers.facebook.com/docs/marketing-apis>
