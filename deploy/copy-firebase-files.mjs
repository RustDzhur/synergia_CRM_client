// Переносит файлы, которые ещё лежат в Firebase Storage, в локальное хранилище на диске.
//
// Нужны переменные окружения (те же, что были у оригинала):
//   FIREBASE_SERVICE_ACCOUNT  — JSON сервисного аккаунта (можно base64)
//   FIREBASE_STORAGE_BUCKET   — имя бакета
// и DATABASE_URL (берётся из .env.local или из окружения), LOCAL_STORAGE_ROOT — куда складывать.
//
// Запуск:
//   node deploy/copy-firebase-files.mjs           # только показать, что переносить
//   node deploy/copy-firebase-files.mjs --write   # скачать файлы в LOCAL_STORAGE_ROOT
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const WRITE = process.argv.includes("--write");

function envFromFile() {
    try {
        const text = fs.readFileSync(".env.local", "utf8");
        const pick = (name) => (text.match(new RegExp(`^${name}=(.*)$`, "m")) || [])[1]?.trim() ?? "";
        return pick("DATABASE_URL");
    } catch { return ""; }
}

const databaseUrl = process.env.DATABASE_URL || envFromFile();
if (!databaseUrl) { console.error("нет DATABASE_URL"); process.exit(1); }

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

// 1) что вообще нужно перенести: документы и вложения сообщений
const docs = (await client.query(`select id, name, "storagePath" from docitems where "storagePath" <> ''`)).rows;
const attachments = (await client.query(`select id, attachment from messages where attachment is not null`)).rows
    .map((r) => ({ id: r.id, name: String(r.attachment?.name ?? ""), storagePath: String(r.attachment?.path ?? "") }))
    .filter((r) => r.storagePath);
await client.end();

const items = [...docs.map((d) => ({ kind: "документ", ...d })), ...attachments.map((a) => ({ kind: "вложение", ...a }))];
const unique = new Map(items.map((i) => [i.storagePath, i]));
console.log(`Файлов в Firebase Storage по данным CRM: ${unique.size}`);
for (const [p, i] of unique) console.log(`  ${i.kind}: ${i.name || "(без имени)"} — ${p}`);

if (!unique.size) process.exit(0);
if (!WRITE) { console.log("\nЭто только список. Для переноса добавьте --write"); process.exit(0); }

const root = (process.env.LOCAL_STORAGE_ROOT ?? "").trim();
if (!root) { console.error("нет LOCAL_STORAGE_ROOT — куда складывать файлы?"); process.exit(1); }
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT ?? "";
const bucketName = process.env.FIREBASE_STORAGE_BUCKET ?? "";
if (!serviceAccount || !bucketName) {
    console.error("нет FIREBASE_SERVICE_ACCOUNT / FIREBASE_STORAGE_BUCKET — без них скачать файлы нельзя");
    process.exit(1);
}

const { default: admin } = await import("firebase-admin");
admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccount.startsWith("{") ? serviceAccount : Buffer.from(serviceAccount, "base64").toString("utf8"))),
    storageBucket: bucketName,
});
const bucket = admin.storage().bucket();

let copied = 0, skipped = 0, failed = 0;
for (const [storagePath] of unique) {
    const dest = path.join(root, storagePath);
    if (fs.existsSync(dest)) { skipped++; continue; }
    try {
        const [buf] = await bucket.file(storagePath).download();
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buf);
        copied++;
    } catch (e) {
        failed++;
        console.error(`  не скачался ${storagePath}: ${e.message}`);
    }
}
console.log(`\nГотово: скачано ${copied}, уже было ${skipped}, ошибок ${failed}`);
