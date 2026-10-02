#!/usr/bin/env bash
# Починить установку переменных шлюза после первого (частичного) прогона:
# rm + add вместо --force — у add на существующей переменной запрос перезаписи
# съедает piped-значение из stdin, и перезапись молча не происходит.
# Каждый шаг теперь проверяется по коду выхода. Ключ не печатается.
set -uo pipefail
cd /Users/rustem/Documents/WebDevelopment/crm_client

KEY="$(ssh server@10.50.0.1 'cat ~/omniroute/crm-key.txt' | tr -d '\r\n' | xargs)"
if [ -z "$KEY" ]; then echo "FAILED: ключ с сервера не получен"; exit 1; fi
echo "ключ получен с ai-server, длина: ${#KEY}"

set_var() {
  local name="$1" value="$2" scope
  for scope in production preview development; do
    vercel env rm "$name" "$scope" -y >/dev/null 2>&1 || true
    if printf '%s\n' "$value" | vercel env add "$name" "$scope" >/dev/null 2>&1; then
      echo "OK    ${name} (${scope})"
    else
      echo "FAIL  ${name} (${scope})  <-- надо разобраться"
    fi
  done
}

set_var AI_PROVIDER openai
set_var OPENAI_API_URL https://omiroute.firmspace.eu/v1
set_var OPENAI_API_KEY "$KEY"
set_var AI_MODEL openrouter/anthropic/claude-sonnet-5.5
set_var AI_TRANSCRIBE_MODEL openrouter/openai/whisper-1

echo "--- проверка: все AI-строки в Vercel ---"
vercel env ls | grep -E "AI_PROVIDER|AI_MODEL|AI_TRANSCRIBE|OPENAI_API"
