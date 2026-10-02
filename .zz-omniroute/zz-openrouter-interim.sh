#!/usr/bin/env bash
# Временный план «бесплатно»: пока домашний OmniRoute недоступен по IPv4 (и сам
# сервер выключен), CRM ходит напрямую в OpenRouter бесплатной моделью (:free).
# Ключ спрашивается интерактивно и нигде не печатается. В конце — редеплой.
set -uo pipefail
cd /Users/rustem/Documents/WebDevelopment/crm_client

printf 'OpenRouter API key (https://openrouter.ai/settings/keys): '
read -r KEY
if [ -z "$KEY" ]; then echo "пустой ключ — выход"; exit 1; fi
echo "длина ключа: ${#KEY}"

set_var() {
  local name="$1" value="$2" scope
  for scope in production preview development; do
    vercel env rm "$name" "$scope" -y >/dev/null 2>&1 || true
    if printf '%s\n' "$value" | vercel env add "$name" "$scope" >/dev/null 2>&1; then
      echo "OK    ${name} (${scope})"
    else
      echo "FAIL  ${name} (${scope})  <-- разобраться"
    fi
  done
}

set_var OPENAI_API_URL https://openrouter.ai/api/v1
set_var OPENAI_API_KEY "$KEY"
set_var AI_MODEL deepseek/deepseek-chat-v3-0324:free
set_var AI_TRANSCRIBE_MODEL openai/whisper-1

echo "--- redeploy производства ---"
vercel redeploy www.firmspace.de --yes 2>/dev/null || echo "redeploy не прошёл — нажми Redeploy в дашборде Vercel (последний прод-деплой)"
