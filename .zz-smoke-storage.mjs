// Проверка файлового хранилища на сервере: загрузка (multipart) → файл лёг на диск →
// чтение через API → удаление. Проверяет замену Firebase Storage на локальный каталог.
import fs from "node:fs";
import jwt from "jsonwebtoken";
import pg from "pg";

const env = fs.readFileSync(".env.local", "utf8");
const JWT = env.match(/^JWT_SECRET=(.*)$/m)[1].trim();
const pgUrl = env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
const BASE = process.env.BASE ?? "http://127.0.0.1:3211";

const c = new pg.Client({ connectionString: pgUrl });
await c.connect();
const user = (await c.query("select id from users limit 1")).rows[0].id;
await c.end();
const token = jwt.sign({ sub: user }, JWT, { expiresIn: "20m" });
const auth = { Authorization: `Bearer ${token}` };

const name = `zz-storage-check-${Date.now()}.txt`;
const content = Buffer.from("Проверка локального файлового хранилища Firmspace\n", "utf8");

// 1. загрузка
const form = new FormData();
form.append("file", new Blob([content], { type: "text/plain" }), name);
const up = await fetch(`${BASE}/api/documents/upload`, { method: "POST", headers: auth, body: form });
const upBody = await up.text();
console.log("1) загрузка:", up.status, upBody.slice(0, 200));
if (up.status !== 201) process.exit(1);
const doc = JSON.parse(upBody);
const id = doc.id;

// 2. файл на диске (путь виден в БД)
const c2 = new pg.Client({ connectionString: pgUrl });
await c2.connect();
const row = (await c2.query(`select "storagePath", size, mime from docitems where id = $1`, [id])).rows[0];
console.log("2) storagePath в базе:", row?.storagePath, "| размер:", row?.size, "| тип:", row?.mime);

// 3. чтение через API
const down = await fetch(`${BASE}/api/documents/${id}/content`, { headers: auth });
const got = Buffer.from(await down.arrayBuffer());
console.log("3) чтение:", down.status, "| байт:", got.length, "| совпадает:", got.equals(content));

await c2.query("select 1");
await c2.end();
console.log("ID для удаления:", id);
fs.writeFileSync("/tmp/zz-doc-id", id);
