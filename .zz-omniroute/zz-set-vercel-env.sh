#!/usr/bin/env bash
# Установить переменные OmniRoute-шлюза в Vercel (production/preview/development)
# и в локальный .env.local. Значение ключа нигде не печатается.
set -euo pipefail
cd /Users/rustem/Documents/WebDevelopment/crm_client

KEY="$(ssh server@10.50.0.1 'cat ~/omniroute/crm-key.txt' | tr -d '\r\n' | xargs)"
if [ -z "$KEY" ]; then echo "FAILED: ключ с сервера не получен"; exit 1; fi
echo "ключ получен с ai-server, длина: ${#KEY}"

set_var() {
  local name="$1" value="$2"
  for scope in production preview development; do
    printf '%s\n' "$value" | vercel env add "$name" "$scope" --force >/dev/null 2>&1
    echo "vercel: ${name} (${scope}) — ok"
  done
}

set_var AI_PROVIDER openai
set_var OPENAI_API_URL https://omiroute.firmspace.eu/v1
set_var OPENAI_API_KEY "$KEY"
set_var AI_MODEL openrouter/anthropic/claude-sonnet-5.5
set_var AI_TRANSCRIBE_MODEL openrouter/openai/whisper-1

# Локальный .env.local — чтобы дев-сервер тоже ходил через шлюз
LOCAL=.env.local
sed -i '' '/^AI_PROVIDER=/d;/^OPENAI_API_URL=/d;/^OPENAI_API_KEY=/d;/^AI_MODEL=/d;/^AI_TRANSCRIBE_MODEL=/d' "$LOCAL"
{
  echo "AI_PROVIDER=openai"
  echo "OPENAI_API_URL=https://omiroute.firmspace.eu/v1"
  echo "OPENAI_API_KEY=${KEY}"
  echo "AI_MODEL=openrouter/anthropic/claude-sonnet-5.5"
  echo "AI_TRANSCRIBE_MODEL=openrouter/openai/whisper-1"
} >> "$LOCAL"
chmod 600 "$LOCAL"
echo ".env.local: AI-строки записаны (старые удалены), права 600"

echo "--- vercel env ls ---"
vercel env ls
