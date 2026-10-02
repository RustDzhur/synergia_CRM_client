#!/usr/bin/env bash
# Проверка боевого сайта после деплоя: health, живой маршрут ИИ, штатный редирект,
# свежесть последнего деплоя Vercel. Значения не печатаются.
set -uo pipefail
echo "=== $(date '+%H:%M:%S') ==="
echo "--- /api/health ---"
curl -s -m 20 https://www.firmspace.de/api/health | head -c 500
echo
echo "--- /api/ai без токена (ждём 401 JSON — маршрут живой) ---"
curl -s -m 20 -o /dev/null -w 'status=%{http_code}\n' https://www.firmspace.de/api/ai
echo "--- /de/c/zzz (штатный редирект middleware на /c/zzz) ---"
curl -s -m 20 -o /dev/null -w 'status=%{http_code} -> %{redirect_url}\n' https://www.firmspace.de/de/c/zzz
echo "--- последний деплой Vercel ---"
cd /Users/rustem/Documents/WebDevelopment/crm_client && vercel ls --limit 1 2>/dev/null | head -10
