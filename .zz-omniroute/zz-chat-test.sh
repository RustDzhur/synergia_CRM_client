#!/usr/bin/env bash
# Smoke-test chat completions through OmniRoute with the CRM key:
# direct (127.0.0.1:3111) and through Caddy (public URL). Status + first bytes only.
set -uo pipefail
cd "$HOME/omniroute"
KEY="$(cat crm-key.txt)"

BODY='{"model":"MODEL","messages":[{"role":"system","content":"You are a CRM assistant. Answer briefly."},{"role":"user","content":"Hi! What is 2+2?"}],"tools":[{"type":"function","function":{"name":"get_weather","description":"Weather","parameters":{"type":"object","properties":{}}}}],"max_tokens":200}'

run() {
  local label="$1" model="$2" url="$3" extra="$4"
  local body resp code
  body="${BODY/MODEL/$model}"
  resp="$(curl -s -m 90 -w $'\n%{http_code}' -X POST "$url" \
    -H "Authorization: Bearer ${KEY}" -H 'Content-Type: application/json' \
    -d "$body" $extra)"
  code="$(printf '%s' "$resp" | tail -n1)"
  printf '%-38s status=%s body=%s\n' "$label" "$code" "$(printf '%s' "$resp" | sed '$d' | head -c 220)"
}

run "direct gpt-4.1-mini"      "openrouter/openai/gpt-4.1-mini"  "http://127.0.0.1:3111/v1/chat/completions" ""
run "direct auto/best-chat"    "auto/best-chat"                  "http://127.0.0.1:3111/v1/chat/completions" ""
run "direct claude-sonnet-5.5" "openrouter/anthropic/claude-sonnet-5.5" "http://127.0.0.1:3111/v1/chat/completions" ""
run "caddy gpt-4.1-mini"       "openrouter/openai/gpt-4.1-mini"  "https://omiroute.firmspace.eu/v1/chat/completions" "--http1.1 --resolve omiroute.firmspace.eu:443:127.0.0.1"
