// Сквозная проверка API дубликата: авторизуемся токеном с JWT_SECRET оригинала и обходим
// GET-маршруты. Цель — найти 500-е (ошибки времени выполнения) в переведённом на Prisma коде.
import fs from "node:fs";
import jwt from "jsonwebtoken";
import pg from "pg";

const env = fs.readFileSync(".env.local", "utf8");
const JWT = env.match(/^JWT_SECRET=(.*)$/m)[1].trim();
const pgUrl = env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
const BASE = process.env.BASE ?? "http://127.0.0.1:3211";

const c = new pg.Client({ connectionString: pgUrl });
await c.connect();
const id = async (t, where = "") => (await c.query(`select id from ${t} ${where} limit 1`)).rows[0]?.id ?? "";
const ids = {
    contact: await id("contacts"), company: await id("companies"), deal: await id("deals"),
    task: await id("tasks"), product: await id("products"), invoice: await id("invoices"),
    quote: await id("quotes"), order: await id("orders"), contract: await id("contracts"),
    conversation: await id("conversations"), stockdoc: await id("stockdocs"), asset: await id("assets"),
    expense: await id("expenses"), supplierinvoice: await id("supplierinvoices"),
    recurring: await id("recurringinvoices"), productionorder: await id("productionorders"),
    docitem: await id("docitems"), mail: await id("mailmessages"), employee: await id("employees"),
};
const user = (await c.query("select id from users limit 1")).rows[0].id;
await c.end();
const token = jwt.sign({ sub: user }, JWT, { expiresIn: "30m" });

const PATHS = [
    "/api/contacts", `/api/contacts/${ids.contact}`, `/api/contacts/${ids.contact}/activities`,
    "/api/companies", `/api/companies/${ids.company}`,
    "/api/deals", `/api/deals/${ids.deal}`, `/api/deals/${ids.deal}/documents`, `/api/deals/${ids.deal}/channels`,
    "/api/tasks", "/api/employees", "/api/projects", "/api/boms",
    "/api/products", "/api/warehouses", "/api/stock", "/api/stock-docs", `/api/stock-docs/${ids.stockdoc}`,
    "/api/assets", `/api/assets/${ids.asset}`, "/api/expenses", `/api/expenses/${ids.expense}`,
    "/api/invoices", `/api/invoices/${ids.invoice}`, "/api/quotes", `/api/quotes/${ids.quote}`,
    "/api/orders", `/api/orders/${ids.order}`, "/api/contracts", `/api/contracts/${ids.contract}`,
    "/api/supplier-invoices", "/api/recurring-invoices", "/api/issued-docs", "/api/reconciliation",
    "/api/production-orders", `/api/production-orders/${ids.productionorder}`, "/api/production/mrp",
    "/api/finance/settings", "/api/finance/reports", "/api/finance/dashboard", "/api/finance/audit",
    "/api/finance/fiscal", "/api/finance/rates", "/api/finance/document-templates",
    "/api/conversations", `/api/conversations/${ids.conversation}`, "/api/calls",
    "/api/notifications", "/api/feed", "/api/calendar", "/api/automation",
    "/api/mail/accounts", "/api/integrations", "/api/ads", "/api/billing", "/api/import",
    "/api/documents", `/api/documents/${ids.docitem}`, "/api/onedrive", "/api/drive",
    "/api/ai/log", "/api/notify-settings", "/api/marketplace", "/api/pos", "/api/sip/credentials",
    "/api/expenses/extract", "/api/lookup", "/api/health", "/api/orgs", "/api/admin/summary",
    // вторые партии: только-немецкие и только-украинские разделы — тут важно получить 409, а не 500
    "/api/finance/reports/analysis", "/api/finance/ua/calendar", "/api/finance/ua/export",
    "/api/novaposhta", "/api/ukrposhta", "/api/marketplace",
    `/api/orders/${ids.order}/waybill`, `/api/orders/${ids.order}/act`, `/api/orders/${ids.order}/delivery-note`,
    `/api/orders/${ids.order}/packing-list`, `/api/orders/${ids.order}/pdf`, `/api/orders/${ids.order}/share`,
    `/api/invoices/${ids.invoice}/pdf`, `/api/invoices/${ids.invoice}/send`,
    `/api/quotes/${ids.quote}/pdf`, `/api/quotes/${ids.quote}/share`,
    `/api/contracts/${ids.contract}/pdf`, `/api/contracts/${ids.contract}/sign`,
    "/api/finance/document-templates/preview?kind=invoice", "/api/finance/document-templates/preview?kind=act",
    "/api/admin/orgs", "/api/admin/requests", "/api/messages/nonexistent/attachment",
    `/api/stock-docs/${ids.stockdoc}/pdf`, "/api/sitemap.xml", "/api/documents/import-drive",
];

const results = { ok: 0, redirect: 0, forbidden: 0, fail: [] };
for (const p of PATHS) {
    let status = 0, body = "";
    try {
        const res = await fetch(`${BASE}${p}`, { headers: { Authorization: `Bearer ${token}` }, redirect: "manual" });
        status = res.status;
        body = await res.text();
    } catch (e) { status = -1; body = String(e.message); }
    if (status >= 200 && status < 300) results.ok++;
    else if ([301, 302, 307, 308].includes(status)) results.redirect++;
    else if ([401, 403, 404, 405, 400, 409, 503, 429].includes(status)) results.forbidden++;
    else results.fail.push(`${status} ${p} :: ${body.slice(0, 160).replace(/\s+/g, " ")}`);
}
console.log(`2xx: ${results.ok} | 3xx: ${results.redirect} | 4xx/503: ${results.forbidden} | ошибок: ${results.fail.length}`);
if (results.fail.length) { console.log("\nПРОБЛЕМЫ:"); results.fail.forEach((f) => console.log("  " + f)); }
