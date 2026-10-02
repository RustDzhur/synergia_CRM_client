#!/usr/bin/env bash
# Provision a strong dashboard password for OmniRoute on ai-server.
# The generated value is written to ~/omniroute/.env (mode 600) and is
# deliberately never echoed, so it does not end up in any transcript or log.
set -euo pipefail
cd "$HOME/omniroute"

# 24-char alphanumeric: avoids shell-, URL- and YAML-hostile characters.
NEWPW="$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 24)"

if grep -q '^INITIAL_PASSWORD=' .env; then
  sed -i "s|^INITIAL_PASSWORD=.*|INITIAL_PASSWORD=${NEWPW}|" .env
else
  printf '\n# Dashboard login for https://omiroute.firmspace.eu\nINITIAL_PASSWORD=%s\n' "$NEWPW" >> .env
fi
chmod 600 .env
echo "STEP1 ok: INITIAL_PASSWORD written to ~/omniroute/.env, mode 600, value not printed."

# The app seeds the bcrypt hash from INITIAL_PASSWORD only while no hash is
# stored, so clear the (minutes-old, unconfigured) data dir before restarting.
docker compose down >/dev/null 2>&1 || true
rm -rf data && mkdir -p data && chmod 777 data
docker compose up -d >/dev/null 2>&1
echo "STEP2 ok: stack recreated on a clean data dir."

for _ in $(seq 1 60); do
  if curl -fsS -m 3 http://127.0.0.1:3111/healthz >/dev/null 2>&1; then break; fi
  sleep 5
done

printf 'STEP3 healthz: '
curl -s -m 5 http://127.0.0.1:3111/healthz || true
echo

printf 'STEP4 login with the new password: '
curl -s -o /dev/null -w '%{http_code}\n' -m 10 -X POST http://127.0.0.1:3111/api/auth/login \
  -H 'Content-Type: application/json' -d "{\"password\":\"${NEWPW}\"}"

printf 'STEP5 login with CHANGEME: '
curl -s -o /dev/null -w '%{http_code}\n' -m 10 -X POST http://127.0.0.1:3111/api/auth/login \
  -H 'Content-Type: application/json' -d '{"password":"CHANGEME"}'

echo "DONE"
