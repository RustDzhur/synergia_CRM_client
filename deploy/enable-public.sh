#!/usr/bin/env bash
# Включает публичный адрес дубликата CRM: добавляет сайт в Caddy и переводит APP_URL на https.
# Запускать на сервере с sudo (правка /etc/caddy/Caddyfile требует root):
#
#   sudo ~/crm-duplicate/deploy/enable-public.sh crm.firmspace.eu
#
# Перед запуском убедитесь, что A-запись этого имени указывает на публичный IP сервера
# (92.208.2.202): иначе Caddy не сможет получить сертификат Let's Encrypt.
set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
    echo "Укажите домен: $0 crm.example.com" >&2
    exit 1
fi

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CADDYFILE=/etc/caddy/Caddyfile
BACKUP="/etc/caddy/Caddyfile.bak-$(date +%Y%m%d-%H%M%S)"
PORT=3210

echo "→ проверяю, что $DOMAIN указывает на этот сервер"
RESOLVED="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)"
PUBLIC_IP="$(curl -s -m 8 https://api.ipify.org || true)"
if [[ -n "$RESOLVED" && -n "$PUBLIC_IP" && "$RESOLVED" != "$PUBLIC_IP" ]]; then
    echo "  ВНИМАНИЕ: $DOMAIN резолвится в $RESOLVED, а публичный IP сервера $PUBLIC_IP" >&2
fi
[[ -z "$RESOLVED" ]] && echo "  ВНИМАНИЕ: $DOMAIN пока не резолвится — сертификат не выпустится, пока не появится A-запись" >&2

cp "$CADDYFILE" "$BACKUP"
echo "→ резервная копия Caddyfile: $BACKUP"

if grep -qE "^${DOMAIN//./\\.}[ ,{]" "$CADDYFILE"; then
    echo "→ блок для $DOMAIN уже есть, обновляю тело"
    python3 - "$CADDYFILE" "$DOMAIN" "$PORT" <<'PY'
import re, sys
path, domain, port = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(path, encoding="utf-8").read()
block = f"{domain} {{\n\treverse_proxy 127.0.0.1:{port}\n}}\n"
pattern = re.compile(r"^" + re.escape(domain) + r"\s*\{[^}]*\}\s*", re.M)
text = pattern.sub(block, text, count=1) if pattern.search(text) else text + "\n" + block
open(path, "w", encoding="utf-8").write(text)
PY
else
    printf '\n%s {\n\treverse_proxy 127.0.0.1:%s\n}\n' "$DOMAIN" "$PORT" >> "$CADDYFILE"
fi

echo "→ проверяю конфигурацию Caddy"
caddy validate --config "$CADDYFILE" --adapter caddyfile

echo "→ перезагружаю Caddy"
systemctl reload caddy

echo "→ ставлю APP_URL=https://$DOMAIN в $APP_DIR/deploy/.env"
if grep -q '^APP_URL=' "$APP_DIR/deploy/.env"; then
    sed -i "s|^APP_URL=.*|APP_URL=https://$DOMAIN|" "$APP_DIR/deploy/.env"
else
    echo "APP_URL=https://$DOMAIN" >> "$APP_DIR/deploy/.env"
fi

echo "→ перезапускаю контейнер"
sudo -u "$(stat -c %U "$APP_DIR")" docker compose -f "$APP_DIR/deploy/docker-compose.yml" up -d

echo
echo "Готово. Проверьте: curl -s https://$DOMAIN/api/health"
