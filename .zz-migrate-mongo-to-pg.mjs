// Перенос данных из MongoDB (Atlas, synergyaCRM) в PostgreSQL (таблица crm).
// Читает MONGODB_URI и DATABASE_URL из .env.local. Только чтение из Mongo, запись в Postgres.
// Идемпотентен: по умолчанию ON CONFLICT DO NOTHING по первичному ключу id.
// С ключом --upsert существующие записи перезаписываются значениями из Mongo — это «догон»
// изменений, сделанных в оригинале после первого переноса (перед переключением домена).
import fs from "node:fs";
import mongoose from "mongoose";
import pg from "pg";

const UPSERT = process.argv.includes("--upsert");
const env = fs.readFileSync(".env.local", "utf8");
const mongoUri = (env.match(/^MONGODB_URI=(.*)$/m) || [])[1]?.trim();
const pgUrl = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1]?.trim();
if (!mongoUri) { console.error("нет MONGODB_URI"); process.exit(1); }
if (!pgUrl) { console.error("нет DATABASE_URL"); process.exit(1); }

// Фактические коллекции MongoDB (в том же порядке — таблицы Postgres).
const COLLECTIONS = [
  "ailogs", "aiusages", "assets", "auditlogs", "automationjobs", "bankaccounts",
  "banktransactions", "blogposts", "boms", "companies", "contacts", "contactmessages",
  "contracts", "conversations", "cryptopayments", "deals", "docfolders", "docitems",
  "documenttemplates", "employees", "events", "expenses", "feedposts", "financesettings",
  "fiscalshifts", "importbatches", "importmappings", "integrations", "invitations", "invoices",
  "invoicerequests", "mailmessages", "memberships", "messages", "notifications", "orders",
  "organizations", "platformsettings", "products", "productionorders", "projects",
  "purchaseorders", "quotes", "recurringinvoices", "sectionrecords", "sharelinks", "stages",
  "stockdocs", "stockmovements", "suppliers", "supplierinvoices", "tasks", "users", "warehouses",
];

function isObjectId(v) {
  return v != null && (typeof v === "object") && (v._bsontype === "ObjectId" || v instanceof mongoose.Types.ObjectId || (typeof v.toHexString === "function" && Buffer.isBuffer(v.id)));
}

// Рекурсивно приводим значения к тому, что принимает Postgres через node-pg.
function transform(v) {
  if (v === null || v === undefined) return null;
  if (isObjectId(v)) return v.toHexString ? v.toHexString() : v.toString();
  if (v instanceof Date) return v; // pg -> timestamp
  if (Array.isArray(v)) return v.map(transform);
  if (typeof v === "object") {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (k === "__v") continue;
      out[k] = transform(val);
    }
    return out;
  }
  return v;
}

const mongo = await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 30000 });
const db = mongo.connection.db;
const client = new pg.Client({ connectionString: pgUrl });
await client.connect();

let totalOk = 0, totalErr = 0;

for (const coll of COLLECTIONS) {
  const colsInfo = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1",
    [coll]
  ).catch(() => ({ rows: [] }));
  if (colsInfo.rows.length === 0) { console.log(`SKIP ${coll}: таблицы нет`); continue; }
  const tableCols = new Set(colsInfo.rows.map(r => r.column_name));
  const jsonbCols = new Set(colsInfo.rows.filter(r => r.data_type === "jsonb").map(r => r.column_name));

  const docs = await db.collection(coll).find({}).toArray();
  if (docs.length === 0) { console.log(`SKIP ${coll}: 0 документов`); continue; }

  let ok = 0, err = 0;
  for (const doc of docs) {
    const rec = {};
    for (const [k, v] of Object.entries(doc)) {
      if (k === "__v") continue;
      const col = k === "_id" ? "id" : k;
      if (!tableCols.has(col)) continue; // пропускаем легаси-поля, которых нет в схеме
      const tv = transform(v);
      rec[col] = jsonbCols.has(col) && tv !== null ? JSON.stringify(tv) : tv;
    }
    const keys = Object.keys(rec);
    if (keys.length === 0) continue;
    const cols = keys.map(k => `"${k}"`).join(",");
    const ph = keys.map((_, i) => `$${i + 1}`).join(",");
    try {
      // при --upsert обновляем все поля, кроме идентификатора
      const updates = keys.filter(k => k !== "id").map(k => `"${k}"=EXCLUDED."${k}"`).join(", ");
      const sql = UPSERT && updates
        ? `INSERT INTO "${coll}" (${cols}) VALUES (${ph}) ON CONFLICT ("id") DO UPDATE SET ${updates}`
        : `INSERT INTO "${coll}" (${cols}) VALUES (${ph}) ON CONFLICT DO NOTHING`;
      await client.query(sql, keys.map(k => rec[k]));
      ok++;
    } catch (e) {
      err++;
      if (err <= 3) console.error(`  ERR ${coll}: ${e.message}`);
    }
  }
  totalOk += ok; totalErr += err;
  console.log(`DONE ${coll}: ${ok} ${UPSERT ? "записано" : "вставлено"}, ${err} ошибок`);
}

await client.end();
await mongo.disconnect();
console.log(`\nИТОГО: ${totalOk} записей, ${totalErr} ошибок`);
