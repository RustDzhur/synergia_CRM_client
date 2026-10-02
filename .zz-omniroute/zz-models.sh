#!/usr/bin/env bash
# Ask OmniRoute what models it can currently serve.
# Prints only the model list (no secrets): if this is empty, no provider
# has been connected yet and nothing can be routed.
set -uo pipefail
cd "$HOME/omniroute"
KEY="$(grep '^INITIAL_PASSWORD=' .env | cut -d= -f2- >/dev/null 2>&1; true)"

echo "=== /v1/models via the dashboard password ==="
PW="$(grep '^INITIAL_PASSWORD=' .env | cut -d= -f2-)"
curl -s -m 15 http://127.0.0.1:3111/v1/models -H "Authorization: Bearer ${PW}" | head -c 600
echo
echo "=== configured providers (from the app DB) ==="
docker exec omniroute node -e '
const DB = "/app/data/storage.sqlite";
let Driver;
try { Driver = require("/app/node_modules/better-sqlite3"); }
catch (e) { Driver = require("better-sqlite3"); }
const db = new Driver(DB, { readonly: true });
const tables = db.prepare("select name from sqlite_master where type = ? and name like ?")
  .all("table", "%provider%");
console.log("tables:", tables.map(t => t.name).join(", ") || "(none)");
for (const t of tables) {
  try {
    const n = db.prepare("select count(*) as c from " + t.name).get();
    console.log(t.name + " rows:", n.c);
  } catch (e) { console.log(t.name + ": " + e.message); }
}
' 2>&1 | head -20
