#!/usr/bin/env bash
# Ask OmniRoute which models it can serve with the CRM key, and which
# providers are connected. Prints ids/labels only — never the key.
set -uo pipefail
KEY="$(cat "$HOME/omniroute/crm-key.txt")"

echo "=== /v1/models (via the new key) ==="
curl -s -m 25 http://127.0.0.1:3111/v1/models -H "Authorization: Bearer ${KEY}" \
  | head -c 2000
echo
echo
echo "=== connected providers (ids only) ==="
docker exec omniroute node -e '
const DB = "/app/data/storage.sqlite";
let Driver;
try { Driver = require("/app/node_modules/better-sqlite3"); }
catch (e) { Driver = require("better-sqlite3"); }
const db = new Driver(DB, { readonly: true });
try {
  const rows = db.prepare("select * from provider_connections limit 5").all();
  for (const r of rows) {
    const id = r.provider ?? r.providerId ?? r.id;
    const name = r.name ?? r.label ?? "";
    const enabled = r.enabled ?? r.isEnabled ?? "";
    console.log("- " + id + " | " + name + " | enabled=" + enabled);
  }
} catch (e) { console.log("err: " + e.message); }
'
