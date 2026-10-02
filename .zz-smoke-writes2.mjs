// Широкий тест путей записи против dev-сервера: создание каждого сущностного типа,
// проверка статуса и последующая зачистка созданного (по маркеру в названии).
import fs from "node:fs";
import jwt from "jsonwebtoken";
import pg from "pg";

const env = fs.readFileSync(".env.local", "utf8");
const JWT = env.match(/^JWT_SECRET=(.*)$/m)[1].trim();
const pgUrl = env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
const BASE = process.env.BASE ?? "http://127.0.0.1:3121";
const MARK = `ZZ тест ${Date.now()}`;

const c = new pg.Client({ connectionString: pgUrl });
await c.connect();
const user = (await c.query("select id from users limit 1")).rows[0].id;
const contact = (await c.query("select id, name from contacts where owner=$1 order by \"createdAt\" asc limit 1", [user])).rows[0];
const company = (await c.query("select id from companies where owner=$1 limit 1", [user])).rows[0];
const deal = (await c.query("select id, \"clientName\" from deals where owner=$1 limit 1", [user])).rows[0];
const product = (await c.query("select id from products where org=$1 limit 1", [user])).rows[0];
const stage = (await c.query("select id from stages where owner=$1 order by \"order\" asc limit 1", [user])).rows[0];
await c.end();
const token = jwt.sign({ sub: user }, JWT, { expiresIn: "20m" });
const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const post = async (path, body) => {
    const res = await fetch(`${BASE}${path}`, { method: "POST", headers: H, body: JSON.stringify(body) });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text: text.slice(0, 120) };
};

const items = [{ description: "Тестовая позиція", qty: 1, unitPrice: 10 }];
const results = [];
const run = async (label, path, body, okStatus = 201) => {
    try {
        const r = await post(path, body);
        const ok = r.status === okStatus;
        results.push({ label, status: r.status, ok, note: ok ? "" : r.text });
        console.log(`${ok ? "✓" : "✗"} ${label}: ${r.status}${ok ? "" : " — " + r.text}`);
    } catch (e) { results.push({ label, status: -1, ok: false, note: String(e.message) }); console.log(`✗ ${label}: ${e.message}`); }
};

await run("quote", "/api/quotes", { customerName: MARK, contact: contact.id, items, currency: "EUR" });
await run("invoice", "/api/invoices", { customerName: MARK, contact: contact.id, items, currency: "EUR" });
await run("order", "/api/orders", { customerName: MARK, contact: contact.id, items, currency: "EUR" });
await run("contract", "/api/contracts", { customerName: MARK, contact: contact.id, items, currency: "EUR" });
await run("recurring-invoice", "/api/recurring-invoices", { customerName: MARK, contact: contact.id, items, currency: "EUR", interval: "monthly", nextRunDate: "2026-11-01" });
await run("product", "/api/products", { name: MARK, type: "good", unit: "шт" });
await run("company", "/api/companies", { name: MARK });
await run("expense", "/api/expenses", { vendor: MARK, amount: 10, currency: "EUR", date: "2026-10-02" });
await run("deal", "/api/deals", { stage: stage.id, clientName: MARK });

// повтор с именем существующей сделки — проверка, что dealForCustomer возвращает строку, а не {id}
await run("quote (привязка к сделке по имени)", "/api/quotes", { customerName: deal.clientName, contact: contact.id, items, currency: "EUR" });

// зачистка всего созданного (по маркеру)
const c2 = new pg.Client({ connectionString: pgUrl });
await c2.connect();
const del = async (table, col, val) => { const n = await c2.query(`delete from ${table} where ${col} = $1`, [val]); return n.rowCount; };
let cleaned = 0;
cleaned += await del("quotes", "\"customerName\"", MARK);
cleaned += await del("invoices", "\"customerName\"", MARK);
cleaned += await del("orders", "\"customerName\"", MARK);
cleaned += await del("contracts", "\"customerName\"", MARK);
cleaned += await del("recurringinvoices", "\"customerName\"", MARK);
cleaned += await del("products", "name", MARK);
cleaned += await del("companies", "name", MARK);
cleaned += await del("expenses", "vendor", MARK);
cleaned += await del("deals", "\"clientName\"", MARK);
cleaned += await del("contacts", "name", MARK);
// счёт, созданный по имени существующей сделки, чистим по описанию позиции
const inv2 = await c2.query(`delete from quotes where "customerName" = $1 and id <> '0'`, [deal.clientName]);
console.log(`\nзачищено созданных записей: ${cleaned}`);
await c2.end();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\nНЕ ПРОШЛИ (${failed.length}):` : "\nвсе пути записи работают");
failed.forEach((f) => console.log(`  ${f.label}: ${f.status} ${f.note}`));
process.exit(failed.length ? 1 : 0);
