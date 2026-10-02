#!/usr/bin/env bash
# Create an OmniRoute API key for the CRM and store it on the server.
# The key value is never printed — only whether it worked.
set -euo pipefail
cd "$HOME/omniroute"

PW="$(grep '^INITIAL_PASSWORD=' .env | cut -d= -f2-)"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

echo "1) logging into the dashboard..."
curl -s -c "$JAR" -o /dev/null -m 15 -X POST http://127.0.0.1:3111/api/auth/login \
  -H 'Content-Type: application/json' -d "{\"password\":\"${PW}\"}"
echo "   cookies: $(grep -c . "$JAR" || true)"

echo "2) creating the key..."
resp="$(curl -s -b "$JAR" -m 15 -X POST http://127.0.0.1:3111/api/keys \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://127.0.0.1:3111' \
  -d '{"name":"crm-firmspace"}')"

KEY="$(printf '%s' "$resp" | sed -n 's/.*"key"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"

if [ -z "$KEY" ]; then
  echo "   FAILED. Response (truncated, contains no key):"
  printf '%s' "$resp" | head -c 400
  echo
  exit 1
fi

umask 077
printf '%s\n' "$KEY" > "$HOME/omniroute/crm-key.txt"
chmod 600 "$HOME/omniroute/crm-key.txt"
echo "   OK: key stored at ~/omniroute/crm-key.txt (mode 600), ${#KEY} chars, value not printed."
