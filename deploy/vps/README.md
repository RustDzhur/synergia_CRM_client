# Перенос на облачный сервер (один хост: Caddy + приложение + PostgreSQL)

Данными пока никто не пользуется, поэтому переносим одним заходом: остановить старое → перенести → поднять новое → переключить DNS.

## 1. Подготовка сервера
- Ubuntu 24.04 LTS, вход по SSH-ключу, пароль отключить.
- Файрвол: открыть только 22, 80, 443 (`ufw allow 22,80,443/tcp && ufw enable`).
- Docker + Compose plugin: https://docs.docker.com/engine/install/ubuntu/
- Swap 2–4 ГБ: `fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`
  (и строка в `/etc/fstab`: `/swapfile none swap sw 0 0`).

## 2. Код и настройки
```bash
git clone https://github.com/RustDzhur/synergia_CRM_client.git && cd synergia_CRM_client/deploy/vps
cp env.example .env && chmod 600 .env && nano .env   # секреты со старого сервера
```
Версию PostgreSQL на старом сервере узнайте командой `docker exec postgres postgres --version` и впишите в `PG_VERSION`.

## 3. Перенос данных
На старом сервере остановите приложение: `docker stop firmspace-crm`.

**Основной способ — запуск на СТАРОМ сервере** (у дома нет публичного IPv4, поэтому тянуть с нового сервера ненадёжно; исходящее соединение из дома наружу работает всегда):
```bash
NEW=user@НОВЫЙ_АДРЕС ./push-to-new.sh
cd ~/synergia_CRM_client/deploy/vps && docker compose up -d --build   # на новом
```
Публичный ключ старого сервера должен быть в `~/.ssh/authorized_keys` нового.

Запасной способ — `migrate-from-old.sh` на новом сервере (работает, только если новый сервер может зайти на старый по SSH).

## 4. DNS
У регистратора: A-запись домена (и www) на IP нового сервера. **AAAA-запись старого сервера удалить**, иначе часть посетителей пойдёт на него.
Сертификат Caddy выпустит сам после того, как DNS заработает; проверка: `curl -s https://ДОМЕН/api/health`.

## 5. Крон напоминаний и автоматизаций
```
5 7 * * * curl -s -m 120 -H "Authorization: Bearer <CRON_SECRET>" http://127.0.0.1:3000/api/cron/reminders
```
Порт 3000 наружу не открыт, поэтому из crontab хоста запрос идёт так:
`docker exec firmspace-crm node -e "fetch('http://127.0.0.1:3000/api/cron/reminders',{headers:{Authorization:'Bearer <CRON_SECRET>'}}).then(r=>r.text()).then(console.log)"`

## 6. Бэкапы
Cron на `backup.sh` (строка в самом файле). Дополнительно включите снимки диска у провайдера и, лучше, внешнюю копию через `rclone` (`BACKUP_REMOTE=remote:bucket/firmspace`).

## 7. Обновление кода
```bash
git pull && ./up.sh
```
`up.sh` сначала убирает осиротевшие контейнеры (`cleanup-orphans.sh`), потом собирает и запускает. Автовыкладка делает то же самостоятельно.
(Автовыкладку из GitHub по SSH настроим следующим шагом.)

## Не перенесено (вне этого compose)
Whisper, TTS и Harness-агенты: адреса в `.env` (`TRANSCRIBE_API_URL` и др.) пока указывают на старый сервер или остаются пустыми.

## Шлюз OmniRoute/OpenRouter отключён
Из compose, Caddy и резервного копирования убран (нестабильное соединение для голоса). Чат и распознавание ходят напрямую к OpenAI (`OPENAI_API_KEY` — настоящий ключ OpenAI, `OPENAI_API_URL` не нужен); код игнорирует адреса шлюзов, оставшиеся в `.env`. Каталог `omniroute/` и контейнеры можно удалить: `docker rm -f omniroute omniroute-redis`.
