# Мгновенная выкладка по триггеру (вебхук GitHub)

Обычная автовыкладка опрашивает репозиторий по cron **раз в 2 минуты** (`deploy/vps/autodeploy.sh`).
Эти два юнита делают то же самое, но **сразу** — как только CI опубликовал зелёный коммит в ветку
выкладки.

## Как это работает

1. CI публикует зелёный коммит в ветку `deploy` (`.github/workflows/ci.yml`, задача `publish-deploy`).
2. GitHub шлёт вебхук `push` на `https://<домен>/api/hooks/deploy?secret=<DEPLOY_HOOK_SECRET>`.
3. Маршрут `app/api/hooks/deploy/route.ts` кладёт файл `~/deploy-request/request` — этот каталог
   смонтирован в контейнер сайта (`deploy/vps/docker-compose.yml`, том `/deploy-request`).
4. `firmspace-deploy.path` видит файл и запускает `firmspace-deploy.service` → `autodeploy.sh`
   выкладывает коммит немедленно (в журнале — строка «запуск по триггеру из вебхука»).

Если юниты не установлены или вебхук не настроен, ничего не ломается: выкладка идёт по cron как
раньше. Триггер **дополняет** cron, а не заменяет его.

## Установка (один раз, на сервере)

```bash
sudo cp ~/crm-duplicate/deploy/vps/trigger/firmspace-deploy.path /etc/systemd/system/
sudo cp ~/crm-duplicate/deploy/vps/trigger/firmspace-deploy.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now firmspace-deploy.path
systemctl status firmspace-deploy.path --no-pager
```

## Настройка вебхука в GitHub

Репозиторий → **Settings → Webhooks → Add webhook**:

| Поле | Значение |
|---|---|
| Payload URL | `https://firmspace.de/api/hooks/deploy?secret=< DEPLOY_HOOK_SECRET >` |
| Content type | `application/json` |
| Secret | тот же `DEPLOY_HOOK_SECRET` |
| Which events | **Let me select individual events** → `Pushes` и `Workflow runs` |

`DEPLOY_HOOK_SECRET` — длинная случайная строка, лежит в `deploy/vps/.env` на сервере (в git его нет).
Без этой переменной маршрут выключен и отвечает `403` — публичная ручка, которую может дёрнуть кто
угодно, хуже, чем отсутствие триггера.

## Проверка

```bash
# 1) триггер работает локально (вебхук не нужен)
touch ~/deploy-request/request
sleep 5 && tail -5 ~/crm-autodeploy.log        # ждём «запуск по триггеру из вебхука»

# 2) юнит следит за файлом
systemctl status firmspace-deploy.path --no-pager

# 3) доставка вебхука из GitHub
#    Settings → Webhooks → у вебхука → Recent Deliveries → ответ 200 и тело {"ok":true,"triggered":true}
```

## Если что-то не сработало

| Симптом | Причина и что делать |
|---|---|
| В журнале нет строки про триггер | Юнит не запущен: `sudo systemctl start firmspace-deploy.path` |
| Вебхук отвечает `403` | Не совпал секрет: в URL и в `DEPLOY_HOOK_SECRET` должна быть одна и та же строка |
| Вебхук отвечает `{"ignored":"branch main"}` | Вебхук шлёт push не по той ветке: выкладывается ветка `deploy` |
| Файл появился, выкладки нет | Смотрите `~/crm-autodeploy.log`: возможно, CI ещё не опубликовал коммит в `deploy` |
| Ничего не помогает | Cron всё равно выложит в течение 2 минут — триггер только ускоряет |
