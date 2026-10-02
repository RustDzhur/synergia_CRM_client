#!/usr/bin/env bash
# Проверка публичной доступности дубликата CRM. Запускать на сервере: bash deploy/check-public.sh [домен]
set -u
DOMAIN="${1:-firmspace.de}"
PORT=3210

echo "== 1. Локально (контейнер) =="
curl -s -m 15 "http://127.0.0.1:$PORT/api/health" | head -c 200; echo

echo
echo "== 2. IPv6 сервера и AAAA домена =="
SERVER6="$(ip -6 addr show scope global | awk '/inet6 2/{print $2}' | cut -d/ -f1 | grep -v '^fd' | head -1)"
echo "  IPv6 сервера: ${SERVER6:-(нет)}"
AAAA="$(getent ahostsv6 "$DOMAIN" | awk '{print $1}' | sort -u | head -3 | tr '\n' ' ')"
echo "  AAAA $DOMAIN: ${AAAA:-(нет)}"
if [ -n "$SERVER6" ] && echo "$AAAA" | grep -q "$SERVER6"; then
    echo "  ✓ AAAA указывает на этот сервер"
else
    echo "  ! AAAA не совпадает с адресом сервера (или записи нет)"
fi

echo
echo "== 3. Ответ по IPv6 =="
curl -s -o /dev/null -w "  http  [IPv6]: %{http_code}\n" -m 15 "http://[$SERVER6]/" 2>/dev/null
curl -sk -o /dev/null -w "  https [IPv6]: %{http_code}\n" -m 15 "https://[$SERVER6]/" 2>/dev/null

echo
echo "== 4. Сертификат домена (нужен, чтобы https открывался) =="
cert="$(journalctl -u caddy --since '-2h' --no-pager 2>/dev/null | grep -c "certificate obtained successfully")"
echo "  выдач сертификата за 2 часа: $cert"
journalctl -u caddy --since '-2h' --no-pager 2>/dev/null | grep -E "obtain|challenge failed|served key" | tail -3

echo
echo "== 5. Через Caddy по имени (с самого сервера) =="
curl -s -o /dev/null -w "  https://$DOMAIN/: %{http_code}\n" -m 20 --resolve "$DOMAIN:443:[$SERVER6]" "https://$DOMAIN/" 2>/dev/null
