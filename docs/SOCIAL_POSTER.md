# Social Poster: автопубликация в Facebook, Instagram, YouTube и TikTok

Робот платформы в Робот-офисе (`lib/office/social.ts`, шаблон `p_social`, имя **Social Poster**). Раз в 8 часов
(3 раза в день) берёт следующий пост из очереди и публикует его:

1. фото + подпись на страницу Facebook (`POST /<page>/photos`, файл уходит multipart-ом);
2. дублирование в Instagram: `POST /<ig>/media` с `image_url` из `full_picture` Facebook-поста → `media_publish`;
3. **видео** — в YouTube (resumable `videos.insert`) и TikTok (Content Posting API).

Список целей задаётся у поста (`targets`): `facebook`, `instagram`, `youtube`, `tiktok`. Картинка
по умолчанию идёт в Facebook + Instagram, видео — в YouTube + TikTok. Подробности, квоты и настройка
провайдеров — [SOCIAL_PUBLISHING.md](./SOCIAL_PUBLISHING.md).

Каждая попытка пишется в журнал робота (Робот-офис → Social Poster → Поручения) со ссылками площадок.
Если одна площадка не приняла пост, остальные публикации не отменяются: в журнале и в записи очереди
остаётся причина (`errors`), а пост считается вышедшим, если хотя бы одна цель ответила успехом.

## Где что лежит

| Что | Где |
| --- | --- |
| Цели, тип медиа, приватность | `lib/social/types.ts` |
| Публикация (Graph API, YouTube, TikTok) | `lib/social/publish.ts` |
| YouTube Data API | `lib/social/youtube.ts` |
| TikTok Content Posting API | `lib/social/tiktok.ts` |
| Токены и id страницы/аккаунта | `lib/social/config.ts`, `platformsettings/{social,youtube,tiktok}` |
| Очередь и немецкие тексты | `lib/social/queue.ts`, таблица `social_posts` |
| Робот и рутина | `lib/office/social.ts` (создаётся при открытии офиса администратором платформы) |
| HTTP-маршрут | `app/api/social/publish/route.ts` |
| Настройки и тест | `app/api/social/settings`, `app/api/social/test`, `components/crm/Settings/SocialPublishCard.tsx` |

## Токен

Токен страницы **не хранится в коде**. Порядок чтения (`lib/social/config.ts`):

1. `platformsettings`, ключ `social`: значение `{"pageId":"…","igUserId":"…"}`, секрет `{"pageToken":"…"}` (AES-256-GCM);
2. подключённый канал Messenger этой же страницы (`integrations.secrets.pageAccessToken`) — запасной путь;
3. переменные `SOCIAL_PAGE_TOKEN` / `SOCIAL_PAGE_ID` / `SOCIAL_IG_USER_ID` — только для локальной проверки.

Токен должен иметь права `pages_manage_posts` и `instagram_content_publish` (токен одного Messenger-а недостаточно).
Обновить его можно скриптом (токен приходит по stdin и в git не попадает):

```bash
cat page-token.txt | docker exec -i -w /app firmspace-crm node /app/scripts/social-seed.mjs
```

## Очередь

`social_posts` — строки поста: `key` (уникальный ключ темы), `text`, `image` (картинка внутри
`public/`), `mediaType` (`image` / `video`), `video` (путь к видео внутри `public/`), `targets`
(список площадок), `title`, `tags`, `privacyStatus`, `status` (`queued` / `published` / `failed`),
ссылки и число попыток. Пять стартовых тем заводит `ensureSocialQueue()`; после трёх неудачных
попыток тема помечается `failed` и очередь идёт дальше. Когда все темы опубликованы, самый давний
пост возвращается в очередь — робот публикует по кругу, пока владелец не добавит новые строки.

Видео-пост: `mediaType = 'video'`, `video = 'public/social/launch.mp4'`,
`targets = ARRAY['youtube','tiktok']`, `privacyStatus = 'private'` (по умолчанию). Пример SQL —
в [SOCIAL_PUBLISHING.md](./SOCIAL_PUBLISHING.md#очередь).

## API

Только владелец платформы (администратор), JWT как у всех маршрутов с `Authorization: Bearer …`:

```bash
curl -X POST https://crm.firmspace.de/api/social/publish \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"text":"…немецкий текст…","image":"public/brand/avatar.png"}'
# → {"ok":true,"fbUrl":"…","igUrl":"…","fbPostId":"…","igMediaId":"…"}

curl -X POST https://crm.firmspace.de/api/social/publish \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"text":"…","mediaType":"video","video":"public/social/launch.mp4",
       "targets":["youtube","tiktok"],"privacyStatus":"unlisted"}'
# → {"ok":true,"youtubeUrl":"…","tiktokPublishId":"…","errors":{…}}

curl https://crm.firmspace.de/api/social/publish -H "Authorization: Bearer $TOKEN"
# → очередь: counts и последние публикации
```

Робот вызывает `publishPost()` напрямую, без HTTP: планировщик рутин (`lib/office/routines.ts`) для шаблона
`p_social` уходит в `runSocialRoutine()`, а не в разговор с моделью.

Настройки площадок и безопасный тест — Настройки → Интеграции → карточки **YouTube** и **TikTok**:
`GET/PUT /api/social/settings`, `POST /api/social/test`. Тест YouTube всегда private/unlisted,
тест TikTok — черновик (inbox); без токенов возвращается mock, ничего не загружается.
