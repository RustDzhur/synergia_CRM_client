#!/usr/bin/env bash
# Retest the login with browser-like headers and surface any Caddy 4xx/5xx.
set -uo pipefail
cd "$HOME/omniroute"
PW="$(grep '^INITIAL_PASSWORD=' .env | cut -d= -f2-)"

echo "=== caddy 4xx/5xx in the last 20 min ==="
journalctl -u caddy --since "20 minutes ago" --no-pager 2>/dev/null \
  | grep -E '"status":(4|5)[0-9][0-9]' | tail -8
echo "(none above means Caddy logged no failed requests)"

echo "=== login with browser-like headers ==="
resp="$(curl -sk --http1.1 --resolve omiroute.firmspace.eu:443:127.0.0.1 -m 15 -w '\n%{http_code}' \
  -X POST https://omiroute.firmspace.eu/api/auth/login \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://omiroute.firmspace.eu' \
  -H 'Referer: https://omiroute.firmspace.eu/login' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' \
  -d "{\"password\":\"${PW}\"}")"
echo "status=$(printf '%s' "$resp" | tail -n1)"
echo "body=$(printf '%s' "$resp" | sed '$d' | head -c 300)"
