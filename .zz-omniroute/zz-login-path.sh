#!/usr/bin/env bash
# Exercise the login the same way the browser does, and report only the
# HTTP status plus the (non-secret) response body.
set -uo pipefail
cd "$HOME/omniroute"
PW="$(grep '^INITIAL_PASSWORD=' .env | cut -d= -f2-)"

run() {
  local label="$1" url="$2"; shift 2
  local resp code body
  resp="$(curl -sk --http1.1 -m 15 -w '\n%{http_code}' -X POST "$url" \
    -H 'Content-Type: application/json' \
    -d "{\"password\":\"${PW}\"}" "$@")"
  code="$(printf '%s' "$resp" | tail -n1)"
  body="$(printf '%s' "$resp" | sed '$d' | head -c 400)"
  echo "${label}: status=${code} body=${body}"
}

run "through Caddy" "https://omiroute.firmspace.eu/api/auth/login" \
  --resolve omiroute.firmspace.eu:443:127.0.0.1
run "direct to app" "http://127.0.0.1:3111/api/auth/login"
