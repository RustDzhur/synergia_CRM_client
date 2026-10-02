#!/usr/bin/env bash
# Dump the most recent OmniRoute audit-log rows so we can tell whether a
# login attempt actually reached the app and how it was resolved.
set -uo pipefail

docker exec omniroute node -e '
const DB = "/app/data/storage.sqlite";
let Driver;
try { Driver = require("/app/node_modules/better-sqlite3"); }
catch (e) { Driver = require("better-sqlite3"); }

const db = new Driver(DB, { readonly: true });
const tables = db
  .prepare("select name from sqlite_master where type = ? and name like ?")
  .all("table", "%audit%");

if (!tables.length) {
  console.log("no audit tables found");
  process.exit(0);
}

for (const t of tables) {
  console.log("--- " + t.name + " ---");
  const rows = db.prepare("select * from " + t.name + " order by rowid desc limit 8").all();
  for (const r of rows) console.log(JSON.stringify(r).slice(0, 260));
}
'
