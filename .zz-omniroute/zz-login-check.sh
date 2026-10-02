#!/usr/bin/env bash
# Diagnose the dashboard login for OmniRoute on ai-server.
# Prints only HTTP status codes — never the password itself.
set -euo pipefail
cd "$HOME/omniroute"
PW="$(grep '^INITIAL_PASSWORD=' .env | cut -d= -f2-)"

echo -n "login with the .env password: "
curl -s -o /dev/null -w '%{http_code}\n' -m 10 -X POST http://127.0.0.1:3111/api/auth/login \
  -H 'Content-Type: application/json' -d "{\"password\":\"${PW}\"}"

# The brute-force guard (src/server/auth/loginGuard.ts) keeps its per-IP failure
# counters in process memory only, so a restart wipes any active lockout.
echo "restarting omniroute to clear the lockout..."
docker compose restart omniroute >/dev/null 2>&1

for _ in $(seq 1 60); do
  curl -fsS -m 3 http://127.0.0.1:3111/healthz >/dev/null 2>&1 && break
  sleep 5
done

printf 'healthz after restart: '
curl -s -m 5 http://127.0.0.1:3111/healthz
echo
echo "DONE"
