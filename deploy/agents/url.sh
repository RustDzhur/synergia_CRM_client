#!/bin/sh
# Ссылка для входа в Harness (веб-панель агентов) с постоянным токеном из deploy/agents/.env.
# Снаружи:  ./deploy/agents/url.sh          Локально на сервере:  ./deploy/agents/url.sh local
DIR="$(cd "$(dirname "$0")" && pwd)"
TOK="$(grep '^DSH_WEB_TOKEN=' "$DIR/.env" 2>/dev/null | cut -d= -f2-)"
[ -z "$TOK" ] && { echo "нет DSH_WEB_TOKEN в $DIR/.env" >&2; exit 1; }
if [ "$1" = "local" ]; then echo "http://127.0.0.1:3080/?token=$TOK"; else echo "https://harness.firmspace.de/?token=$TOK"; fi
