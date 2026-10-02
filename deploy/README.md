# Дубликат CRM на сервере

Отдельный контур того же кода: **PostgreSQL** вместо MongoDB, **локальный диск** вместо Firebase Storage.
Оригинал (ветка `main` и деплой на Vercel) не затрагивается.

## Что где лежит на сервере

- код: `~/crm-duplicate` (пользователь `server`; каталог `/opt/projects` принадлежит root)
- образ: `firmspace-crm:latest`, контейнер `firmspace-crm`
- файлы: том `crm-duplicate_crm_storage`, внутри — `/data/storage`
- база: контейнер `postgres` (сеть `infrastructure`), база `crm`, роль `crm_app`
- порт: `127.0.0.1:3210` (наружу не публикуется)

## Обновление

```bash
cd ~/crm-duplicate
tar xzf - -C ~/crm-duplicate            # или git pull
docker compose -f deploy/docker-compose.yml up -d --build
```

## Проверка

```bash
curl -s http://127.0.0.1:3210/api/health
```

С Mac — через туннель:

```bash
ssh -N -L 3210:127.0.0.1:3210 server@10.50.0.1
open http://127.0.0.1:3210
```

## Публичный адрес

Пока DNS на поддомен не указывает на `92.208.2.202`, наружу контур не выставляем.
После появления записи (например `crm.firmspace.eu` → `92.208.2.202`) добавить в `/etc/caddy/Caddyfile`:

```
crm.firmspace.eu {
    reverse_proxy 127.0.0.1:3210
}
```

и выполнить `sudo systemctl reload caddy`, а в `.env` поставить `APP_URL=https://crm.firmspace.eu`.
