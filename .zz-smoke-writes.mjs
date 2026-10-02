// Проверка путей записи на дубликате: создание → правка → удаление. Всё созданное удаляется,
// в базе не остаётся следов (проверяется в конце).
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
const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const call = async (method, path, body) => {
    const res = await fetch(`${BASE}${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    return { status: res.status, body: text, json: (() => { try { return JSON.parse(text); } catch { return null; } })() };
};
const mark = `ZZ проверка ${Date.now()}`;
let failures = 0;
const check = (label, ok, extra = "") => { console.log(`${ok ? "✓" : "✗"} ${label}${extra ? " — " + extra : ""}`); if (!ok) failures++; };

// задачи
const t1 = await call("POST", "/api/tasks", { title: mark, description: "создано проверкой", deadline: "2026-12-31T10:00", responsible: "Rustem" });
const taskId = t1.json?.task?.id ?? t1.json?.id;
check("задача: создание", t1.status === 201 && !!taskId, `status ${t1.status}, ключи: ${Object.keys(t1.json ?? {}).join(",")}`);
if (taskId) {
    const t2 = await call("PATCH", `/api/tasks/${taskId}`, { completed: true, title: mark + " (правка)" });
    check("задача: правка", t2.status === 200, `status ${t2.status}`);
    const t3 = await call("DELETE", `/api/tasks/${taskId}`);
    check("задача: удаление", t3.status === 200 || t3.status === 204, `status ${t3.status}`);
}

// контакты
const k1 = await call("POST", "/api/contacts", { firstName: "ZZ", lastName: "Проверка", email: `zz.${Date.now()}@example.test`, phone: "+491700000000" });
check("контакт: создание", k1.status === 201 && !!(k1.json?.id || k1.json?.contact?.id), `status ${k1.status}`);
const contactId = k1.json?.id ?? k1.json?.contact?.id;
if (contactId) {
    const k2 = await call("PATCH", `/api/contacts/${contactId}`, { position: "QA" });
    check("контакт: правка", k2.status === 200, `status ${k2.status}`);
    const k3 = await call("DELETE", `/api/contacts/${contactId}`);
    check("контакт: удаление", k3.status === 200 || k3.status === 204, `status ${k3.status}`);
}

// ни одной тестовой записи не осталось
const c2 = new pg.Client({ connectionString: pgUrl });
await c2.connect();
const tasks = await c2.query("select count(*)::int n from tasks where title like 'ZZ проверка%'");
const contacts = await c2.query("select count(*)::int n from contacts where \"lastName\" = 'Проверка'");
console.log(`осталось тестовых задач: ${tasks.rows[0].n}, контактов: ${contacts.rows[0].n}`);
if (tasks.rows[0].n || contacts.rows[0].n) failures++;
await c2.end();
process.exit(failures ? 1 : 0);
