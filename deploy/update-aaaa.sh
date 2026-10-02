#!/usr/bin/env bash
# Поддерживает AAAA-запись домена в актуальном состоянии: у подключений DS-Lite префикс IPv6
# может меняться при переподключении провайдера, а сайт у нас опубликован только по IPv6.
#
# Нужен токен Vercel (Account Settings → Tokens) — DNS домена обслуживает Vercel:
#   VERCEL_TOKEN=...  DOMAIN=firmspace.de  bash deploy/update-aaaa.sh [--write]
# Без --write только показывает, что не совпадает.
set -u
DOMAIN="${DOMAIN:-firmspace.de}"
WRITE=0
[ "${1:-}" = "--write" ] && WRITE=1

CURRENT="$(ip -6 addr show scope global | awk '/inet6 2/{print $2}' | cut -d/ -f1 | grep -v '^fd' | head -1)"
if [ -z "$CURRENT" ]; then echo "у сервера нет глобального IPv6 — публикация по IPv6 невозможна"; exit 1; fi

PUBLISHED="$(getent ahostsv6 "$DOMAIN" 2>/dev/null | awk '{print $1}' | grep '^2' | sort -u | head -1)"
echo "IPv6 сервера:   $CURRENT"
echo "AAAA в DNS:     ${PUBLISHED:-(нет)}"

if [ "$CURRENT" = "$PUBLISHED" ]; then echo "совпадает — делать нечего"; exit 0; fi
echo "нужно обновить AAAA на $CURRENT"
[ "$WRITE" = "1" ] || { echo "(это только проверка; для записи добавьте --write)"; exit 0; }

TOKEN="${VERCEL_TOKEN:-}"
if [ -z "$TOKEN" ]; then echo "нет VERCEL_TOKEN — обновите запись вручную в кабинете Vercel"; exit 1; fi

api() { curl -s -m 20 -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$@"; }
records="$(api "https://api.vercel.com/v4/domains/$DOMAIN/records?limit=100")"
existing="$(printf '%s' "$records" | python3 -c "
import sys, json
try: data = json.load(sys.stdin)
except Exception: sys.exit(0)
for r in data.get('records', []):
    if r.get('type') == 'AAAA': print(r.get('id'), r.get('name'))
" | head -5)"

if [ -z "$existing" ]; then
    echo "→ создаю AAAA @ и www"
    for name in "" "www"; do
        api -X POST "https://api.vercel.com/v2/domains/$DOMAIN/records" \
            -d "{\"name\":\"$name\",\"type\":\"AAAA\",\"value\":\"$CURRENT\",\"ttl\":60}" > /dev/null
    done
else
    echo "→ обновляю существующие AAAA"
    printf '%s\n' "$existing" | while read -r id name; do
        api -X PATCH "https://api.vercel.com/v1/domains/records/$id" -d "{\"value\":\"$CURRENT\"}" > /dev/null
        echo "   обновлена запись $name"
    done
fi
echo "готово"
