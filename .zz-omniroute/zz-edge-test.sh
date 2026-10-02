#!/usr/bin/env bash
# Edge cases the CRM actually sends: empty tools array, no tools key, Ukrainian prompt.
# Full bodies (not truncated) for the two models the CRM would default to.
set -uo pipefail
cd "$HOME/omniroute"
KEY="$(cat crm-key.txt)"

req() {
  local label="$1" body="$2"
  local code
  code="$(curl -s -m 90 -o "$HOME/omniroute/zz-edge-body.json" -w '%{http_code}' \
    -X POST http://127.0.0.1:3111/v1/chat/completions \
    -H "Authorization: Bearer ${KEY}" -H 'Content-Type: application/json' -d "$body")"
  echo "--- ${label}: status=${code}"
  head -c 900 "$HOME/omniroute/zz-edge-body.json"
  echo
}

req "empty tools array" '{"model":"openrouter/openai/gpt-4.1-mini","messages":[{"role":"user","content":"Say OK"}],"tools":[]}'
req "no tools key" '{"model":"openrouter/openai/gpt-4.1-mini","messages":[{"role":"user","content":"Say OK"}],"max_tokens":100}'
req "claude-sonnet-5.5 full" '{"model":"openrouter/anthropic/claude-sonnet-5.5","messages":[{"role":"user","content":"Reply with exactly: PONG"}],"max_tokens":64}'
req "ua prompt" '{"model":"openrouter/openai/gpt-4.1-mini","messages":[{"role":"user","content":"Скажи коротко: працює?"}],"max_tokens":64}'

rm -f "$HOME/omniroute/zz-edge-body.json"
