# Публикация в YouTube и TikTok (первый этап)

Платформа Firmspace публикует контент в четыре цели: **Facebook**, **Instagram**, **YouTube**, **TikTok**.
Facebook/Instagram работают как раньше (картинка + подпись), YouTube/TikTok принимают видео.
Очередь у всех одна — таблица `social_posts`, робот **Social Poster** (`lib/office/social.ts`) берёт
следующий пост и вызывает `publishPost()` (`lib/social/publish.ts`) без HTTP.

## Что где лежит

| Что | Где |
| --- | --- |
| Цели, типы медиа, приватность, метки | `lib/social/types.ts` |
| Токены и настройки платформы | `lib/social/config.ts` → `platformsettings` |
| Facebook + Instagram + оркестрация целей | `lib/social/publish.ts` |
| YouTube Data API (resumable upload) | `lib/social/youtube.ts` |
| TikTok Content Posting API + OAuth PKCE | `lib/social/tiktok.ts` |
| Очередь и тексты | `lib/social/queue.ts`, таблица `social_posts` |
| Робот Social Poster | `lib/office/social.ts` |
| HTTP-публикация | `app/api/social/publish/route.ts` |
| Настройки/статус/тест | `app/api/social/settings`, `app/api/social/test` |
| OAuth YouTube | `app/api/social/oauth/youtube`, колбэк `/api/mail/oauth/callback?…` |
| OAuth TikTok | `app/api/social/oauth/tiktok`, колбэк `/api/social/tiktok/callback` |
| Карточки в интерфейсе | `components/crm/Settings/SocialPublishCard.tsx` |

## Где хранятся токены

Все секреты лежат в `platformsettings` и шифруются AES-256-GCM (`lib/crypto.ts`, ключ
`ENCRYPTION_KEY` или `JWT_SECRET`). В коде и в git токенов нет.

| Ключ | `value` (не секрет) | `secrets` (шифр) |
| --- | --- | --- |
| `social` | `{ pageId, igUserId }` | `{ pageToken }` (или токен канала Messenger) |
| `youtube` | `{ channelId, channelTitle, connectedAt, scope, status, error }` | `{ accessToken, refreshToken, expiresAt, scope }` |
| `tiktok` | `{ clientKey, redirectUri, scopes, mode, openId, displayName, connectedAt, scope, status, error }` | `{ clientSecret, accessToken, refreshToken, expiresAt, refreshExpiresAt, scope }` |

`status` = `connected` или `error`; `error` показывается в карточке настроек. Access-токены обновляются
по refresh-токену автоматически; если провайдер отозвал доступ, карточка просит подключиться заново.

## YouTube

### Что уже есть

YouTube использует **тот же Google OAuth-клиент**, что почта, Drive и Google Ads:
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` из кабинета администратора (или окружения).
Новый redirect URI добавлять **не нужно**: используется уже зарегистрированный
`https://firmspace.de/api/mail/oauth/callback`. Меняется только набор scopes:

```
https://www.googleapis.com/auth/youtube.upload
https://www.googleapis.com/auth/youtube.readonly
```

`youtube.upload` — загрузка (`videos.insert`), `youtube.readonly` — `channels.list?mine=true`,
чтобы показать канал и проверить, что токен действительно имеет доступ.

### Что включить в Google Cloud

1. В проекте, где создан OAuth-клиент, включить **YouTube Data API v3**
   (APIs & Services → Library → YouTube Data API v3 → Enable). Пока API выключен, загрузка отвечает
   `accessNotConfigured`.
2. В OAuth consent screen добавить scopes `youtube.upload` и `youtube.readonly`. Если приложение
   в статусе Testing — добавить Google-аккаунт владельца в Test users.
3. Убедиться, что redirect URI `https://firmspace.de/api/mail/oauth/callback` есть в
   Authorized redirect URIs (он там с момента подключения почты).
4. Для публичных роликов может понадобиться верификация приложения (sensitive scopes). Пока
   приложение не прошло аудит YouTube API Services, **все видео, загруженные через API, принудительно
   остаются private**, даже если запросить unlisted. Код возвращает фактический `privacyStatus`
   из ответа YouTube, поэтому интерфейс не врёт.

### Квота

| Операция | Units |
| --- | --- |
| `videos.insert` (одно видео) | **1600** |
| `channels.list` / `videos.list` | 1 |
| Стандартная дневная квота проекта | **10 000** |
| Видео в день при стандартной квоте | **≈ 6** |

- Квота выделяется на **проект Google Cloud**, а не на канал; другие вызовы YouTube Data API
  (например, из скриптов) тратят её же.
- Исчерпание — HTTP 403 с `reason: quotaExceeded/dailyLimitExceeded`; повторять бессмысленно,
  сброс в полночь по **Pacific Time** (America/Los_Angeles).
- Увеличение лимита — только заявка в YouTube API Services (YouTube API Services → Audit and Quota
  Extension). Рассматривается вручную, автоматического «докупить» квоту нельзя.
- Тестовая загрузка тоже стоит 1600 units и остаётся на канале: удалять её нужно вручную в YouTube Studio.

### Ограничения загрузки

- Максимум файла в коде — **512 МБ** (файл читается в память сервера; это ограничение приложения,
  не YouTube). Форматы: `.mp4`, `.mov`, `.m4v`, `.webm`.
- Ограничения YouTube: до 15 минут для неверифицированного канала, до 256 ГБ/12 часов для
  верифицированного; лимит загрузок в сутки на канал. Ошибки `uploadLimitExceeded` /
  `youtubeSignupRequired` показываются человеку как есть.
- `privacyStatus` по умолчанию **private**. `unlisted` разрешён, `public` — только если в запросе
  явно `confirmPublic: true`. Без подтверждения `public` отклоняется, а не тихо понижается.

### Как подключить

Настройки → Интеграции → карточка **YouTube** → «Подключить YouTube» → согласие Google → возврат
в настройки. В карточке появятся канал, квота, redirect URI и кнопка «Опубликовать тест».

Тестовая загрузка идёт с `privacyStatus=private` (или `unlisted` по выбору в интерфейсе) и никогда
не публикует public.

## TikTok

### Что создать владельцу в TikTok for Developers

1. **Приложение** на <https://developers.tiktok.com/> (Manage apps → Create app).
2. Продукты: **Login Kit** и **Content Posting API**.
3. Scopes: `user.info.basic`, `video.upload`, `video.publish`. Если `video.publish` ещё не одобрен,
   можно оставить `user.info.basic,video.upload` — тогда работает только режим inbox.
4. **Redirect URI** — ровно этот адрес, без завершающей косой черты:

   ```
   https://firmspace.de/api/social/tiktok/callback
   ```

5. Заполнить описание приложения, политику конфиденциальности и отправить на **review**.
   До одобрения доступны sandbox/тестовые аккаунты и, как правило, только приватные публикации
   (`SELF_ONLY`) или черновики. Это ограничение TikTok, а не CRM.

После review владелец вставляет **Client Key** и **Client Secret** в карточке TikTok
(Настройки → Интеграции → TikTok → «Сохранить ключи»). Они попадают в `platformsettings/tiktok`
в зашифрованном виде. Переменные окружения `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`,
`TIKTOK_REDIRECT_URI`, `TIKTOK_SCOPES` — только запасной путь для локальной проверки, база важнее.

### OAuth 2.0 + PKCE

- Авторизация: `https://www.tiktok.com/v2/auth/authorize/` с `code_challenge` (S256).
- `code_verifier` хранится в httpOnly-cookie `tiktok_pkce` (10 минут), в `state` его нет.
  Cookie ставится с `Domain=.firmspace.de`, потому что настройки открыты на `crm.firmspace.de`,
  а TikTok возвращает на `firmspace.de`.
- Обмен кода: `POST https://open.tiktokapis.com/v2/oauth/token/` (`client_key`, `client_secret`,
  `code`, `grant_type=authorization_code`, `redirect_uri`, `code_verifier`).
- Refresh: тот же endpoint с `grant_type=refresh_token`; refresh-токен TikTok вращается и живёт
  около года.

### Два режима Content Posting API

| Режим | Endpoint | Scope | Что происходит |
| --- | --- | --- | --- |
| `inbox` (по умолчанию) | `/v2/post/publish/inbox/video/init/` | `video.upload` | Видео попадает в черновики автора; человек дописывает и публикует в приложении TikTok |
| `direct` | `/v2/post/publish/video/init/` | `video.publish` | Публикация сразу; приватность по умолчанию `SELF_ONLY` |

`PUBLIC_TO_EVERYONE` отправляется только если в запросе `privacyStatus=public` **и**
`confirmPublic=true`, и только когда приложение прошло review (иначе TikTok отклонит). Для
непубличной прямой публикации используется `SELF_ONLY`. TikTok не поддерживает «unlisted»:
всё, что не public, уходит как `SELF_ONLY`.

### Загрузка файла

- `FILE_UPLOAD`: init возвращает `upload_url` (живёт **1 час**) и `publish_id`, файл уходит
  последовательными PUT с `Content-Range`.
- Правила TikTok: не-последний кусок **5–64 МБ**, последний — до 128 МБ, до 1000 кусков.
  `total_chunk_count = floor(video_size / chunk_size)`; округление вверх даёт лишний кусок и
  HTTP 416. Раскладка вынесена в `tiktokChunkPlan()` и покрыта тестами.
- Ограничения TikTok: до **4 ГБ** и 10 минут; ограничение приложения — 512 МБ (память сервера).
- `publish_id` и статус (`processing`, `uploaded_bytes`, публичный id) сохраняются в очереди;
  финальная обработка у TikTok асинхронная и может занять минуты.

### Как подключить

Настройки → Интеграции → карточка **TikTok** → сохранить Client Key/Secret (если ещё не сохранены) →
«Подключить TikTok» → согласие TikTok → возврат в настройки. Затем можно выбрать режим
(inbox/direct) и нажать «Опубликовать тест» (тест всегда inbox, ничего публичного).

## Публикация через API и очередь

### HTTP

```bash
# Картинка в Facebook + Instagram (как раньше)
curl -X POST https://firmspace.de/api/social/publish \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"text":"…немецкий текст…","image":"public/brand/avatar.png"}'

# Видео в YouTube + TikTok, приватно
curl -X POST https://firmspace.de/api/social/publish \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"text":"…описание…","mediaType":"video","video":"public/social/launch.mp4",
       "targets":["youtube","tiktok"],"title":"Firmspace im Alltag",
       "tags":["CRM","KMU"],"privacyStatus":"unlisted"}'

# Только YouTube, public — лишь с явным подтверждением
curl -X POST https://firmspace.de/api/social/publish \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"text":"…","mediaType":"video","video":"public/social/launch.mp4",
       "targets":["youtube"],"privacyStatus":"public","confirmPublic":true}'
```

Ответ содержит `errors` по отдельным целям. Если хотя бы одна цель ответила успехом, HTTP 200,
а причина отказа другой цели лежит в `errors`. Если не вышло никуда — 502 с общей причиной.
Instagram по-прежнему зависит от Facebook: картинку для `image_url` даёт Facebook-пост.

### Очередь

`social_posts` поддерживает видео и список целей:

| Поле | Значение |
| --- | --- |
| `mediaType` | `image` или `video` |
| `image` | путь к картинке внутри `public/` |
| `video` | путь к видео внутри `public/` |
| `targets` | `["facebook","instagram"]`, `["youtube","tiktok"]` или свой список |
| `title` | заголовок YouTube/TikTok; пусто — первая строка `text` |
| `tags` | метки YouTube; пусто — хештеги из `text` |
| `privacyStatus` | `private` (по умолчанию), `unlisted`, `public` (для public нужно подтверждение; в роботе лучше не использовать) |

Пример добавления видео-поста:

```sql
INSERT INTO social_posts (id, key, text, "mediaType", video, targets, title, "privacyStatus", status, attempts, image, tags, "createdAt", "updatedAt")
VALUES ('post_video_1', 'video-launch', 'Firmspace im Alltag …', 'video', 'public/social/launch.mp4',
        ARRAY['youtube','tiktok'], 'Firmspace im Alltag', 'private', 'queued', 0, '', ARRAY[]::text[], now(), now());
```

Положить файл: `public/social/launch.mp4` (в контейнере каталог `public/` копируется из репозитория).
Робот публикует такой пост так же, как картинку: раз в 8 часов, с записью ссылок в журнал.

## Тест без токенов (mock)

`POST /api/social/test { platform: "youtube"|"tiktok" }`:

- **нет ключей/подключения** → `{ ok: true, mock: true, message: "…" }`; во внешние сервисы ничего
  не отправляется;
- **есть подключение** → YouTube загружает видео как private/unlisted, TikTok — в inbox (черновик).
  Тест не публикует public и не требует `confirmPublic`.

Тестовое видео по умолчанию — `public/social/test.mp4`; путь можно изменить в карточке.
Для теста нужен настоящий файл: без него ответ будет «Video not found».

## Диагностика

| Симптом | Причина / что делать |
| --- | --- |
| `redirect_uri_mismatch` у Google | В Google Cloud нет `https://firmspace.de/api/mail/oauth/callback` |
| `accessNotConfigured` у YouTube | В проекте не включён YouTube Data API v3 |
| `quotaExceeded` | Исчерпаны 10 000 units; ждать Pacific midnight или просить увеличение квоты |
| YouTube отвечает `private`, хотя просили `unlisted` | Проект не прошёл аудит YouTube API Services |
| TikTok `scope_not_authorized` / `scope_permission_missed` | Приложение не одобрено или пользователь не дал scope; проверить review и scopes |
| TikTok `invalid_grant` | Код авторизации истёк/повторно использован — начать подключение заново |
| TikTok 416 при загрузке | Неверная раскладка кусков/`Content-Range`; проверить `tiktokChunkPlan` |
| `upload_url has expired` (403) | Прошёл час с init; повторить публикацию (init заново) |
| `Video not found` | Файла нет в `public/` или путь вне `public/` |
| `/api/health` показывает `socialPublishing.tiktokConfigured: false` | Не сохранены Client Key/Secret |

## Реклама

Второй этап (продвижение постов и видео) описан отдельно: [SOCIAL_ADS.md](./SOCIAL_ADS.md).
Первый этап намеренно не создаёт рекламных кампаний и не тратит бюджет.
