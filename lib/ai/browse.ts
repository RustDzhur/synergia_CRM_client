import { type Role, type Module, canAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { computeTotals } from "@/lib/finance/totals";

// Чтение данных всех разделов кабинета для ассистента: одна таблица «сущность → как искать и что показывать»
// вместо десятков одинаковых инструментов. Всё только на чтение, всё в пределах фирмы (org/owner), доступ — по
// тому же разделу, что и у самой страницы (lib/access.ts). Секреты (ключи банков, токены) в вывод не попадают:
// каждая сущность описывает, какие поля показывать, остальное отбрасывается.
export class BrowseError extends Error {}

interface Ctx { org: string; role: Role; modules: string[]; today: string }
type Row = Record<string, any>;
type Lookups = { products: Map<string, string>; suppliers: Map<string, string>; warehouses: Map<string, string> };
type Need = keyof Lookups;

interface Ent {
    label: string;
    module: Module;
    model: string;
    owner: "org" | "owner";
    search: string[];
    order: Record<string, "asc" | "desc">;
    dateField?: string; // по какому полю работает from/to
    dateIsString?: boolean; // дата хранится строкой YYYY-MM-DD, а не DateTime
    where?: Row;
    need?: Need[];
    map: (r: Row, l: Lookups) => Record<string, unknown>;
}

const iso = (d: unknown) => (d ? new Date(d as Date).toISOString().slice(0, 10) : "");
const round = (n: number) => Math.round(n * 100) / 100;
const gross = (items: unknown) => round(computeTotals((Array.isArray(items) ? items : []) as never).gross);
const cut = (s: unknown, n: number) => { const t = String(s ?? ""); return t.length > n ? `${t.slice(0, n)}…` : t; };

export const ENTITIES: Record<string, Ent> = {
    warehouses: { label: "warehouses (stock locations)", module: "inventory", model: "warehouse", owner: "org", search: ["name", "address"], order: { name: "asc" }, where: { archived: false }, map: (r) => ({ name: r.name, kind: r.kind, address: cut(r.address, 100), isDefault: r.isDefault }) },
    stock_movements: { label: "stock movements (receipts, sales, write-offs, adjustments)", module: "inventory", model: "stockMovement", owner: "org", search: ["note", "reason"], order: { createdAt: "desc" }, dateField: "createdAt", need: ["products", "warehouses"], map: (r, l) => ({ date: iso(r.createdAt), product: l.products.get(r.product) ?? "", qty: r.qty, reason: r.reason, warehouse: r.warehouse ? l.warehouses.get(r.warehouse) ?? "" : "", note: cut(r.note, 100) }) },
    orders: { label: "sales orders", module: "inventory", model: "order", owner: "org", search: ["number", "customerName"], order: { createdAt: "desc" }, dateField: "createdAt", map: (r) => ({ number: r.number, customer: r.customerName, status: r.status, total: gross(r.items), currency: r.currency, deliveryDate: r.deliveryDate, created: iso(r.createdAt) }) },
    quotes: { label: "quotes / offers", module: "inventory", model: "quote", owner: "org", search: ["number", "customerName"], order: { createdAt: "desc" }, dateField: "issueDate", dateIsString: true, map: (r) => ({ number: r.number, customer: r.customerName, status: r.status, total: gross(r.items), currency: r.currency, issued: r.issueDate, validUntil: r.validUntil }) },
    contracts: { label: "contracts", module: "inventory", model: "contract", owner: "org", search: ["number", "customerName"], order: { createdAt: "desc" }, dateField: "createdAt", map: (r) => ({ number: r.number, customer: r.customerName, status: r.status, value: r.value, currency: r.currency, start: r.startDate, end: r.endDate }) },
    suppliers: { label: "suppliers (vendors)", module: "inventory", model: "supplier", owner: "org", search: ["name", "contactName", "email", "code"], order: { name: "asc" }, where: { archived: false }, map: (r) => ({ name: r.name, contact: r.contactName, phone: r.phone, email: r.email, paymentDays: r.paymentDays, currency: r.currency }) },
    purchase_orders: { label: "purchase orders to suppliers", module: "inventory", model: "purchaseOrder", owner: "org", search: ["number", "notes"], order: { createdAt: "desc" }, dateField: "date", dateIsString: true, need: ["suppliers"], map: (r, l) => ({ number: r.number, supplier: l.suppliers.get(r.supplier) ?? "", date: r.date, expected: r.expectedDate, status: r.status, currency: r.currency, lines: Array.isArray(r.lines) ? r.lines.length : 0 }) },
    supplier_invoices: { label: "supplier invoices (bills to pay)", module: "inventory", model: "supplierInvoice", owner: "org", search: ["number", "notes"], order: { dueDate: "asc" }, dateField: "date", dateIsString: true, need: ["suppliers"], map: (r, l) => ({ number: r.number, supplier: l.suppliers.get(r.supplier) ?? "", date: r.date, due: r.dueDate, amount: r.amount, paid: r.paidAmount, open: round(Math.max(0, r.amount - r.paidAmount)), currency: r.currency, status: r.status }) },
    production_orders: { label: "production orders", module: "inventory", model: "productionOrder", owner: "org", search: ["number", "note"], order: { createdAt: "desc" }, dateField: "createdAt", need: ["products"], map: (r, l) => ({ number: r.number, product: l.products.get(r.product) ?? "", planned: r.planQty, produced: r.producedQty, scrap: r.scrapQty, status: r.status, due: r.due }) },
    recurring_invoices: { label: "recurring (subscription) invoices", module: "inventory", model: "recurringInvoice", owner: "org", search: ["customerName"], order: { nextRunDate: "asc" }, map: (r) => ({ customer: r.customerName, interval: r.interval, nextRun: r.nextRunDate, active: r.active, total: gross(r.items), currency: r.currency }) },
    bank_accounts: { label: "bank and cash accounts", module: "inventory", model: "bankAccount", owner: "org", search: ["name", "iban"], order: { name: "asc" }, map: (r) => ({ name: r.name, kind: r.kind, iban: r.iban, currency: r.currency, openingBalance: r.openingBalance, active: r.active }) },
    bank_transactions: { label: "bank transactions (money in/out)", module: "inventory", model: "bankTransaction", owner: "org", search: ["counterparty", "reference"], order: { date: "desc" }, dateField: "date", dateIsString: true, map: (r) => ({ date: r.date, amount: r.amount, currency: r.currency, counterparty: cut(r.counterparty, 80), reference: cut(r.reference, 100), matched: r.matchType || "no" }) },
    assets: { label: "fixed assets", module: "inventory", model: "asset", owner: "org", search: ["name", "category"], order: { acquiredDate: "desc" }, dateField: "acquiredDate", dateIsString: true, map: (r) => ({ name: r.name, category: r.category, acquired: r.acquiredDate, cost: r.cost, currency: r.currency, lifeYears: r.usefulLifeYears }) },
    events: { label: "calendar events and meetings", module: "collab", model: "event", owner: "org", search: ["title", "description", "location", "attendees"], order: { date: "asc" }, dateField: "date", dateIsString: true, map: (r) => ({ title: r.title, date: r.date, start: r.startTime, endDate: r.endDate, end: r.endTime, location: r.location, attendees: cut(r.attendees, 120), description: cut(r.description, 150) }) },
    conversations: { label: "chat conversations (WhatsApp, Telegram, web chat…)", module: "collab", model: "conversation", owner: "owner", search: ["name", "lastText"], order: { lastAt: "desc" }, dateField: "lastAt", map: (r) => ({ name: r.name, channel: r.channel, lastMessage: cut(r.lastText, 150), lastAt: iso(r.lastAt), unread: r.unread }) },
    projects: { label: "projects", module: "tasks", model: "project", owner: "owner", search: ["name", "description", "responsible"], order: { createdAt: "desc" }, where: { archived: false }, map: (r) => ({ name: r.name, status: r.status, start: r.startDate, end: r.endDate, responsible: r.responsible, description: cut(r.description, 150) }) },
};

export const ENTITY_KEYS = [...Object.keys(ENTITIES), "section_records"];
// Вкладки с произвольными записями: automation:rules, marketing:…, inventory:… (хранятся в SectionRecord, см. app/api/records)
const SECTION_MODULES: Record<string, Module> = { automation: "automation", marketing: "marketing", inventory: "inventory" };

async function lookups(org: string, need: Need[] = []): Promise<Lookups> {
    const l: Lookups = { products: new Map(), suppliers: new Map(), warehouses: new Map() };
    if (need.includes("products")) for (const p of await prisma.product.findMany({ where: { org }, select: { id: true, name: true }, take: 5000 })) l.products.set(p.id, p.name);
    if (need.includes("suppliers")) for (const s of await prisma.supplier.findMany({ where: { org }, select: { id: true, name: true }, take: 2000 })) l.suppliers.set(s.id, s.name);
    if (need.includes("warehouses")) for (const w of await prisma.warehouse.findMany({ where: { org }, select: { id: true, name: true }, take: 200 })) l.warehouses.set(w.id, w.name);
    return l;
}

const limitOf = (v: unknown, cap = 40) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(cap, Math.max(1, n)) : 15; };
const dayOk = (v: unknown, what: string) => {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) return "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new BrowseError(`${what} must be a date like 2026-09-30`);
    return s;
};

export async function browse(ctx: Ctx, a: Record<string, unknown>) {
    const entity = String(a.entity ?? "");
    const q = typeof a.query === "string" ? a.query.trim().slice(0, 100) : "";
    const take = limitOf(a.limit);

    if (entity === "section_records") {
        const key = typeof a.key === "string" ? a.key.trim() : "";
        const m = key.match(/^([a-z]+):([a-z_]+)$/);
        if (!m || !SECTION_MODULES[m[1]]) throw new BrowseError("key must look like automation:rules, marketing:<tab> or inventory:<tab>");
        if (!canAccess(ctx.role, ctx.modules, SECTION_MODULES[m[1]], "GET")) throw new BrowseError("The user has no access to this section");
        const rows = await prisma.sectionRecord.findMany({ where: { org: ctx.org, key, rid: { not: "__init__" } }, orderBy: { createdAt: "desc" }, take: 200 });
        const needle = q.toLowerCase();
        const list = rows.map((r) => r.values as Record<string, unknown>).filter((v) => !needle || JSON.stringify(v ?? {}).toLowerCase().includes(needle));
        return { entity, key, count: list.length, records: list.slice(0, take).map((v) => Object.fromEntries(Object.entries(v ?? {}).map(([k, x]) => [k, cut(x, 150)]))) };
    }

    const ent = ENTITIES[entity];
    if (!ent) throw new BrowseError("Unknown entity. Choose one of: " + ENTITY_KEYS.join(", "));
    if (!canAccess(ctx.role, ctx.modules, ent.module, "GET")) throw new BrowseError("The user has no access to this section");

    const where: Row = { [ent.owner]: ctx.org, ...(ent.where ?? {}) };
    if (q) where.OR = ent.search.map((k) => ({ [k]: { contains: q, mode: "insensitive" } }));
    const from = dayOk(a.from, "from"), to = dayOk(a.to, "to");
    if ((from || to) && ent.dateField) {
        const range: Row = {};
        if (from) range.gte = ent.dateIsString ? from : new Date(`${from}T00:00:00Z`);
        if (to) range.lte = ent.dateIsString ? to : new Date(`${to}T23:59:59Z`);
        where[ent.dateField] = range;
    }
    const delegate = (prisma as unknown as Record<string, { findMany: (o: unknown) => Promise<Row[]>; count: (o: unknown) => Promise<number> }>)[ent.model];
    const [rows, total, l] = await Promise.all([delegate.findMany({ where, orderBy: ent.order, take }), delegate.count({ where }), lookups(ctx.org, ent.need)]);
    return { entity, total, shown: rows.length, records: rows.map((r) => ({ id: r.id, ...ent.map(r, l) })) };
}

/** Остатки товаров: что заканчивается и чего нет. Низкий остаток — не больше порога (reorderLevel), если порог задан. */
export async function listProducts(ctx: Ctx, a: Record<string, unknown>) {
    if (!canAccess(ctx.role, ctx.modules, "inventory", "GET")) throw new BrowseError("The user has no access to this section");
    const filter = ["low_stock", "out_of_stock", "all"].includes(String(a.filter)) ? String(a.filter) : "low_stock";
    const q = typeof a.query === "string" ? a.query.trim().slice(0, 100) : "";
    const where: Row = { org: ctx.org, archived: false };
    if (q) where.OR = ["name", "sku", "barcode"].map((k) => ({ [k]: { contains: q, mode: "insensitive" } }));
    const rows = await prisma.product.findMany({ where: where as never, orderBy: { name: "asc" }, take: 3000 });
    const goods = rows.filter((p) => p.type === "good");
    const state = (p: (typeof rows)[number]) => ((p.stockQty ?? 0) <= 0 ? "out" : (p.reorderLevel ?? 0) > 0 && (p.stockQty ?? 0) <= p.reorderLevel ? "low" : "ok");
    const picked = filter === "out_of_stock" ? goods.filter((p) => state(p) === "out") : filter === "low_stock" ? goods.filter((p) => state(p) !== "ok") : rows;
    picked.sort((x, y) => (x.stockQty ?? 0) - (y.stockQty ?? 0));
    return {
        filter,
        goodsTotal: goods.length, outOfStock: goods.filter((p) => state(p) === "out").length, lowStock: goods.filter((p) => state(p) === "low").length,
        products: picked.slice(0, limitOf(a.limit, Number(a._cap) || 40)).map((p) => ({ id: p.id, name: p.name, sku: p.sku, type: p.type, stock: p.stockQty, unit: p.unit, reorderLevel: p.reorderLevel, state: p.type === "good" ? state(p) : "service", salePrice: p.salePrice })),
    };
}
