# Реклама: Google Ads и Meta Ads

Marketing → **Ad performance**: подключение рекламного аккаунта, статистика (расход, клики, показы, конверсии, CTR, цена клика),
кампании. На Dashboard — карточка **Advertising** (30 дней). Данные только читаются: CRM ничего не меняет в кампаниях.

## Как это устроено

```
Пользователь ─Connect─▶ /api/ads/oauth ─▶ страница Google / Facebook (доступ «только чтение статистики»)
                                              │
Google ─▶ /api/mail/oauth/callback (state.p = "ads")      Facebook ─▶ /api/ads/callback
                                              ▼
              Integration { type: "ads", config.platform, config.accounts[], config.accountId, secrets (зашифрованы) }
                                              ▼
Marketing / Dashboard ─▶ /api/ads/insights?days=30 ─▶ Google Ads REST / Meta Marketing API ─▶ цифры
```

* Токены хранятся зашифрованно (как у почты), в браузер не попадают. Токен Google обновляется сам; токен Meta живёт ~60 дней —
  потом нужно нажать «Reconnect» (интерфейс покажет это).
* Если у пользователя несколько рекламных аккаунтов — он выбирает нужный в списке «Ad account».
* Раздел «Marketing» в правах фирмы: сотрудники без этого модуля рекламу не видят.

## Что нужно настроить (один раз на сайт, делает владелец платформы)

### Google Ads
1. Тот же OAuth-клиент Google, что для Gmail и Drive (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). В Google Cloud включите **Google Ads API**
   и добавьте область `https://www.googleapis.com/auth/adwords` на экране согласия. Адрес возврата тот же:
   `https://<ваш-домен>/api/mail/oauth/callback`.
2. **Developer token**: Google Ads → менеджерский аккаунт (MCC) → Tools → API Center. Пока токен в статусе «Test», он работает
   только с тестовыми аккаунтами; для реальных клиентов подайте заявку на **Basic access** (обычно несколько дней).
3. Vercel: `GOOGLE_ADS_DEVELOPER_TOKEN`. Версия API меняется раз в несколько месяцев: при ошибке «version … is deprecated/sunset»
   задайте `GOOGLE_ADS_API_VERSION` (например `v22`).

### Meta (Facebook + Instagram)
1. developers.facebook.com → создайте приложение (тип Business), добавьте продукт **Marketing API**.
2. В Facebook Login → Settings → **Valid OAuth Redirect URIs** добавьте `https://<ваш-домен>/api/ads/callback`.
3. Право `ads_read`: пока приложение в режиме Development, работает для администраторов и тестировщиков приложения;
   для чужих аккаунтов нужен **App Review** (Advanced Access к `ads_read`) и подтверждённый бизнес.
4. Vercel: `META_APP_ID`, `META_APP_SECRET` (после добавления — Redeploy).

Пока ключи не добавлены, кнопка «Connect» неактивна, а под ней написано, что платформа не настроена.

## Что проверено, а что — нет

Проверено на имитации API (24 проверки): вход и возврат, выбор аккаунта, пропуск менеджерских аккаунтов Google, заголовки
`developer-token` и `Authorization`, суммы и конверсии, статусы кампаний, подделанный `state`, изоляция фирм, права, отсутствие токенов в ответах;
интерфейс — в браузере. **Не проверено на настоящих аккаунтах** Google Ads и Meta (нужны ваши ключи и одобрение доступа).
Формат ответов взят из документации API; при первом подключении реальных аккаунтов возможны мелкие расхождения.

## Не реализовано
TikTok, LinkedIn, X (Twitter) Ads: их API требуют отдельного одобрения приложения. Карточки этих площадок на вкладке Start остаются
ручными записями. Добавить платформу — значит написать клиент по образцу `lib/ads/google.ts` и подключить его в `lib/ads/index.ts`.
