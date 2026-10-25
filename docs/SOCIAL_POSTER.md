# Social Poster: автопубликация в Facebook-страницу и Instagram

Робот платформы в Робот-офисе (`lib/office/social.ts`, шаблон `p_social`, имя **Social Poster**). Раз в 8 часов
(3 раза в день) берёт следующий пост из очереди и публикует его:

1. фото + подпись на страницу Facebook (`POST /<page>/photos`, файл уходит multipart-ом);
2. дублирование в Instagram: `POST /<ig>/media` с `image_url` из `full_picture` Facebook-поста → `media_publish`.

Каждая попытка пишется в журнал робота (Робот-офис → Social Poster → Поручения) со ссылками FB и IG.
Если Instagram не принял пост, Facebook-публикация не отменяется: в журнале и в записи очереди остаётся причина.

## Где что лежит

| Что | Где |
| --- | --- |
| Публикация (Graph API) | `lib/social/publish.ts` |
| Токен и id страницы/аккаунта | `lib/social/config.ts` |
| Очередь и немецкие тексты | `lib/social/queue.ts`, таблица `social_posts` |
| Робот и рутина | `lib/office/social.ts` (создаётся при открытии офиса администратором платформы) |
| HTTP-маршрут | `app/api/social/publish/route.ts` |

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

`social_posts` — простые строки: `key` (уникальный ключ темы), `text`, `image` (путь внутри `public/`),
`status` (`queued` / `published` / `failed`), ссылки и число попыток. Пять стартовых тем заводит
`ensureSocialQueue()`; после трёх неудачных попыток тема помечается `failed` и очередь идёт дальше.
Когда все темы опубликованы, самый давний пост возвращается в очередь — робот публикует по кругу,
пока владелец не добавит новые строки.

## API

Только владелец платформы (администратор), JWT как у всех маршрутов с `Authorization: Bearer …`:

```bash
curl -X POST https://crm.firmspace.de/api/social/publish \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"text":"…немецкий текст…","image":"public/brand/avatar.png"}'
# → {"ok":true,"fbUrl":"…","igUrl":"…","fbPostId":"…","igMediaId":"…"}

curl https://crm.firmspace.de/api/social/publish -H "Authorization: Bearer $TOKEN"
# → очередь: counts и последние публикации
```

Робот вызывает `publishPost()` напрямую, без HTTP: планировщик рутин (`lib/office/routines.ts`) для шаблона
`p_social` уходит в `runSocialRoutine()`, а не в разговор с моделью.
