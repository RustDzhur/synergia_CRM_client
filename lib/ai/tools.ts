import { type Role, type Module, canAccess } from "@/lib/access";
import { contactFullName } from "@/lib/crmFields";
import { postTask } from "@/lib/feed";
import { emit, emitDeal } from "@/lib/automation/emit";
import { sendFromAccount } from "@/lib/mail";
import { extractPdfText } from "@/lib/ai/pdf";
import { getObject } from "@/lib/storage";
import { ensureStages } from "@/lib/stages";
import { prisma } from "@/lib/prisma";
import { toDTO } from "@/lib/serialize";
import { ActionError, type DocKind, ORDER_STATUSES, contractAction, decideQuote, fiscalReceipt, invoiceFromOrder, quoteToOrder, setOrderStatus, findDocument, findProduct, findSupplier, markPaid, sendInvoice } from "@/lib/finance/aiActions";
import { moveStock } from "@/lib/finance/stock";
import { purchaseNumber } from "@/lib/purchases";
import { logAudit } from "@/lib/audit";
import { mailAccount } from "@/lib/finance/send";
import { reportPdf, type ReportSection } from "./reportPdf";
import { type Entity, COMPANY_EDITABLE, CONTACT_EDITABLE, DEAL_EDITABLE, RecordError, forget, loadMemory, recordLink, remember, resolveRecord, titleOf, updateRecord } from "./records";
import { isPlatformAdminUser } from "@/lib/admin";
import { decideRequest, listRequests } from "@/lib/connect/tools";
import { LeadToolError, SCOPES as LEAD_SCOPES, analyze as analyzeLeads, cleanup as cleanupLeads, leadLog, restoreLead, saveRules } from "./leadTools";
import { BrowseError, ENTITY_KEYS, browse, listProducts } from "./browse";
import { mkActivity } from "@/lib/activities";
import { financeSettings, defaultCurrency } from "@/lib/finance/settings";
import { nextNumber } from "@/lib/finance/numbering";
import { numberPrefix } from "@/lib/finance/documents/store";
import { applyTaxPolicy, taxExempt } from "@/lib/finance/tax";
import { cleanItems, computeTotals } from "@/lib/finance/totals";
import { firmRate } from "@/lib/finance/rates";
import { ownedContact, contactForCustomer, dealForCustomer } from "@/lib/deals";
import type { ToolDef } from "./provider";

// Инструменты ИИ — единственное, что он умеет делать в CRM. Каждый инструмент:
//  • привязан к разделу CRM (module): у пользователя без доступа к разделу ИИ этот инструмент просто не получает;
//  • «чтение» выполняется сразу, «запись» (write) не выполняется никогда — ИИ лишь предлагает действие, а выполняет его
//    сервер после нажатия «Подтвердить» пользователем (см. app/api/ai/actions);
//  • проверяет и ограничивает аргументы: то, что прислала модель, — недоверенные данные.
export interface AiCtx { org: string; userId: string; role: Role; modules: string[]; today: string; now: string }
type Args = Record<string, unknown>;
export class ToolError extends Error {}

export interface AiTool {
    def: ToolDef;
    module: Module | null; // null — доступно любому участнику фирмы (например, переход на главную)
    write: boolean;
    check?: (a: Args) => Args; // проверка и нормализация аргументов (бросает ToolError)
    run: (ctx: AiCtx, a: Args) => Promise<unknown>;
}

// ── разбор аргументов ──
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown, def: number, min: number, max: number) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
// поиск по части строки без учёта регистра (замена регулярному выражению из Mongo)
const like = (v: string) => ({ contains: v, mode: "insensitive" as const });
// id принимаем и прежний mongodb-ный (24 hex), и cuid у новых записей Prisma
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 40 && /^[A-Za-z0-9_-]+$/.test(v);
const need = (v: string, what: string) => { if (!v) throw new ToolError(`${what} is required`); return v; };
const day = (v: unknown, what: string) => {
    const s = str(v, 30);
    if (!s) return "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new ToolError(`${what} must be a date like 2026-09-30`);
    return s;
};
const dateTime = (v: unknown) => {
    const s = str(v, 30);
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T09:00`;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new ToolError("deadline must look like 2026-09-30T14:00 (or 2026-09-30)");
    return s;
};
const cut = (s: unknown, n: number) => { const t = String(s ?? ""); return t.length > n ? `${t.slice(0, n)}…` : t; };
const iso = (d: unknown) => (d ? new Date(d as Date).toISOString().slice(0, 10) : "");

// Что считается общением с клиентом (в журнале активности контакта)
const COMM = new Set(["email", "call", "sms", "whatsapp", "telegram", "note", "comment", "activity", "schedule"]);
type Act = { type: string; text?: string; meta?: string; createdAt?: Date };
const lastContactAt = (acts: Act[] | undefined, fallback: Date) => (acts ?? []).filter((a) => COMM.has(a.type) && a.createdAt).reduce((m, a) => Math.max(m, new Date(a.createdAt as Date).getTime()), new Date(fallback).getTime());
const acts = (a: Act[] | undefined) => (a ?? []).slice(-15).map((x) => ({ type: x.type, text: cut(x.text, 300), at: iso(x.createdAt) }));

const schema = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const S = (description: string) => ({ type: "string", description });
const N = (description: string) => ({ type: "integer", description });

// Разделы CRM, в которые ассистент переходит по команде «перейди в …» (navigate). module — какой доступ нужен,
// чтобы раздел открылся: без него ассистент не поведёт человека туда, куда ему нельзя.
const NAV_SECTIONS: Record<string, { label: string; link: string; module: Module | null }> = {
    // Названия и порядок — как в боковом меню (components/crm/Sidebar/menuItems.ts). «CRM» в меню — это /crm/crm
    // (вкладки Угоды / Контакти / Компанії), а не главная: главная — «Інформаційна панель» (dashboard).
    dashboard: { label: "Головна", link: "/crm", module: null },
    crm: { label: "CRM", link: "/crm/crm", module: "crm" },
    deals: { label: "Воронка угод", link: "/crm/crm", module: "crm" },
    contacts: { label: "Контакти", link: "/crm/crm?tab=contacts", module: "crm" },
    companies: { label: "Компанії", link: "/crm/crm?tab=companies", module: "crm" },
    tasks: { label: "Задачі", link: "/crm/tasks", module: "tasks" },
    my_company: { label: "Моя фірма", link: "/crm/company", module: "company" },
    employees: { label: "Співробітники", link: "/crm/company", module: "company" },
    feed: { label: "Стрічка", link: "/crm/collaboration/feed", module: "collab" },
    calendar: { label: "Календар", link: "/crm/collaboration/calendar", module: "collab" },
    chat: { label: "Чат і дзвінки", link: "/crm/collaboration/chat-and-calls", module: "collab" },
    mails: { label: "Пошта", link: "/crm/collaboration/web-mails", module: "mail" },
    documents: { label: "Документи", link: "/crm/collaboration/online-documents", module: "collab" },
    finance: { label: "Бухгалтерія", link: "/crm/finance", module: "inventory" },
    marketing: { label: "Маркетинг", link: "/crm/marketing", module: "marketing" },
    automation: { label: "Автоматизація", link: "/crm/automation", module: "automation" },
    settings: { label: "Налаштування", link: "/crm/settings", module: "settings" },
    upgrade: { label: "Тариф", link: "/crm/upgrade", module: "billing" },
};

// Вкладки бухгалтерии (components/crm/Finance/index.tsx — тип Tab): navigate открывает нужную сразу, а не главную раздела
const FINANCE_TABS = ["overview", "quotes", "orders", "contracts", "invoices", "recurring", "dunning", "expenses", "assets", "bank", "products", "purchases", "production", "pos", "acts", "deliveryNotes", "delivery", "fiscal", "vat", "eur", "bwa", "susa", "audit", "settings"] as const;
// Фильтр списка счетов; unpaid = ещё не оплачены (отправлены или просрочены) — это и значит «незакрытые счета»
export const INVOICE_FILTERS = ["unpaid", "overdue", "draft", "sent", "paid", "all"] as const;

// Результат инструмента, который клиент превращает в переход по странице (см. runChat: поле nav)
export interface NavTarget { link: string; label: string }
// Файл, который клиент должен скачать или открыть (инструмент download_document): PDF качается с авторизацией браузера
// Прокрутка страницы (инструмент scroll_page): выполняет браузер человека
export interface ScrollTarget { dir: "down" | "up" | "top" | "bottom"; pages: number }
export interface DownloadTarget { kind: "invoices" | "quotes" | "orders" | "contracts" | "purchases"; id: string; number: string; mode: "download" | "open" }
const wrap = async <T,>(fn: () => Promise<T>): Promise<T> => { try { return await fn(); } catch (e) { throw e instanceof ActionError || e instanceof BrowseError || e instanceof RecordError || e instanceof LeadToolError ? new ToolError(e.message) : e; } };
// Проверка правки карточки: нужна сама карточка (id или название) и хотя бы одно допустимое поле
const recordEditCheck = (a: Args, allowed: readonly string[]): Args => {
    const out: Args = {};
    const id = str(a.id, 40), name = str(a.name, 120);
    if (!id && !name) throw new ToolError("id or name of the record is required");
    if (id) out.id = id;
    if (name) out.name = name;
    let n = 0;
    for (const k of allowed) if (a[k] !== undefined) { out[k] = str(a[k], k === "notes" ? 4000 : 400); n++; }
    if (!n) throw new ToolError("Nothing to change: give at least one field to fill in");
    return out;
};

// Схема строк документа и общая проверка аргументов финансовых инструментов (idempotent:
// check() принимает и первичные аргументы модели, и свой же прежний результат)
const ITEMS = { type: "array", description: "line items", items: { type: "object", properties: { description: S("item name or service"), qty: N("quantity, default 1"), unitPrice: N("price per unit") }, required: ["description"] } };
const financeCheck = (a: Args) => {
    const items = cleanItems(a.items);
    if (!items.length) throw new ToolError("items must contain at least one line with a description");
    return {
        customer_name: need(str(a.customer_name, 200), "customer_name"),
        contact_name: str(a.contact_name ?? a.contact, 40),
        items,
        currency: str(a.currency, 6),
        notes: str(a.notes, 500),
    };
};
const authorName = async (userId: string) => { const u = await prisma.user.findUnique({ where: { id: userId }, select: { firstname: true, lastname: true } }); return u ? `${u.firstname} ${u.lastname}`.trim() : ""; };
const snapshotRate = async (org: string, currency: string) => (currency === "UAH" ? { base: 0, margin: 0, value: 0, at: "" } : await firmRate(org, currency).then((r) => (r ? { base: r.base, margin: r.margin, value: r.rate, at: r.at } : { base: 0, margin: 0, value: 0, at: "" })).catch(() => ({ base: 0, margin: 0, value: 0, at: "" })));

const REPORT_LABELS = {
    ru: { report: "Отчёт", generated: "Сформировано", attached: "отчёт во вложении", product: "Товар", sku: "Артикул", stock: "Остаток", unit: "Ед.", reorder: "Порог", stockLow: "Товары, которые заканчиваются", stockOut: "Товары, которых нет в наличии", number: "Номер", customer: "Клиент", total: "Сумма", open: "Долг", due: "Срок", late: "Просрочка, дн.", invUnpaid: "Неоплаченные счета", invOverdue: "Просроченные счета", sumTotal: "Всего к оплате", invCount: "Счетов" },
    uk: { report: "Звіт", generated: "Сформовано", attached: "звіт у вкладенні", product: "Товар", sku: "Артикул", stock: "Залишок", unit: "Од.", reorder: "Поріг", stockLow: "Товари, що закінчуються", stockOut: "Товари, яких немає в наявності", number: "Номер", customer: "Клієнт", total: "Сума", open: "Борг", due: "Строк", late: "Прострочення, дн.", invUnpaid: "Неоплачені рахунки", invOverdue: "Прострочені рахунки", sumTotal: "Всього до сплати", invCount: "Рахунків" },
    de: { report: "Bericht", generated: "Erstellt", attached: "Bericht im Anhang", product: "Artikel", sku: "Art.-Nr.", stock: "Bestand", unit: "Einh.", reorder: "Meldebestand", stockLow: "Artikel, die knapp werden", stockOut: "Nicht vorrätige Artikel", number: "Nummer", customer: "Kunde", total: "Betrag", open: "Offen", due: "Fällig", late: "Tage überfällig", invUnpaid: "Unbezahlte Rechnungen", invOverdue: "Überfällige Rechnungen", sumTotal: "Gesamt offen", invCount: "Rechnungen" },
    en: { report: "Report", generated: "Generated", attached: "report attached", product: "Product", sku: "SKU", stock: "Stock", unit: "Unit", reorder: "Reorder level", stockLow: "Products running low", stockOut: "Products out of stock", number: "Number", customer: "Customer", total: "Total", open: "Open", due: "Due", late: "Days overdue", invUnpaid: "Unpaid invoices", invOverdue: "Overdue invoices", sumTotal: "Total outstanding", invCount: "Invoices" },
} as const;

// Список счетов с суммами и просрочкой — общий для инструмента list_invoices и для PDF-отчёта
export async function listInvoicesData(c: AiCtx, a: Args) {
    const filter = INVOICE_FILTERS.includes(a.filter as never) ? String(a.filter) : "unpaid";
    const where: Record<string, unknown> = { org: c.org, kind: "invoice" };
    if (filter === "unpaid" || filter === "overdue") where.status = { in: ["sent", "overdue"] };
    else if (filter !== "all") where.status = filter;
    const customer = str(a.customer, 100);
    if (customer) where.customerName = like(customer);
    const rows = await prisma.invoice.findMany({ where: where as any, orderBy: a.sort === "newest" ? [{ issueDate: "desc" as const }, { createdAt: "desc" as const }] : { dueDate: "asc" as const }, take: 400 });
    const todayStr = c.today;
    const mapped = rows.map((i) => {
        const gross = computeTotals(i.items as never).gross;
        const open = i.status === "paid" ? 0 : Math.max(0, Math.round((gross - (i.paidAmount ?? 0)) * 100) / 100);
        const late = ["sent", "overdue"].includes(i.status) && !!i.dueDate && i.dueDate < todayStr;
        const daysOverdue = late ? Math.floor((Date.parse(todayStr) - Date.parse(i.dueDate)) / 86400000) : 0;
        return { number: i.number, customer: i.customerName, status: late && i.status === "sent" ? "overdue" : i.status, total: Math.round(gross * 100) / 100, open, currency: i.currency, issued: i.issueDate, due: i.dueDate, daysOverdue };
    });
    const list = filter === "overdue" ? mapped.filter((i) => i.daysOverdue > 0 || i.status === "overdue") : mapped;
    const sums: Record<string, number> = {};
    for (const i of list) sums[i.currency] = Math.round(((sums[i.currency] ?? 0) + i.open) * 100) / 100;
    return { filter, count: list.length, openAmountByCurrency: sums, invoices: list.slice(0, int(a.limit, 15, 1, Number(a._cap) || 40)) };
}

export const TOOLS: AiTool[] = [
    // ─────────── чтение ───────────
    {
        module: "crm", write: false,
        def: { name: "search_contacts", description: "Search contacts (customers, people) by name, e-mail, phone or company. Empty query lists the most recently changed.", parameters: schema({ query: S("text to look for"), limit: N("max results, default 10, max 25") }) },
        run: async (c, a) => {
            const q = str(a.query, 100);
            const filter: Record<string, unknown> = { owner: c.org };
            if (q) filter.OR = ["name", "email", "phone", "company"].map((k) => ({ [k]: like(q) }));
            const list = await prisma.contact.findMany({ where: filter as any, orderBy: { updatedAt: "desc" }, take: int(a.limit, 10, 1, 25) });
            return list.map((x) => ({ id: x.id, name: x.name, email: x.email, phone: x.phone, company: x.company, position: x.position, lastContact: iso(lastContactAt(x.activities as unknown as Act[], x.createdAt)) }));
        },
    },
    {
        module: "crm", write: false,
        def: { name: "search_companies", description: "Search companies (legal entities) by name, field of business or e-mail.", parameters: schema({ query: S("text to look for"), limit: N("max results, default 10, max 25") }) },
        run: async (c, a) => {
            const q = str(a.query, 100);
            const filter: Record<string, unknown> = { owner: c.org };
            if (q) filter.OR = ["name", "field", "email", "address"].map((k) => ({ [k]: like(q) }));
            const list = await prisma.company.findMany({ where: filter as any, orderBy: { updatedAt: "desc" }, take: int(a.limit, 10, 1, 25) });
            return list.map((x) => ({ id: x.id, name: x.name, email: x.email, field: x.field, status: x.status, authorisedPerson: x.authorisedPerson, address: cut(x.address, 120) }));
        },
    },
    {
        module: "crm", write: false,
        def: { name: "find_stale_contacts", description: "Contacts with no recorded communication (e-mail, call, message, note) for at least N days, longest silence first. Based on the activity log of each contact.", parameters: schema({ days: N("minimum days without contact, default 30"), limit: N("max results, default 20, max 50") }) },
        run: async (c, a) => {
            const days = int(a.days, 30, 1, 3650);
            const list = await prisma.contact.findMany({ where: { owner: c.org }, select: { id: true, name: true, email: true, company: true, activities: true, createdAt: true }, take: 1000 });
            const now = Date.now();
            return list
                .map((x) => ({ x, ts: lastContactAt(x.activities as unknown as Act[], x.createdAt) }))
                .filter(({ ts }) => now - ts >= days * 86400000)
                .sort((p, q) => p.ts - q.ts)
                .slice(0, int(a.limit, 20, 1, 50))
                .map(({ x, ts }) => ({ id: x.id, name: x.name, email: x.email, company: x.company, lastContact: iso(ts), daysSince: Math.floor((now - ts) / 86400000) }));
        },
    },
    {
        module: "crm", write: false,
        def: { name: "list_stages", description: "Names of the columns (stages) of the deals board, in order.", parameters: schema({}) },
        run: async (c) => (await ensureStages(c.org)).map((s) => s.name),
    },
    {
        module: "crm", write: false,
        def: { name: "list_deals", description: "Deals (leads, opportunities) with their stage, optionally filtered by text or stage name.", parameters: schema({ query: S("text in the deal, contact or company name"), stage: S("stage name"), limit: N("max results, default 15, max 40") }) },
        run: async (c, a) => {
            const stages = await ensureStages(c.org);
            const byId = new Map(stages.map((s) => [String(s._id), s.name]));
            const filter: Record<string, unknown> = { owner: c.org };
            const stage = str(a.stage, 60).toLowerCase();
            if (stage) {
                const hit = stages.filter((s) => s.name.toLowerCase().includes(stage));
                if (!hit.length) throw new ToolError(`No stage matches "${stage}". Stages: ${stages.map((s) => s.name).join(", ")}`);
                filter.stage = { in: hit.map((s) => String(s._id)) };
            }
            const q = str(a.query, 100);
            if (q) filter.OR = ["clientName", "contactName", "companyName"].map((k) => ({ [k]: like(q) }));
            const list = await prisma.deal.findMany({ where: filter as any, orderBy: { updatedAt: "desc" }, take: int(a.limit, 15, 1, 40) });
            return list.map((d) => ({ id: d.id, name: d.clientName, stage: byId.get(String(d.stage)) ?? "", contact: d.contactName, company: d.companyName, startDate: d.startDate, endDate: d.endDate, responsible: d.responsible, updated: iso(d.updatedAt) }));
        },
    },
    {
        module: "crm", write: false,
        def: { name: "get_contact", description: "Full record of one contact with its latest activity (history of communication). Use it for a customer summary.", parameters: schema({ id: S("contact id from search_contacts") }, ["id"]) },
        run: async (c, a) => {
            if (!isId(a.id)) throw new ToolError("id must be a contact id");
            const x = await prisma.contact.findFirst({ where: { id: String(a.id), owner: c.org } });
            if (!x) throw new ToolError("Contact not found");
            return { id: x.id, name: x.name, email: x.email, phone: x.phone, company: x.company, position: x.position, website: x.website, notes: cut(x.notes, 500), source: x.source, created: iso(x.createdAt), lastContact: iso(lastContactAt(x.activities as unknown as Act[], x.createdAt)), activity: acts(x.activities as unknown as Act[]) };
        },
    },
    {
        module: "crm", write: false,
        def: { name: "get_company", description: "Full record of one company with its latest activity.", parameters: schema({ id: S("company id from search_companies") }, ["id"]) },
        run: async (c, a) => {
            if (!isId(a.id)) throw new ToolError("id must be a company id");
            const x = await prisma.company.findFirst({ where: { id: String(a.id), owner: c.org } });
            if (!x) throw new ToolError("Company not found");
            return { id: x.id, name: x.name, email: x.email, field: x.field, status: x.status, authorisedPerson: x.authorisedPerson, businessType: x.businessType, address: x.address, registrationDate: x.registrationDate, created: iso(x.createdAt), activity: acts(x.activities as unknown as Act[]) };
        },
    },
    {
        module: "crm", write: false,
        def: { name: "get_deal", description: "Full record of one deal with its history (stage changes, notes, e-mails).", parameters: schema({ id: S("deal id from list_deals") }, ["id"]) },
        run: async (c, a) => {
            if (!isId(a.id)) throw new ToolError("id must be a deal id");
            const x = await prisma.deal.findFirst({ where: { id: String(a.id), owner: c.org } });
            if (!x) throw new ToolError("Deal not found");
            const stage = await prisma.stage.findUnique({ where: { id: String(x.stage) }, select: { name: true } });
            return { id: x.id, name: x.clientName, stage: stage?.name ?? "", contact: x.contactName, company: x.companyName, startDate: x.startDate, endDate: x.endDate, type: x.dealType, responsible: x.responsible, created: iso(x.createdAt), activity: acts(x.activities as unknown as Act[]) };
        },
    },
    {
        module: "tasks", write: false,
        def: { name: "list_tasks", description: "Tasks of the firm. filter: open (not done), today (due today), overdue, completed or all. Optionally only tasks of one responsible person (name).", parameters: schema({ filter: { type: "string", enum: ["open", "today", "overdue", "completed", "all"] }, responsible: S("person name to filter by"), limit: N("max results, default 30, max 60") }) },
        run: async (c, a) => {
            const f = str(a.filter, 20) || "open";
            const filter: Record<string, unknown> = { owner: c.org };
            const who = str(a.responsible, 80);
            if (who) filter.responsible = like(who);
            if (f === "completed") filter.completed = true;
            else if (f !== "all") filter.completed = false;
            if (f === "today") filter.deadline = { startsWith: c.today };
            if (f === "overdue") filter.deadline = { gt: "", lt: c.now };
            const list = await prisma.task.findMany({ where: filter as any, orderBy: [{ deadline: "asc" }, { createdAt: "desc" }], take: int(a.limit, 30, 1, 60) });
            return list.map((t) => ({ id: t.id, title: t.title, deadline: t.deadline, responsible: t.responsible, completed: t.completed, overdue: !t.completed && !!t.deadline && t.deadline < c.now, description: cut(t.description, 200) }));
        },
    },
    {
        module: "company", write: false,
        def: { name: "list_employees", description: "Employees of the company with position, department and their open / overdue task counts (tasks are matched by the responsible name).", parameters: schema({ query: S("name, position or department to look for"), limit: N("max results, default 20, max 50") }) },
        run: async (c, a) => {
            const q = str(a.query, 80);
            const filter: Record<string, unknown> = { owner: c.org };
            if (q) filter.OR = ["firstname", "lastname", "position", "department", "email"].map((k) => ({ [k]: like(q) }));
            const [people, open] = await Promise.all([
                prisma.employee.findMany({ where: filter as any, take: int(a.limit, 20, 1, 50) }),
                prisma.task.findMany({ where: { owner: c.org, completed: false }, select: { responsible: true, deadline: true, title: true } }),
            ]);
            return people.map((p) => {
                const full = `${p.firstname} ${p.lastname}`.toLowerCase();
                const mine = open.filter((t) => [full, String(p.firstname).toLowerCase()].includes(String(t.responsible ?? "").toLowerCase().trim()));
                const overdue = mine.filter((t) => t.deadline && t.deadline < c.now);
                return { id: p.id, name: `${p.firstname} ${p.lastname}`, email: p.email, position: p.position, department: p.department, openTasks: mine.length, overdueTasks: overdue.length, overdueTitles: overdue.slice(0, 5).map((t) => t.title) };
            });
        },
    },
    {
        module: "mail", write: false,
        def: { name: "search_mail", description: "Search e-mails (subject, sender, recipient, text). Newest first. Only short previews; use get_mail for the full text.", parameters: schema({ query: S("text to look for"), folder: { type: "string", enum: ["inbox", "sent"] }, limit: N("max results, default 10, max 20") }) },
        run: async (c, a) => {
            const filter: Record<string, unknown> = { owner: c.org, deleted: false };
            const folder = str(a.folder, 10);
            if (folder === "inbox" || folder === "sent") filter.folder = folder;
            const q = str(a.query, 100);
            if (q) filter.OR = ["subject", "from", "to", "body"].map((k) => ({ [k]: like(q) }));
            const list = await prisma.mailMessage.findMany({ where: filter as any, orderBy: { at: "desc" }, take: int(a.limit, 10, 1, 20) });
            return list.map((m) => ({ id: m.id, folder: m.folder, from: m.from, to: m.to, subject: m.subject, at: new Date(m.at).toISOString(), read: m.read, preview: cut(m.body, 200) }));
        },
    },
    {
        module: "mail", write: false,
        def: { name: "get_mail", description: "Full text of one e-mail.", parameters: schema({ id: S("mail id from search_mail") }, ["id"]) },
        run: async (c, a) => {
            if (!isId(a.id)) throw new ToolError("id must be a mail id");
            const m = await prisma.mailMessage.findFirst({ where: { id: String(a.id), owner: c.org, deleted: false } });
            if (!m) throw new ToolError("E-mail not found");
            return { id: m.id, folder: m.folder, from: m.from, to: m.to, subject: m.subject, at: new Date(m.at).toISOString(), body: cut(m.body, 4000) };
        },
    },
    {
        module: "mail", write: false,
        def: { name: "get_mail_thread", description: "The correspondence with one e-mail address (both directions), oldest first, each message shortened. Use it to summarize a long conversation.", parameters: schema({ email: S("the other person's e-mail address"), limit: N("max messages, default 20, max 40") }, ["email"]) },
        run: async (c, a) => {
            const email = need(str(a.email, 200).toLowerCase(), "email");
            const list = await prisma.mailMessage.findMany({ where: { owner: c.org, deleted: false, OR: [{ from: like(email) }, { to: like(email) }] }, orderBy: { at: "desc" }, take: int(a.limit, 20, 1, 40) });
            return list.reverse().map((m) => ({ id: m.id, direction: m.folder === "sent" ? "we wrote" : "they wrote", subject: m.subject, at: new Date(m.at).toISOString().slice(0, 16), text: cut(m.body, 600) }));
        },
    },
    {
        module: "collab", write: false,
        def: { name: "search_documents", description: "Search uploaded files in Documents by name (not Google Docs/Sheets/Slides — only uploaded files, e.g. PDFs). Use it to find a file's id before read_document.", parameters: schema({ query: S("text in the file name"), limit: N("max results, default 10, max 25") }) },
        run: async (c, a) => {
            const q = str(a.query, 150);
            const filter: Record<string, unknown> = { owner: c.org, kind: "file", archived: false };
            if (q) filter.name = like(q);
            const list = await prisma.docItem.findMany({ where: filter as any, orderBy: { createdAt: "desc" }, take: int(a.limit, 10, 1, 25) });
            return list.map((d) => ({ id: d.id, name: d.name, mime: d.mime, sizeKb: Math.round((d.size ?? 0) / 1024), uploaded: iso(d.createdAt) }));
        },
    },
    {
        module: "collab", write: false,
        def: { name: "read_document", description: "Read the text of an uploaded PDF file (not Google Docs/Sheets/Slides, and not images or other file types — PDF only, for now). Use it to summarize a document or, for an employment contract, to find the employee name, contract type and start date before proposing save_employee_contract.", parameters: schema({ id: S("file id from search_documents") }, ["id"]) },
        run: async (c, a) => {
            if (!isId(a.id)) throw new ToolError("id must be a file id from search_documents");
            const doc = await prisma.docItem.findFirst({ where: { id: String(a.id), owner: c.org, kind: "file" } });
            if (!doc) throw new ToolError("File not found");
            if (doc.mime !== "application/pdf") throw new ToolError(`Only PDF files can be read yet (this file is ${doc.mime || "of an unknown type"})`);
            const res = await getObject(doc.storagePath);
            if (!res) throw new ToolError("The file is missing from storage");
            const { text, pages, truncated } = await extractPdfText(Buffer.from(await res.arrayBuffer()));
            if (!text) throw new ToolError("No text could be found in this PDF (it may be a scanned image without a text layer)");
            return { name: doc.name, pages, truncated, text };
        },
    },

    // ─────────── запись: только после подтверждения пользователем ───────────
    {
        module: "tasks", write: true,
        def: { name: "create_task", description: "Create a task. Needs user confirmation. deadline like 2026-09-30T14:00 or 2026-09-30. responsible is a person's name.", parameters: schema({ title: S("short task title"), deadline: S("date or date-time"), responsible: S("person name"), description: S("details") }, ["title"]) },
        check: (a) => ({ title: need(str(a.title, 200), "title"), deadline: dateTime(a.deadline), responsible: str(a.responsible, 80), description: str(a.description, 500) }),
        run: async (c, a) => {
            const author = await prisma.user.findUnique({ where: { id: c.userId }, select: { firstname: true, lastname: true } });
            const task = await prisma.task.create({
                data: {
                    owner: c.org,
                    title: String(a.title),
                    description: String(a.description ?? ""),
                    deadline: String(a.deadline ?? ""),
                    createdBy: author ? `${author.firstname} ${author.lastname}`.trim() : "",
                    responsible: String(a.responsible || author?.firstname || ""),
                },
            });
            await postTask(c.org, c.userId, task);
            await emit(c.org, { type: "task_created", data: { id: task.id, title: task.title, responsible: task.responsible ?? "" } });
            return { params: { title: String(a.title) }, link: "/crm/tasks" };
        },
    },
    {
        module: "tasks", write: true,
        def: { name: "update_task", description: "Change a task: mark done, move the deadline, change the responsible person or the title. Needs user confirmation.", parameters: schema({ id: S("task id from list_tasks"), completed: { type: "boolean" }, deadline: S("new date or date-time"), responsible: S("person name"), title: S("new title") }, ["id"]) },
        check: (a) => {
            if (!isId(a.id)) throw new ToolError("id must be a task id from list_tasks");
            const out: Args = { id: a.id };
            if (typeof a.completed === "boolean") out.completed = a.completed;
            if (a.deadline !== undefined) out.deadline = dateTime(a.deadline);
            if (a.responsible !== undefined) out.responsible = str(a.responsible, 80);
            if (a.title !== undefined) out.title = need(str(a.title, 200), "title");
            if (Object.keys(out).length < 2) throw new ToolError("Nothing to change");
            return out;
        },
        run: async (c, a) => {
            const { id, ...set } = a;
            const found = await prisma.task.findFirst({ where: { id: String(id), owner: c.org } });
            if (!found) throw new ToolError("Task not found");
            const t = await prisma.task.update({ where: { id: found.id }, data: set as any });
            return { params: { title: t.title }, link: "/crm/tasks" };
        },
    },
    {
        module: "crm", write: true,
        def: { name: "create_deal", description: "Create a deal (lead) on the deals board. Needs user confirmation. stage is a column name (default: the first one).", parameters: schema({ name: S("deal title"), stage: S("stage name"), contact_name: S("contact"), company_name: S("company"), end_date: S("expected close date YYYY-MM-DD"), responsible: S("person name") }, ["name"]) },
        check: (a) => ({ name: need(str(a.name, 200), "name"), stage: str(a.stage, 60), contact_name: str(a.contact_name, 200), company_name: str(a.company_name, 200), end_date: day(a.end_date, "end_date"), responsible: str(a.responsible, 80) }),
        run: async (c, a) => {
            const stages = await ensureStages(c.org);
            const stage = stages.find((s) => s.name.toLowerCase() === String(a.stage).toLowerCase()) ?? stages[0];
            const stageId = String(stage.id);
            const order = await prisma.deal.count({ where: { owner: c.org, stage: stageId } });
            const deal = await prisma.deal.create({
                data: {
                    owner: c.org,
                    stage: stageId,
                    clientName: String(a.name),
                    order,
                    contactName: String(a.contact_name ?? ""),
                    companyName: String(a.company_name ?? ""),
                    endDate: String(a.end_date ?? ""),
                    responsible: String(a.responsible ?? ""),
                    activities: [{ type: "created", text: String(a.name) }] as any,
                },
            });
            await emitDeal(c.org, deal, "deal_created");
            return { params: { name: String(a.name), stage: stage.name }, link: "/crm/crm" };
        },
    },
    {
        module: "crm", write: true,
        def: { name: "create_contact", description: "Create a contact (customer). Needs user confirmation.", parameters: schema({ first_name: S(""), last_name: S(""), email: S(""), phone: S(""), company: S(""), position: S(""), notes: S("") }) },
        // check() должен уметь принять и свои же прежние аргументы: карточку подтверждения /api/ai/actions проверяет заново
        // теми же именами, что вернул этот же check() в чате (firstName), а не именами параметров инструмента (first_name)
        check: (a) => {
            const f = {
                firstName: str(a.first_name ?? a.firstName, 80),
                lastName: str(a.last_name ?? a.lastName, 80),
                email: str(a.email, 200),
                phone: str(a.phone, 60),
                company: str(a.company, 200),
                position: str(a.position, 120),
                notes: str(a.notes, 500),
            };
            if (!contactFullName(f)) throw new ToolError("first_name or last_name is required");
            if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) throw new ToolError("email is not a valid address");
            return f;
        },
        run: async (c, a) => {
            const name = contactFullName(a as Record<string, string>);
            const x = await prisma.contact.create({ data: { ...(a as any), name, owner: c.org } });
            await emit(c.org, { type: "contact_created", data: { id: x.id, name, email: x.email ?? "", phone: x.phone ?? "" } });
            return { params: { name }, link: "/crm/crm" };
        },
    },
    {
        module: "crm", write: true,
        def: { name: "add_note", description: "Add a note to the history of a deal, contact or company. Needs user confirmation.", parameters: schema({ entity: { type: "string", enum: ["deal", "contact", "company"] }, id: S("record id"), text: S("note text") }, ["entity", "id", "text"]) },
        check: (a) => {
            if (!["deal", "contact", "company"].includes(String(a.entity))) throw new ToolError("entity must be deal, contact or company");
            if (!isId(a.id)) throw new ToolError("id must be a record id");
            return { entity: a.entity, id: a.id, text: need(str(a.text, 1000), "text") };
        },
        run: async (c, a) => {
            const entry = { type: "note", text: a.text, meta: "" };
            const id = String(a.id);
            const found =
                a.entity === "deal" ? await prisma.deal.findFirst({ where: { id, owner: c.org } })
                : a.entity === "contact" ? await prisma.contact.findFirst({ where: { id, owner: c.org } })
                : await prisma.company.findFirst({ where: { id, owner: c.org } });
            if (!found) throw new ToolError("Record not found");
            const activities = [...((found.activities as any[]) ?? []), entry];
            if (a.entity === "deal") await prisma.deal.update({ where: { id }, data: { activities: activities as any } });
            else if (a.entity === "contact") await prisma.contact.update({ where: { id }, data: { activities: activities as any } });
            else await prisma.company.update({ where: { id }, data: { activities: activities as any } });
            return { params: { entity: String(a.entity) }, link: "/crm/crm" };
        },
    },
    {
        module: "mail", write: true,
        def: { name: "send_email", description: "Send an e-mail from the firm's connected mailbox. Needs user confirmation; the user can edit the text before sending. Write the body in the recipient's language.", parameters: schema({ to: S("recipient address"), subject: S("subject"), body: S("plain-text body") }, ["to", "subject", "body"]) },
        check: (a) => {
            const to = str(a.to, 200);
            if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(to)) throw new ToolError("to must be a single valid e-mail address");
            return { to, subject: need(str(a.subject, 300), "subject"), body: need(str(a.body, 8000), "body") };
        },
        run: async (c, a) => {
            const box = await prisma.integration.findFirst({ where: { owner: c.org, type: "mail", status: "connected" } });
            if (!box) throw new ToolError("No mailbox is connected. Connect one in Web Mails first.");
            await sendFromAccount(box, { to: String(a.to), subject: String(a.subject), text: String(a.body) });
            // письмо попадает в ленту контакта с такой почтой (если он есть в CRM)
            const card = await prisma.contact.findFirst({ where: { owner: c.org, email: { equals: String(a.to), mode: "insensitive" } } });
            if (card) {
                const activities = [...((card.activities as any[]) ?? []), { type: "email", text: `Email: ${a.subject}`, meta: "" }];
                await prisma.contact.update({ where: { id: card.id }, data: { activities: activities as any } }).catch(() => undefined);
            }
            return { params: { to: String(a.to) }, link: "/crm/collaboration/web-mails" };
        },
    },
    {
        module: "company", write: true,
        def: { name: "save_employee_contract", description: "Save contract fields (read from a document with read_document) to an employee's profile: contract type, start date and a short note. Needs user confirmation. Find the employee first with list_employees.", parameters: schema({ employee_id: S("employee id from list_employees"), contract_type: S("e.g. Full-time, Part-time, Freelance"), start_date: S("date the contract starts, YYYY-MM-DD"), note: S("one-sentence summary of the document") }, ["employee_id"]) },
        // idempotent, как и create_contact выше: принимает и первичные аргументы модели (contract_type), и свой же прежний
        // результат (contractType) — так работает и обычное подтверждение из чата, и прямой вызов /api/ai/actions
        check: (a) => {
            if (!isId(a.employee_id)) throw new ToolError("employee_id must be an employee id from list_employees");
            const out: Args = { employee_id: a.employee_id };
            const contractType = a.contract_type ?? a.contractType;
            const startDate = a.start_date ?? a.contractStart;
            const note = a.note ?? a.contractNote;
            if (contractType !== undefined) out.contractType = str(contractType, 100);
            if (startDate !== undefined) out.contractStart = day(startDate, "start_date");
            if (note !== undefined) out.contractNote = str(note, 500);
            if (Object.keys(out).length < 2) throw new ToolError("Nothing to save: give at least one of contract_type, start_date or note");
            return out;
        },
        run: async (c, a) => {
            const { employee_id, ...set } = a;
            const found = await prisma.employee.findFirst({ where: { id: String(employee_id), owner: c.org } });
            if (!found) throw new ToolError("Employee not found");
            const emp = await prisma.employee.update({ where: { id: found.id }, data: set as any });
            return { params: { name: `${emp.firstname} ${emp.lastname}`.trim() }, link: "/crm/company" };
        },
    },
    // ─────────── навигация и финансовые документы ───────────
    {
        // Переход — не изменение данных, поэтому выполняется сразу, без карточки подтверждения: «открой бухгалтерию»
        // голосом должно просто открыть её. Раздел, на который у человека нет прав, не открываем.
        module: null, write: false,
        def: { name: "navigate", description: "Open a CRM page now, no confirmation. Sections as in the sidebar: dashboard (home page, «главная»), crm (the CRM section with the deals board — «перейди в CRM / CRM / воронка»), contacts and companies (tabs of CRM; «клиенты» = contacts), tasks, my_company/employees, feed, calendar, chat, mails, documents, finance (accounting), marketing, automation, settings. Finance also takes a tab and, on invoices, a filter (unpaid = «незакрытые счета»). If the user says only «CRM» go to crm, NOT dashboard.", parameters: schema({
            section: { type: "string", enum: Object.keys(NAV_SECTIONS), description: "target section key" },
            tab: { type: "string", enum: [...FINANCE_TABS], description: "finance only: tab to open" },
            filter: { type: "string", enum: [...INVOICE_FILTERS], description: "finance → invoices only: which invoices to show" },
        }, ["section"]) },
        check: (a) => {
            const section = str(a.section, 40);
            if (!NAV_SECTIONS[section]) throw new ToolError("Unknown section. Choose one of: " + Object.keys(NAV_SECTIONS).join(", "));
            const out: Args = { section };
            const tab = str(a.tab, 20);
            const filter = str(a.filter ?? a.status, 20);
            if (section === "finance") {
                if (tab && !(FINANCE_TABS as readonly string[]).includes(tab)) throw new ToolError("Unknown finance tab. Choose one of: " + FINANCE_TABS.join(", "));
                if (filter && !(INVOICE_FILTERS as readonly string[]).includes(filter)) throw new ToolError("Unknown invoice filter. Choose one of: " + INVOICE_FILTERS.join(", "));
                if (filter) { out.tab = tab && tab !== "invoices" ? tab : "invoices"; if (out.tab === "invoices") out.filter = filter; }
                else if (tab) out.tab = tab;
            }
            return out;
        },
        run: async (c, a) => {
            const sec = NAV_SECTIONS[a.section as string];
            if (!canAccess(c.role, c.modules, sec.module, "GET")) throw new ToolError("The user has no access to this section");
            const q = new URLSearchParams();
            if (a.tab) q.set("tab", String(a.tab));
            if (a.filter) q.set("status", String(a.filter));
            const qs = q.toString();
            const link = qs ? `${sec.link}${sec.link.includes("?") ? "&" : "?"}${qs}` : sec.link;
            const nav: NavTarget = { link, label: sec.label };
            return { opened: sec.label, tab: a.tab ?? undefined, filter: a.filter ?? undefined, _nav: nav };
        },
    },
    {
        module: "inventory", write: true,
        def: { name: "create_invoice", description: "Create a draft invoice for a customer. Needs user confirmation; the user can edit fields before confirming. Pass the customer name in customer_name — a matching contact is linked or created automatically, no need to search first.", parameters: schema({ customer_name: S("customer/company name that appears on the invoice"), contact_name: S("contact id, optional"), items: ITEMS, currency: S("EUR, UAH, USD… optional"), notes: S("notes, optional") }, ["customer_name", "items"]) },
        check: financeCheck,
        run: async (c, a) => {
            const settings = await financeSettings(c.org);
            const items = applyTaxPolicy(cleanItems(a.items as never), settings);
            const number = await nextNumber(c.org, await numberPrefix(c.org, "invoice", settings.invoicePrefix || "RE"));
            const today = new Date().toISOString().slice(0, 10);
            const due = new Date(Date.now() + (settings.paymentTermsDays ?? 14) * 86400000).toISOString().slice(0, 10);
            const currency = String(a.currency).toUpperCase() || (await defaultCurrency(c.org));
            const customerName = String(a.customer_name);
            const linkedContact = (a.contact_name ? await ownedContact(a.contact_name, c.org) : null) || (await contactForCustomer(c.org, { contact: a.contact_name, customerName }));
            const invoice = await prisma.invoice.create({
                data: {
                    org: c.org, number, kind: "invoice", customerName, items: items as any,
                    contact: linkedContact ?? undefined,
                    deal: (await dealForCustomer(c.org, linkedContact, undefined, customerName)) ?? undefined,
                    currency, rate: (await snapshotRate(c.org, currency)) as any,
                    smallBusinessNote: taxExempt(settings),
                    issueDate: today, dueDate: due, notes: String(a.notes || ""),
                    createdByName: await authorName(c.userId),
                },
            });
            return { params: { number: invoice.number, customerName: invoice.customerName }, link: "/crm/finance" };
        },
    },
    {
        module: "inventory", write: true,
        def: { name: "create_quote", description: "Create a draft quote (offer, proposal) for a customer. Needs user confirmation. Pass the customer name in customer_name — a matching contact is linked or created automatically, no need to search first.", parameters: schema({ customer_name: S("customer/company name"), contact_name: S("contact id, optional"), items: ITEMS, currency: S("EUR, UAH… optional"), notes: S("notes, optional") }, ["customer_name", "items"]) },
        check: financeCheck,
        run: async (c, a) => {
            const settings = await financeSettings(c.org);
            const items = applyTaxPolicy(cleanItems(a.items as never), settings);
            const number = await nextNumber(c.org, await numberPrefix(c.org, "quote", settings.quotePrefix || "AN"));
            const today = new Date().toISOString().slice(0, 10);
            const currency = String(a.currency).toUpperCase() || (await defaultCurrency(c.org));
            const customerName = String(a.customer_name);
            const linkedContact = (a.contact_name ? await ownedContact(a.contact_name, c.org) : null) || (await contactForCustomer(c.org, { contact: a.contact_name, customerName }));
            const quote = await prisma.quote.create({
                data: {
                    org: c.org, number, customerName, items: items as any,
                    contact: linkedContact ?? undefined,
                    deal: (await dealForCustomer(c.org, linkedContact, undefined, customerName)) ?? undefined,
                    currency, issueDate: today,
                    validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                    notes: String(a.notes || ""), createdByName: await authorName(c.userId),
                },
            });
            return { params: { number: quote.number, customerName: quote.customerName }, link: "/crm/finance" };
        },
    },
    {
        module: "inventory", write: true,
        def: { name: "create_order", description: "Create a draft order for a customer. Needs user confirmation. Pass the customer name in customer_name — a matching contact is linked or created automatically, no need to search first.", parameters: schema({ customer_name: S("customer/company name"), contact_name: S("contact id, optional"), items: ITEMS, currency: S("EUR, UAH… optional"), notes: S("notes, optional") }, ["customer_name", "items"]) },
        check: financeCheck,
        run: async (c, a) => {
            const settings = await financeSettings(c.org);
            const items = applyTaxPolicy(cleanItems(a.items as never), settings);
            const number = await nextNumber(c.org, "SO");
            const currency = String(a.currency).toUpperCase() || (await defaultCurrency(c.org));
            const customerName = String(a.customer_name);
            const linkedContact = (a.contact_name ? await ownedContact(a.contact_name, c.org) : null) || (await contactForCustomer(c.org, { contact: a.contact_name, customerName }));
            const order = await prisma.order.create({
                data: {
                    org: c.org, number, customerName, items: items as any,
                    contact: linkedContact ?? undefined,
                    deal: (await dealForCustomer(c.org, linkedContact, undefined, customerName)) ?? undefined,
                    currency, rate: (await snapshotRate(c.org, currency)) as any,
                    notes: String(a.notes || ""), createdByName: await authorName(c.userId),
                },
            });
            return { params: { number: order.number, customerName: order.customerName }, link: "/crm/finance" };
        },
    },
    {
        module: "inventory", write: true,
        def: { name: "create_contract", description: "Create a draft contract for a customer. Needs user confirmation. Pass the customer name in customer_name — a matching contact is linked or created automatically, no need to search first; value is the total contract amount.", parameters: schema({ customer_name: S("customer/company name"), contact_name: S("contact id, optional"), value: N("total contract amount"), currency: S("EUR, UAH… optional"), start_date: S("YYYY-MM-DD, optional"), end_date: S("YYYY-MM-DD, optional"), notes: S("notes, optional") }, ["customer_name"]) },
        check: (a) => ({
            customer_name: need(str(a.customer_name, 200), "customer_name"),
            contact_name: str(a.contact_name ?? a.contact, 40),
            value: Math.max(0, Number(a.value) || 0),
            currency: str(a.currency, 6),
            start_date: day(a.start_date, "start_date"),
            end_date: day(a.end_date, "end_date"),
            notes: str(a.notes, 500),
        }),
        run: async (c, a) => {
            const number = await nextNumber(c.org, "CT");
            const currency = String(a.currency).toUpperCase() || (await defaultCurrency(c.org));
            const customerName = String(a.customer_name);
            const linkedContact = (a.contact_name ? await ownedContact(a.contact_name, c.org) : null) || (await contactForCustomer(c.org, { contact: a.contact_name, customerName }));
            const contract = await prisma.contract.create({
                data: {
                    org: c.org, number, customerName,
                    contact: linkedContact ?? undefined,
                    deal: (await dealForCustomer(c.org, linkedContact, undefined, customerName)) ?? undefined,
                    value: Number(a.value) || 0, currency,
                    startDate: String(a.start_date || ""), endDate: String(a.end_date || ""),
                    notes: String(a.notes || ""), createdByName: await authorName(c.userId),
                },
            });
            return { params: { number: contract.number, customerName: contract.customerName }, link: "/crm/finance" };
        },
    },
    // ─────────── бухгалтерия: чтение для голосовых вопросов («какие счета не закрыты?») ───────────
    {
        module: "inventory", write: false,
        def: { name: "list_invoices", description: "Invoices of the firm with amounts and due dates. filter: unpaid (sent or overdue — not paid yet; default), overdue (due date passed), draft, sent, paid, all. Returns each invoice (number, customer, total, still open, due date, days overdue) and the totals per currency. Use it for «какие счета не закрыты / просрочены / кто нам должен».", parameters: schema({ filter: { type: "string", enum: [...INVOICE_FILTERS] }, customer: S("part of the customer name"), sort: { type: "string", enum: ["due", "newest"], description: "due = by due date (default); newest = most recently issued first — use it with filter all and limit 1 for «the last / latest invoice»" }, limit: N("max invoices, default 15, max 40") }) },
        run: (c, a) => listInvoicesData(c, a),
    },
    {
        module: "inventory", write: false,
        def: { name: "finance_summary", description: "Quick accounting overview: number and amount of unpaid and overdue invoices, income received and expenses this month (per currency).", parameters: schema({}) },
        run: async (c) => {
            const month = c.today.slice(0, 7);
            const [open, paid, spent] = await Promise.all([
                prisma.invoice.findMany({ where: { org: c.org, kind: "invoice", status: { in: ["sent", "overdue"] } }, select: { items: true, paidAmount: true, currency: true, dueDate: true, status: true } }),
                prisma.invoice.findMany({ where: { org: c.org, kind: "invoice", status: "paid", paidAt: { gte: new Date(`${month}-01T00:00:00Z`) } }, select: { items: true, currency: true } }),
                prisma.expense.findMany({ where: { org: c.org, date: { gte: `${month}-01` } }, select: { amount: true, currency: true } }),
            ]);
            const add = (m: Record<string, number>, cur: string, v: number) => { m[cur] = Math.round(((m[cur] ?? 0) + v) * 100) / 100; };
            const unpaid: Record<string, number> = {}, overdue: Record<string, number> = {}, income: Record<string, number> = {}, expenses: Record<string, number> = {};
            let overdueCount = 0;
            for (const i of open) {
                const left = Math.max(0, computeTotals(i.items as never).gross - (i.paidAmount ?? 0));
                add(unpaid, i.currency, left);
                if (i.status === "overdue" || (i.dueDate && i.dueDate < c.today)) { overdueCount++; add(overdue, i.currency, left); }
            }
            for (const i of paid) add(income, i.currency, computeTotals(i.items as never).gross);
            for (const e of spent) add(expenses, e.currency, e.amount);
            return { unpaidCount: open.length, unpaidByCurrency: unpaid, overdueCount, overdueByCurrency: overdue, receivedThisMonth: income, expensesThisMonth: expenses };
        },
    },
    {
        module: "inventory", write: false,
        def: { name: "list_expenses", description: "Expenses (costs paid by the firm) in a period, newest first, with the total per currency.", parameters: schema({ from: S("start date YYYY-MM-DD, optional"), to: S("end date YYYY-MM-DD, optional"), query: S("part of the vendor name or category"), limit: N("max results, default 15, max 40") }) },
        run: async (c, a) => {
            const where: Record<string, unknown> = { org: c.org };
            const from = day(a.from, "from"), to = day(a.to, "to");
            if (from || to) where.date = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
            const q = str(a.query, 100);
            if (q) where.OR = [{ vendor: like(q) }, { category: like(q) }];
            const rows = await prisma.expense.findMany({ where: where as any, orderBy: { date: "desc" }, take: 500 });
            const sums: Record<string, number> = {};
            for (const e of rows) sums[e.currency] = Math.round(((sums[e.currency] ?? 0) + e.amount) * 100) / 100;
            return { count: rows.length, totalByCurrency: sums, expenses: rows.slice(0, int(a.limit, 15, 1, 40)).map((e) => ({ vendor: e.vendor, category: e.category, amount: e.amount, currency: e.currency, date: e.date, notes: cut(e.notes, 100) })) };
        },
    },
    // ─────────── чтение остальных разделов: склад, заказы, поставщики, банк, календарь, чаты… ───────────
    {
        module: "inventory", write: false,
        def: { name: "list_products", description: "Products and stock levels (warehouse). filter: low_stock (running out: at or below the reorder level, or out of stock — default), out_of_stock, all. Returns the counts and the products with current stock, unit and reorder level. Use it for «что заканчивается на складе / какие остатки / есть ли товар X».", parameters: schema({ filter: { type: "string", enum: ["low_stock", "out_of_stock", "all"] }, query: S("part of the product name, SKU or barcode"), limit: N("max products, default 15, max 40") }) },
        run: async (c, a) => { try { return await listProducts(c, a); } catch (e) { throw e instanceof BrowseError ? new ToolError(e.message) : e; } },
    },
    {
        // Раздел проверяется внутри — по сущности; так один инструмент закрывает все страницы кабинета
        module: null, write: false,
        def: { name: "browse_data", description: `Read records of other CRM pages: ${ENTITY_KEYS.join(", ")} (section_records needs key like automation:rules). Optional query, from/to dates, limit. Returns the count and records with ids.`, parameters: schema({ entity: { type: "string", enum: ENTITY_KEYS }, query: S("text to look for"), from: S("start date YYYY-MM-DD"), to: S("end date YYYY-MM-DD"), key: S("only for section_records, e.g. automation:rules"), limit: N("max records, default 15, max 40") }, ["entity"]) },
        run: async (c, a) => { try { return await browse(c, a); } catch (e) { throw e instanceof BrowseError ? new ToolError(e.message) : e; } },
    },
    // ─────────── запись: расходы, компании, этапы сделок ───────────
    {
        module: "inventory", write: true,
        def: { name: "create_expense", description: "Record an expense (a cost the firm paid): vendor, amount, optional category, date and note. Needs user confirmation.", parameters: schema({ vendor: S("who was paid"), amount: { type: "number", description: "amount paid, gross" }, currency: S("EUR, UAH… optional"), category: S("category, optional"), date: S("YYYY-MM-DD, default today"), notes: S("note, optional") }, ["vendor", "amount"]) },
        check: (a) => {
            const amount = Number(a.amount);
            if (!Number.isFinite(amount) || amount <= 0) throw new ToolError("amount must be a positive number");
            return { vendor: need(str(a.vendor, 200), "vendor"), amount: Math.round(amount * 100) / 100, currency: str(a.currency, 6).toUpperCase(), category: str(a.category, 100), date: day(a.date, "date"), notes: str(a.notes, 500) };
        },
        run: async (c, a) => {
            const e = await prisma.expense.create({
                data: {
                    org: c.org, vendor: String(a.vendor), amount: Number(a.amount), category: String(a.category || ""), date: String(a.date || c.today),
                    currency: String(a.currency) || (await defaultCurrency(c.org)), notes: String(a.notes || ""), createdByName: await authorName(c.userId),
                },
            });
            return { params: { vendor: e.vendor, amount: `${e.amount} ${e.currency}` }, link: "/crm/finance?tab=expenses" };
        },
    },
    {
        module: "crm", write: true,
        def: { name: "create_company", description: "Create a company (legal entity, business customer) in the CRM. Needs user confirmation. Search first (search_companies) so you do not create a duplicate.", parameters: schema({ name: S("company name"), email: S("e-mail, optional"), field: S("field of business, optional"), address: S("address, optional") }, ["name"]) },
        check: (a) => {
            const f = { name: need(str(a.name, 200), "name"), email: str(a.email, 200), field: str(a.field, 200), address: str(a.address, 300) };
            if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) throw new ToolError("email is not a valid address");
            return f;
        },
        run: async (c, a) => {
            const x = await prisma.company.create({ data: { ...(a as any), owner: c.org } });
            return { params: { name: x.name }, link: "/crm/crm" };
        },
    },
    {
        module: "crm", write: true,
        def: { name: "update_deal_stage", description: "Move a deal to another stage (column) of the deals board. Needs user confirmation. Find the deal with list_deals and the stage names with list_stages first.", parameters: schema({ id: S("deal id from list_deals"), stage: S("target stage name") }, ["id", "stage"]) },
        check: (a) => {
            if (!isId(a.id)) throw new ToolError("id must be a deal id from list_deals");
            return { id: a.id, stage: need(str(a.stage, 60), "stage") };
        },
        run: async (c, a) => {
            const stages = await ensureStages(c.org);
            const want = String(a.stage).toLowerCase();
            const stage = stages.find((s) => s.name.toLowerCase() === want) ?? stages.find((s) => s.name.toLowerCase().includes(want));
            if (!stage) throw new ToolError(`No stage matches "${a.stage}". Stages: ${stages.map((s) => s.name).join(", ")}`);
            const deal = await prisma.deal.findFirst({ where: { id: String(a.id), owner: c.org } });
            if (!deal) throw new ToolError("Deal not found");
            const stageId = String(stage._id);
            if (deal.stage !== stageId) {
                const activities = Array.isArray(deal.activities) ? [...(deal.activities as any[])] : [];
                activities.push(mkActivity("stage", stage.name));
                const updated = await prisma.deal.update({ where: { id: deal.id }, data: { stage: stageId, wonAt: null, activities: activities as any } });
                await emitDeal(c.org, toDTO(updated), "deal_stage");
            }
            return { params: { name: deal.clientName, stage: stage.name }, link: "/crm/crm" };
        },
    },
    // ─────────── документы, оплата, чеки ───────────
    {
        module: "inventory", write: false,
        def: { name: "download_document", description: "Download (save as a PDF file) or open for viewing/printing an invoice, quote, order, contract or purchase order (order to a supplier) by its number, e.g. «скачай счёт RE-2026-5». Works right away, no confirmation. Numbers spoken in Cyrillic («РЕ-2026-5») are matched to the Latin ones.", parameters: schema({ kind: { type: "string", enum: ["invoice", "quote", "order", "contract", "purchase_order"] }, number: S("document number, e.g. RE-2026-5 or ЗП-2026-3 for a purchase order"), mode: { type: "string", enum: ["download", "open"], description: "download (default) or open for viewing/printing" } }, ["kind", "number"]) },
        check: (a) => {
            if (!["invoice", "quote", "order", "contract", "purchase_order"].includes(String(a.kind))) throw new ToolError("kind must be invoice, quote, order, contract or purchase_order");
            return { kind: a.kind, number: need(str(a.number, 40), "number"), mode: a.mode === "open" ? "open" : "download" };
        },
        run: (c, a) => wrap(async () => {
            const doc = await findDocument(c.org, a.kind as DocKind, String(a.number));
            const kind = ({ invoice: "invoices", quote: "quotes", order: "orders", contract: "contracts", purchase_order: "purchases" } as const)[a.kind as DocKind];
            const dl: DownloadTarget = { kind, id: doc.id, number: doc.number, mode: a.mode === "open" ? "open" : "download" };
            return { prepared: doc.number, _download: dl };
        }),
    },
    {
        module: "inventory", write: true,
        def: { name: "mark_invoice_paid", description: "Mark an invoice as paid (fully, or partially with amount) — money received. Needs user confirmation. Identify the invoice by its number.", parameters: schema({ number: S("invoice number"), amount: { type: "number", description: "amount received; omit for the full amount" } }, ["number"]) },
        check: (a) => ({ number: need(str(a.number, 40), "number"), ...(Number(a.amount) > 0 ? { amount: Math.round(Number(a.amount) * 100) / 100 } : {}) }),
        run: (c, a) => wrap(async () => { const r = await markPaid({ org: c.org, userId: c.userId }, String(a.number), a.amount as number | undefined); return { params: { number: r.number, customerName: r.customerName }, link: "/crm/finance?tab=invoices" }; }),
    },
    {
        module: "inventory", write: true,
        def: { name: "send_invoice", description: "E-mail a draft invoice (with the PDF) to the customer from the firm's mailbox and mark it as sent. Needs user confirmation. Uses the customer's saved e-mail unless to is given.", parameters: schema({ number: S("invoice number"), to: S("recipient e-mail, optional") }, ["number"]) },
        check: (a) => {
            const to = str(a.to, 200);
            if (to && !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(to)) throw new ToolError("to must be a single valid e-mail address");
            return { number: need(str(a.number, 40), "number"), ...(to ? { to } : {}) };
        },
        run: (c, a) => wrap(async () => { const r = await sendInvoice({ org: c.org, userId: c.userId }, String(a.number), a.to ? String(a.to) : undefined); return { params: { number: r.number, to: r.to }, link: "/crm/finance?tab=invoices" }; }),
    },
    {
        module: "inventory", write: true,
        def: { name: "issue_fiscal_receipt", description: "Print a fiscal cash receipt (PRRO / Checkbox, Ukraine only) for an invoice. Needs user confirmation. pay_type: CASH or CARD.", parameters: schema({ number: S("invoice number"), pay_type: { type: "string", enum: ["CASH", "CARD"] } }, ["number"]) },
        check: (a) => ({ number: need(str(a.number, 40), "number"), ...(a.pay_type === "CASH" || a.pay_type === "CARD" ? { pay_type: a.pay_type } : {}) }),
        run: (c, a) => wrap(async () => { const r = await fiscalReceipt({ org: c.org, userId: c.userId }, String(a.number), a.pay_type as "CASH" | "CARD" | undefined); return { params: { number: r.number, code: r.code }, link: "/crm/finance?tab=invoices" }; }),
    },
    {
        module: null, write: false,
        def: { name: "scroll_page", description: "Scroll the page (or the open card/window) on the user's screen: down, up, to the top or to the very bottom. Use it when the user says «прокрути вниз», «покажи ниже», «что там дальше», or when something is cut off on screen. pages = how many screens to scroll (default 0.8).", parameters: schema({ direction: { type: "string", enum: ["down", "up", "top", "bottom"] }, pages: { type: "number", description: "screens to scroll, default 0.8" } }, ["direction"]) },
        check: (a) => {
            if (!["down", "up", "top", "bottom"].includes(String(a.direction))) throw new ToolError("direction must be down, up, top or bottom");
            return { direction: a.direction, pages: Math.min(10, Math.max(0.2, Number(a.pages) || 0.8)) };
        },
        run: async (_c, a) => { const sc: ScrollTarget = { dir: a.direction as ScrollTarget["dir"], pages: Number(a.pages) || 0.8 }; return { scrolled: sc.dir, _scroll: sc }; },
    },
    {
        module: null, write: false,
        def: { name: "queue_tasks", description: "Use when the user's message contains TWO OR MORE separate things to do (a long message listing several tasks). Call it ONCE with each task as a separate, self-contained instruction in the original order (keep names, numbers, dates; resolve «it/that» to the actual thing). Do not do the tasks yourself — they run one by one in the background and the user gets each result as it is ready. Do NOT use it for a single task or for one task with several details.", parameters: schema({ tasks: { type: "array", description: "the tasks, in order", items: { type: "string" } } }, ["tasks"]) },
        check: (a) => {
            const tasks = (Array.isArray(a.tasks) ? a.tasks : []).map((t) => str(t, 600)).filter(Boolean).slice(0, 12);
            if (tasks.length < 2) throw new ToolError("queue_tasks needs at least two tasks — for a single task just do it");
            return { tasks };
        },
        run: async (_c, a) => ({ queued: (a.tasks as string[]).length, _queue: a.tasks }),
    },
    // ─────────── запросы внешних агентов ───────────
    {
        module: null, write: false,
        def: { name: "list_agent_requests", description: "Changes that connected external agents/bots (Settings → Integrations → Connect an agent) proposed and that wait for the owner's approval. Use it for «что просят агенты», «есть запросы от ботов».", parameters: schema({}) },
        run: async (c) => {
            if (c.role !== "owner" && c.role !== "admin") throw new ToolError("Only the owner or an administrator can see agent requests");
            return { requests: (await listRequests(c.org)).map((r) => ({ id: r.id, agent: r.agent, tool: r.tool, target: r.target, at: r.at.slice(0, 16).replace("T", " "), args: r.args })) };
        },
    },
    {
        module: null, write: true,
        def: { name: "decide_agent_request", description: "Approve (runs the change) or reject a change proposed by a connected agent. id comes from list_agent_requests. Owner/admin only.", parameters: schema({ id: S("request id"), approve: { type: "boolean", description: "true = approve and run, false = reject" }, summary: S("what the agent wants, for the confirmation card") }, ["id", "approve"]) },
        check: (a) => ({ id: need(str(a.id, 40), "id"), approve: a.approve !== false, summary: str(a.summary, 120) }),
        run: (c, a) => wrap(async () => {
            if (c.role !== "owner" && c.role !== "admin") throw new ToolError("Only the owner or an administrator can decide agent requests");
            const r = await decideRequest(c, String(a.id), a.approve === true);
            if (!r.done) throw new ToolError(r.message);
            return { params: { result: r.message }, link: "/crm/settings/integration" };
        }),
    },
    // ─────────── блог лендинга: черновики от агентов ───────────
    {
        module: null, write: false,
        def: { name: "list_blog_posts", description: "Articles of the landing-page blog including drafts written by agents (slug, status, title). Platform administrators only. Use it for «какие статьи написал агент», «есть ли черновики».", parameters: schema({ drafts_only: { type: "boolean" } }) },
        run: async (c, a) => {
            const me = await prisma.user.findUnique({ where: { id: c.userId } });
            if (!(await isPlatformAdminUser(me as never))) throw new ToolError("Only a platform administrator can manage the blog");
            const rows = await prisma.blogPost.findMany({ where: a.drafts_only === true ? { published: false } : {}, orderBy: { createdAt: "desc" }, take: 30 });
            return { posts: rows.map((p) => ({ slug: p.slug, published: p.published, title: (p.title as { en?: string } | null)?.en ?? "", created: p.createdAt.toISOString().slice(0, 10) })) };
        },
    },
    {
        module: null, write: true,
        def: { name: "publish_blog_post", description: "Publish a blog draft (written by an agent) on the landing page, or take a published article back to draft (publish = false). Platform administrators only. Needs user confirmation unless auto mode is on. slug comes from list_blog_posts.", parameters: schema({ slug: S("article slug"), publish: { type: "boolean", description: "true = publish (default), false = back to draft" } }, ["slug"]) },
        check: (a) => ({ slug: need(str(a.slug, 80), "slug"), publish: a.publish !== false }),
        run: (c, a) => wrap(async () => {
            const me = await prisma.user.findUnique({ where: { id: c.userId } });
            if (!(await isPlatformAdminUser(me as never))) throw new ToolError("Only a platform administrator can manage the blog");
            const post = await prisma.blogPost.findUnique({ where: { slug: String(a.slug) } });
            if (!post) throw new ToolError("No article with this slug");
            await prisma.blogPost.update({ where: { slug: post.slug }, data: { published: a.publish === true, ...(a.publish === true && !post.published ? { publishedAt: new Date() } : {}) } });
            return { params: { title: (post.title as { en?: string } | null)?.en ?? post.slug, state: a.publish === true ? "published" : "draft" }, link: `/blog/${post.slug}` };
        }),
    },
    // ─────────── отбор потенциальных клиентов ───────────
    {
        module: "crm", write: false,
        def: { name: "analyze_leads", description: "Bulk-analyse existing records and decide which are POTENTIAL CUSTOMERS and which are junk (newsletters, notifications, invoices from vendors, sales pitches to us, spam, empty). scope: deals (cards on the kanban), contacts, companies, mail (inbox, last 30 days), conversations (chats and calls). Returns counts and the junk/unsure items with ids and reasons. Read-only — to delete junk afterwards use cleanup_leads. Use it for «разбери канбан», «проверь контакты на мусор», «какие письма не клиенты».", parameters: schema({ scope: { type: "string", enum: [...LEAD_SCOPES] }, limit: N("how many newest records to check, default 40, max 80") }, ["scope"]) },
        check: (a) => {
            if (!(LEAD_SCOPES as readonly string[]).includes(String(a.scope))) throw new ToolError("scope must be one of: " + LEAD_SCOPES.join(", "));
            return { scope: a.scope, limit: int(a.limit, 40, 5, 80) };
        },
        run: async (c, a) => wrap(async () => { const org = await prisma.organization.findUnique({ where: { id: c.org }, select: { name: true } }); return analyzeLeads(c.org, org?.name ?? "", a.scope as (typeof LEAD_SCOPES)[number], a.limit); }),
    },
    {
        module: "crm", write: false,
        def: { name: "lead_log", description: "What the automatic lead filter decided recently and why: which incoming e-mails/chats became leads and which were filtered out (junk / unsure), plus the company's own lead rules. Use it for «что ты отсеяла», «почему это письмо не попало в канбан».", parameters: schema({ verdict: { type: "string", enum: ["lead", "junk", "unsure"] }, limit: N("max entries, default 15") }) },
        run: (c, a) => wrap(async () => leadLog(c.org, a.verdict, a.limit)),
    },
    {
        module: "crm", write: true,
        def: { name: "restore_lead", description: "Put an item the filter rejected back into the pipeline (creates the contact and a card in the first column). id comes from lead_log. Needs user confirmation unless auto mode is on.", parameters: schema({ id: S("log entry id from lead_log"), name: S("who it is, for the confirmation card") }, ["id"]) },
        check: (a) => ({ id: need(str(a.id, 40), "id"), name: str(a.name, 80) }),
        run: (c, a) => wrap(async () => { const r = await restoreLead(c.org, String(a.id)); return { params: { name: r.name }, link: "/crm/crm" }; }),
    },
    {
        module: "crm", write: true,
        def: { name: "cleanup_leads", description: "Delete junk cards/contacts/companies found by analyze_leads (pass their ids; up to 100). ALWAYS asks the user first, even in auto mode. entity: deal, contact or company.", parameters: schema({ entity: { type: "string", enum: ["deal", "contact", "company"] }, ids: { type: "array", items: { type: "string" }, description: "ids from analyze_leads" }, note: S("what is being removed, for the confirmation card") }, ["entity", "ids"]) },
        check: (a) => {
            if (!["deal", "contact", "company"].includes(String(a.entity))) throw new ToolError("entity must be deal, contact or company");
            const ids = (Array.isArray(a.ids) ? a.ids : []).map((x) => str(x, 40)).filter(isId).slice(0, 100);
            if (!ids.length) throw new ToolError("ids must contain at least one record id");
            return { entity: a.entity, ids, note: str(a.note, 120) };
        },
        run: (c, a) => wrap(async () => { const r = await cleanupLeads(c.org, c.userId, a.entity as "deal" | "contact" | "company", a.ids as string[]); return { params: { count: String(r.count), entity: String(a.entity) }, link: "/crm/crm" }; }),
    },
    {
        module: "crm", write: true,
        def: { name: "set_lead_rules", description: "Save the company's own rules for what counts as a potential customer, in plain words (e.g. «клиент — только тот, кто спрашивает про ремонт ноутбуков; заказы от посредников не берём»). They are added to the filter for all future incoming mail and chats. Replaces the previous rules; empty text clears them. Needs user confirmation unless auto mode is on.", parameters: schema({ text: S("the rules, empty to clear") }, ["text"]) },
        check: (a) => ({ text: str(a.text, 1500) }),
        run: (c, a) => wrap(async () => { await saveRules(c.org, String(a.text)); return { params: { rules: String(a.text).slice(0, 80) || "—" }, link: "/crm/crm" }; }),
    },
    // ─────────── память Айрис и карточки CRM ───────────
    {
        // Запоминание — не изменение данных CRM, поэтому без подтверждения и в любом режиме
        module: null, write: false,
        def: { name: "remember", description: "Save something the user taught you so you do not ask again: how they name things, how they want something done, preferences, corrections. Call it IMMEDIATELY and silently whenever the user explains or corrects you (e.g. «перейди в CRM — это раздел CRM, а не главная»), without asking permission. One short rule per call, in the user's words, self-contained.", parameters: schema({ text: S("the rule or fact to remember, e.g. «“CRM” means the CRM section (deals board), not the dashboard»") }, ["text"]) },
        check: (a) => ({ text: need(str(a.text, 400), "text") }),
        run: (c, a) => wrap(async () => { const r = await remember(c.org, c.userId, String(a.text)); return { remembered: r.text, new: r.saved }; }),
    },
    {
        module: null, write: false,
        def: { name: "forget", description: "Remove something from your memory when the user says to forget it or it is wrong. Give a few words of the memory or its id.", parameters: schema({ text: S("words from the memory item, or its id") }, ["text"]) },
        check: (a) => ({ text: need(str(a.text, 200), "text") }),
        run: (c, a) => wrap(async () => forget(c.org, c.userId, String(a.text))),
    },
    {
        module: null, write: false,
        def: { name: "list_memory", description: "Show what you have remembered about this user («что ты помнишь»).", parameters: schema({}) },
        run: async (c) => ({ memory: (await loadMemory(c.org, c.userId)).map((m) => ({ id: m.id, text: m.text })) }),
    },
    {
        module: "crm", write: false,
        def: { name: "open_record", description: "Open the card of a deal, contact or company on screen so the user can SEE it («открой карточку», «покажи что внутри»). Works right away, nothing to click. Give the id from search/list tools, or just the name.", parameters: schema({ entity: { type: "string", enum: ["deal", "contact", "company"] }, id: S("record id, optional"), name: S("name to look for if no id") }, ["entity"]) },
        check: (a) => {
            if (!["deal", "contact", "company"].includes(String(a.entity))) throw new ToolError("entity must be deal, contact or company");
            return { entity: a.entity, id: str(a.id, 40), name: str(a.name, 120) };
        },
        run: (c, a) => wrap(async () => {
            const e = a.entity as Entity;
            const row = await resolveRecord(c.org, e, { id: a.id, name: a.name });
            const nav: NavTarget = { link: recordLink(e, row.id), label: titleOf(e, row) };
            return { opened: nav.label, entity: e, _nav: nav };
        }),
    },
    {
        module: "crm", write: true,
        def: { name: "update_deal", description: "Fill in or change fields of a deal card: title, contactName, companyName, startDate, endDate (YYYY-MM-DD), dealType, responsible, utm, recurring. Identify the deal by id or name. Only pass the fields to change.", parameters: schema({ id: S("deal id, optional"), name: S("deal name if no id"), title: S("new deal title"), contactName: S("contact name"), companyName: S("company name"), startDate: S("start date"), endDate: S("end date"), dealType: S("deal type"), responsible: S("responsible person"), utm: S("utm"), recurring: S("recurring") }) },
        check: (a) => recordEditCheck(a, DEAL_EDITABLE as readonly string[]),
        run: (c, a) => wrap(async () => { const r = await updateRecord(c.org, "deal", { id: a.id, name: a.name }, a); return { params: { name: r.title, fields: r.changed.join(", ") }, link: recordLink("deal", r.id) }; }),
    },
    {
        module: "crm", write: true,
        def: { name: "update_contact", description: "Fill in or change fields of a contact card: firstName, lastName, email, phone, company, position, website, twitter, facebook, notes. Identify the contact by id or name. Only pass the fields to change.", parameters: schema({ id: S("contact id, optional"), name: S("contact name if no id"), firstName: S("first name"), lastName: S("last name"), email: S("e-mail"), phone: S("phone"), company: S("company name"), position: S("position"), website: S("website"), twitter: S("twitter"), facebook: S("facebook"), notes: S("notes (free text)") }) },
        check: (a) => recordEditCheck(a, CONTACT_EDITABLE as readonly string[]),
        run: (c, a) => wrap(async () => { const r = await updateRecord(c.org, "contact", { id: a.id, name: a.name }, a); return { params: { name: r.title, fields: r.changed.join(", ") }, link: recordLink("contact", r.id) }; }),
    },
    {
        module: "crm", write: true,
        def: { name: "update_company", description: "Fill in or change fields of a company card: name, email, field, status, code, registrationDate, authorisedPerson, businessType, ownershipForm, address. Identify the company by id or name. Only pass the fields to change.", parameters: schema({ id: S("company id, optional"), lookup: S("company name to find if no id"), name: S("new company name"), email: S("e-mail"), field: S("field of business"), status: S("status"), code: S("registration code"), registrationDate: S("registration date"), authorisedPerson: S("authorised person"), businessType: S("business type"), ownershipForm: S("ownership form"), address: S("address") }) },
        check: (a) => {
            const out: Args = {};
            const id = str(a.id, 40), lookup = str(a.lookup, 120);
            if (!id && !lookup) throw new ToolError("id or lookup (company name) is required");
            if (id) out.id = id;
            if (lookup) out.lookup = lookup;
            let n = 0;
            for (const k of COMPANY_EDITABLE) if (a[k] !== undefined) { out[k] = str(a[k], 400); n++; }
            if (!n) throw new ToolError("Nothing to change: give at least one field to fill in");
            return out;
        },
        run: (c, a) => wrap(async () => { const { lookup, id, ...fields } = a; const r = await updateRecord(c.org, "company", { id, name: lookup }, fields); return { params: { name: r.title, fields: r.changed.join(", ") }, link: recordLink("company", r.id) }; }),
    },
    // ─────────── заказы, предложения, договоры: кнопки статусов ───────────
    {
        module: "inventory", write: true,
        def: { name: "update_order_status", description: "Change the status of a sales order (the «Підтвердити» / confirm button and the others): confirmed, fulfilled (shipped — writes stock off), invoiced, closed, cancelled. Needs user confirmation unless auto mode is on. Identify the order by its number, e.g. SO-2026-3.", parameters: schema({ number: S("order number, e.g. SO-2026-3"), status: { type: "string", enum: [...ORDER_STATUSES] } }, ["number", "status"]) },
        check: (a) => {
            if (!(ORDER_STATUSES as readonly string[]).includes(String(a.status))) throw new ToolError("status must be one of: " + ORDER_STATUSES.join(", "));
            return { number: need(str(a.number, 40), "number"), status: a.status };
        },
        run: (c, a) => wrap(async () => { const r = await setOrderStatus({ org: c.org, userId: c.userId }, String(a.number), String(a.status)); return { params: { number: r.number, status: r.status }, link: "/crm/finance?tab=orders" }; }),
    },
    {
        module: "inventory", write: true,
        def: { name: "invoice_order", description: "Issue an invoice for a sales order (one order — one invoice; the order becomes «invoiced»). Needs user confirmation unless auto mode is on.", parameters: schema({ number: S("order number, e.g. SO-2026-3") }, ["number"]) },
        check: (a) => ({ number: need(str(a.number, 40), "number") }),
        run: (c, a) => wrap(async () => { const r = await invoiceFromOrder({ org: c.org, userId: c.userId }, String(a.number)); return { params: { number: r.number, order: r.order, customerName: r.customerName }, link: "/crm/finance?tab=invoices" }; }),
    },
    {
        module: "inventory", write: true,
        def: { name: "decide_quote", description: "Record the customer's decision on a SENT quote: accepted = true or declined (false). Needs user confirmation unless auto mode is on.", parameters: schema({ number: S("quote number"), accepted: { type: "boolean" } }, ["number", "accepted"]) },
        check: (a) => ({ number: need(str(a.number, 40), "number"), accepted: a.accepted === true || a.accepted === "true" }),
        run: (c, a) => wrap(async () => { const r = await decideQuote({ org: c.org, userId: c.userId }, String(a.number), a.accepted === true); return { params: { number: r.number, result: r.result }, link: "/crm/finance?tab=quotes" }; }),
    },
    {
        module: "inventory", write: true,
        def: { name: "quote_to_order", description: "Turn an ACCEPTED quote into a sales order. Needs user confirmation unless auto mode is on.", parameters: schema({ number: S("quote number") }, ["number"]) },
        check: (a) => ({ number: need(str(a.number, 40), "number") }),
        run: (c, a) => wrap(async () => { const r = await quoteToOrder({ org: c.org, userId: c.userId }, String(a.number)); return { params: { number: r.number, quote: r.quote }, link: "/crm/finance?tab=orders" }; }),
    },
    {
        module: "inventory", write: true,
        def: { name: "contract_action", description: "Contract state: sign (draft → active), complete (active → completed) or cancel (draft/active). Needs user confirmation unless auto mode is on.", parameters: schema({ number: S("contract number"), action: { type: "string", enum: ["sign", "complete", "cancel"] } }, ["number", "action"]) },
        check: (a) => {
            if (!["sign", "complete", "cancel"].includes(String(a.action))) throw new ToolError("action must be sign, complete or cancel");
            return { number: need(str(a.number, 40), "number"), action: a.action };
        },
        run: (c, a) => wrap(async () => { const r = await contractAction({ org: c.org, userId: c.userId }, String(a.number), a.action as "sign" | "complete" | "cancel"); return { params: { number: r.number, action: r.action }, link: "/crm/finance?tab=contracts" }; }),
    },
    // ─────────── закупки и склад ───────────
    {
        module: "inventory", write: true,
        def: { name: "create_supplier", description: "Create a supplier (vendor) to buy goods from. Needs user confirmation. An existing supplier with the same name is updated.", parameters: schema({ name: S("supplier name"), contact_name: S("contact person"), phone: S("phone"), email: S("e-mail"), address: S("address"), payment_days: N("payment term in days"), currency: S("EUR, UAH…"), notes: S("notes") }, ["name"]) },
        check: (a) => {
            const email = str(a.email, 120);
            if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new ToolError("email is not a valid address");
            return { name: need(str(a.name, 120), "name"), contact_name: str(a.contact_name, 120), phone: str(a.phone, 40), email, address: str(a.address, 300), payment_days: int(a.payment_days, 0, 0, 365), currency: str(a.currency, 6).toUpperCase(), notes: str(a.notes, 600) };
        },
        run: async (c, a) => {
            const data = { name: String(a.name), contactName: String(a.contact_name || ""), phone: String(a.phone || ""), email: String(a.email || ""), address: String(a.address || ""), paymentDays: Number(a.payment_days) || 0, currency: String(a.currency || ""), notes: String(a.notes || "") };
            const existing = await prisma.supplier.findFirst({ where: { org: c.org, name: data.name } });
            if (existing) await prisma.supplier.update({ where: { id: existing.id }, data }); else await prisma.supplier.create({ data: { org: c.org, ...data } });
            return { params: { name: data.name }, link: "/crm/finance?tab=purchases" };
        },
    },
    {
        module: "inventory", write: true,
        def: { name: "create_purchase_order", description: "Order goods from a supplier (purchase order). Needs user confirmation. supplier is the supplier's name (create it first with create_supplier if it does not exist); each line names a product (name, SKU or id from list_products) and a quantity. Example: reorder everything that is out of stock — list_products first, then one line per product.", parameters: schema({ supplier: S("supplier name or id"), lines: { type: "array", description: "products to order", items: { type: "object", properties: { product: S("product name, SKU or id"), qty: N("quantity"), price: { type: "number", description: "purchase price per unit, optional" } }, required: ["product", "qty"] } }, expected_date: S("expected delivery YYYY-MM-DD, optional"), notes: S("notes, optional") }, ["supplier", "lines"]) },
        check: (a) => {
            const raw = Array.isArray(a.lines) ? a.lines : [];
            const lines = raw.slice(0, 100).map((l) => { const o = (l ?? {}) as Record<string, unknown>; return { product: str(o.product ?? o.name, 200), qty: Math.abs(Number(o.qty)) || 0, ...(Number(o.price) > 0 ? { price: Number(o.price) } : {}) }; }).filter((l) => l.product && l.qty > 0);
            if (!lines.length) throw new ToolError("lines must contain at least one product with a quantity");
            return { supplier: need(str(a.supplier, 120), "supplier"), lines, expected_date: day(a.expected_date, "expected_date"), notes: str(a.notes, 600) };
        },
        run: (c, a) => wrap(async () => {
            const supplier = await findSupplier(c.org, String(a.supplier));
            const lines = [];
            for (const l of a.lines as { product: string; qty: number; price?: number }[]) {
                const p = await findProduct(c.org, l.product);
                if (p.type !== "good") throw new ToolError(`"${p.name}" is a service, not a stock item`);
                lines.push({ product: p.id, qty: l.qty, price: l.price ?? p.purchasePrice ?? 0, note: "" });
            }
            const settings = await financeSettings(c.org);
            const po = await prisma.purchaseOrder.create({
                data: {
                    org: c.org, number: await purchaseNumber(c.org), supplier: supplier.id, date: c.today, expectedDate: String(a.expected_date || ""), status: "confirmed", lines: lines as any,
                    currency: supplier.currency || settings.currency || (await defaultCurrency(c.org)), notes: String(a.notes || ""), createdByName: await authorName(c.userId),
                },
            });
            return { params: { number: po.number, supplier: supplier.name, count: String(lines.length) }, link: "/crm/finance?tab=purchases" };
        }),
    },
    {
        module: "inventory", write: true,
        def: { name: "create_product", description: "Add a product or service to the catalog. Needs user confirmation. type: good (stock item) or service.", parameters: schema({ name: S("product name"), type: { type: "string", enum: ["good", "service"] }, sku: S("SKU / article"), unit: S("unit, e.g. pcs, kg, h"), sale_price: { type: "number" }, purchase_price: { type: "number" }, stock_qty: { type: "number", description: "starting stock (goods only)" }, reorder_level: { type: "number", description: "alert when stock falls to this level" } }, ["name"]) },
        check: (a) => ({ name: need(str(a.name, 200), "name"), type: a.type === "good" ? "good" : "service", sku: str(a.sku, 60), unit: str(a.unit, 20), sale_price: Math.max(0, Number(a.sale_price) || 0), purchase_price: Math.max(0, Number(a.purchase_price) || 0), stock_qty: Math.max(0, Number(a.stock_qty) || 0), reorder_level: Math.max(0, Number(a.reorder_level) || 0) }),
        run: async (c, a) => {
            const good = a.type === "good";
            const p = await prisma.product.create({ data: { org: c.org, name: String(a.name), type: good ? "good" : "service", sku: String(a.sku || ""), unit: String(a.unit || "") || "pcs", salePrice: Number(a.sale_price) || 0, purchasePrice: Number(a.purchase_price) || 0, stockQty: good ? Number(a.stock_qty) || 0 : 0, reorderLevel: Number(a.reorder_level) || 0 } });
            return { params: { name: p.name }, link: "/crm/finance?tab=products" };
        },
    },
    {
        module: "inventory", write: true,
        def: { name: "adjust_stock", description: "Change the stock of a product: positive qty = receipt/surplus, negative = write-off. Needs user confirmation. reason: purchase (goods received), writeoff, adjustment (inventory count), return.", parameters: schema({ product: S("product name, SKU or id"), qty: { type: "number", description: "change in stock, + or −" }, reason: { type: "string", enum: ["purchase", "writeoff", "adjustment", "return"] }, note: S("note, optional") }, ["product", "qty"]) },
        check: (a) => {
            const qty = Number(a.qty);
            if (!Number.isFinite(qty) || qty === 0) throw new ToolError("qty must be a non-zero number");
            return { product: need(str(a.product, 200), "product"), qty, reason: ["purchase", "writeoff", "adjustment", "return"].includes(String(a.reason)) ? a.reason : qty < 0 ? "writeoff" : "adjustment", note: str(a.note, 200) };
        },
        run: (c, a) => wrap(async () => {
            const p = await findProduct(c.org, String(a.product));
            if (p.type !== "good") throw new ToolError(`"${p.name}" is a service — it has no stock`);
            await moveStock(c.org, p.id, Number(a.qty), a.reason as "purchase" | "writeoff" | "adjustment" | "return", { note: String(a.note || ""), by: await authorName(c.userId) });
            return { params: { name: p.name, qty: String(a.qty), stock: String((p.stockQty ?? 0) + Number(a.qty)) }, link: "/crm/finance?tab=products" };
        }),
    },
    // ─────────── отчёт в PDF на почту ───────────
    {
        module: "inventory", write: true,
        def: { name: "email_report", description: "Build a PDF report and e-mail it as an attachment (default recipient: the user's own address). source: stock_low (goods running low or out of stock), stock_out (out of stock only), invoices_unpaid, invoices_overdue, or custom (give your own sections: columns + rows). Use it for «пришли мне список в PDF на почту». Write language in the user's language.", parameters: schema({
            source: { type: "string", enum: ["stock_low", "stock_out", "invoices_unpaid", "invoices_overdue", "custom"] },
            title: S("report title, optional for the standard sources"),
            to: S("recipient e-mail; omit to send to the user"),
            language: { type: "string", enum: ["ru", "uk", "de", "en"], description: "language of the report" },
            message: S("short text for the e-mail body, optional"),
            sections: { type: "array", description: "only for custom", items: { type: "object", properties: { heading: S("section heading"), columns: { type: "array", items: { type: "string" } }, rows: { type: "array", items: { type: "array", items: { type: "string" } } } }, required: ["columns", "rows"] } },
        }, ["source"]) },
        check: (a) => {
            if (!["stock_low", "stock_out", "invoices_unpaid", "invoices_overdue", "custom"].includes(String(a.source))) throw new ToolError("source is not supported");
            const to = str(a.to, 200);
            if (to && !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(to)) throw new ToolError("to must be a single valid e-mail address");
            const out: Args = { source: a.source, title: str(a.title, 120), language: ["ru", "uk", "de", "en"].includes(String(a.language)) ? a.language : "ru", message: str(a.message, 500), ...(to ? { to } : {}) };
            if (a.source === "custom") {
                const secs = (Array.isArray(a.sections) ? a.sections : []).slice(0, 6).map((x) => {
                    const o = (x ?? {}) as Record<string, unknown>;
                    const columns = (Array.isArray(o.columns) ? o.columns : []).slice(0, 8).map((c) => str(c, 60));
                    const rows = (Array.isArray(o.rows) ? o.rows : []).slice(0, 300).map((r) => (Array.isArray(r) ? r : []).slice(0, columns.length).map((c) => str(c, 200)));
                    return { heading: str(o.heading, 100), columns, rows };
                }).filter((x) => x.columns.length);
                if (!secs.length) throw new ToolError("custom report needs at least one section with columns");
                out.sections = secs;
            }
            return out;
        },
        run: (c, a) => wrap(async () => {
            const lang = (["ru", "uk", "de", "en"].includes(String(a.language)) ? a.language : "ru") as "ru" | "uk" | "de" | "en";
            const L = REPORT_LABELS[lang];
            let title = String(a.title || ""), sections: ReportSection[] = [];
            const src = String(a.source);
            if (src === "stock_low" || src === "stock_out") {
                const r = await listProducts(c, { filter: src === "stock_out" ? "out_of_stock" : "low_stock", limit: 200, _cap: 200 });
                title ||= src === "stock_out" ? L.stockOut : L.stockLow;
                sections = [{ columns: [L.product, L.sku, L.stock, L.unit, L.reorder], rows: r.products.map((p) => [p.name, p.sku || "—", p.stock, p.unit, p.reorderLevel || "—"]) }];
            } else if (src === "invoices_unpaid" || src === "invoices_overdue") {
                const r = await listInvoicesData(c, { filter: src === "invoices_overdue" ? "overdue" : "unpaid", limit: 200, _cap: 200 });
                title ||= src === "invoices_overdue" ? L.invOverdue : L.invUnpaid;
                sections = [{ columns: [L.number, L.customer, L.total, L.open, L.due, L.late], rows: r.invoices.map((i) => [i.number, i.customer, `${i.total} ${i.currency}`, `${i.open} ${i.currency}`, i.due || "—", i.daysOverdue || "—"]) }];
                const sums = Object.entries(r.openAmountByCurrency).map(([k, v]) => `${v} ${k}`).join(", ");
                if (sums) sections.push({ heading: L.sumTotal + ": " + sums, columns: [L.invCount], rows: [[String(r.count)]] });
            } else sections = a.sections as ReportSection[];
            const today = c.today || new Date().toISOString().slice(0, 10);
            const pdf = await reportPdf({ title: title || L.report, subtitle: `${L.generated}: ${today}`, sections, footer: "Firmspace CRM · Iris" });
            const user = await prisma.user.findUnique({ where: { id: c.userId }, select: { email: true } });
            const to = String(a.to || user?.email || "");
            if (!to) throw new ToolError("No recipient: the user has no e-mail address — give one in the command");
            const account = await mailAccount(c.org, undefined);
            if (!account) throw new ToolError("No mailbox is connected. Connect one in Web Mails first.");
            const filename = `${(title || L.report).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60) || "report"}-${today}.pdf`;
            await sendFromAccount(account, { to, subject: title || L.report, text: String(a.message || "") || `${title || L.report} — ${L.attached}`, attachments: [{ filename, contentType: "application/pdf", content: pdf }] });
            return { params: { to, title: title || L.report }, link: "/crm/collaboration/web-mails" };
        }),
    },
    // ─────────── удаление ───────────
    {
        module: null, write: true,
        def: { name: "delete_record", description: "Delete a record of the CRM by id (ids come from the read tools: search_*, list_*, browse_data). entity: contact, company, deal, task, expense, quote, order, draft_invoice (only drafts can be deleted), supplier and product (archived, not erased). Needs user confirmation — say what is being deleted.", parameters: schema({ entity: { type: "string", enum: ["contact", "company", "deal", "task", "expense", "quote", "order", "draft_invoice", "supplier", "product"] }, id: S("record id"), name: S("human-readable name of the record, for the confirmation card") }, ["entity", "id"]) },
        check: (a) => {
            if (!["contact", "company", "deal", "task", "expense", "quote", "order", "draft_invoice", "supplier", "product"].includes(String(a.entity))) throw new ToolError("Unsupported entity");
            if (!isId(a.id)) throw new ToolError("id must be a record id");
            return { entity: a.entity, id: a.id, name: str(a.name, 120) };
        },
        run: async (c, a) => {
            const id = String(a.id);
            const owner = { id, owner: c.org }, org = { id, org: c.org };
            const del: Record<string, () => Promise<number>> = {
                contact: async () => (await prisma.contact.deleteMany({ where: owner })).count,
                company: async () => (await prisma.company.deleteMany({ where: owner })).count,
                deal: async () => (await prisma.deal.deleteMany({ where: owner })).count,
                task: async () => (await prisma.task.deleteMany({ where: owner })).count,
                expense: async () => (await prisma.expense.deleteMany({ where: org })).count,
                quote: async () => (await prisma.quote.deleteMany({ where: org })).count,
                order: async () => (await prisma.order.deleteMany({ where: org })).count,
                // выставленный счёт удалять нельзя (нумерация и учёт): только черновик
                draft_invoice: async () => (await prisma.invoice.deleteMany({ where: { ...org, status: "draft" } })).count,
                supplier: async () => (await prisma.supplier.updateMany({ where: org, data: { archived: true } })).count,
                product: async () => (await prisma.product.updateMany({ where: org, data: { archived: true } })).count,
            };
            const n = await del[String(a.entity)]();
            if (!n) throw new ToolError(a.entity === "draft_invoice" ? "Draft invoice not found (only unsent drafts can be deleted)" : "Record not found");
            await logAudit({ org: c.org, userId: c.userId, action: `${a.entity}.deleted`, entityType: String(a.entity), entityId: id, summary: `${a.entity} ${a.name || id} deleted via assistant`, meta: {} }).catch(() => undefined);
            return { params: { entity: String(a.entity), name: String(a.name || id) }, link: "/crm" };
        },
    },
];

// ── Какие инструменты показать модели на этот запрос ──
// Все ~45 инструментов с описаниями — это ~10 тысяч токенов на КАЖДЫЙ круг модели, и ответ занимал 5–13 секунд. Поэтому
// модель получает только группы, о которых идёт речь в последних репликах (по ключевым словам на ru/uk/de/en); просьба
// «открой страницу» обходится одним navigate. Если ни одна группа не узнана и это не переход — отдаём всё, как раньше:
// медленнее, зато ничего не теряется.
const GROUPS: { re: RegExp; tools: string[] }[] = [
    { re: /сч[её]т|рахун|rechnung|invoice|оплат|оплач|чек|квитанц|receipt|kasse|pdf|скача|завантаж|download|просроч|неоплач|не закры|незакры|долж|задолж|debt|overdue|unpaid|paid|фискаль|бухгалтер|фінанс|финанс|buchhalt|financ/i,
      tools: ["list_invoices", "finance_summary", "create_invoice", "mark_invoice_paid", "send_invoice", "issue_fiscal_receipt", "download_document", "email_report", "search_contacts"] },
    { re: /предложен|пропозиц|angebot|quote|договор|контракт|vertrag|contract|заказ|замовлен|order|auftrag|подтверд|підтверд|подпиш|підпиш|завершив|so-|отгруз|відвант/i,
      tools: ["create_quote", "create_order", "create_contract", "update_order_status", "invoice_order", "decide_quote", "quote_to_order", "contract_action", "download_document", "browse_data", "search_contacts"] },
    { re: /расход|витрат|ausgabe|expense|налог|податк|steuer|банк|bank|выруч|доход|прибыл|money|деньг|кассов/i,
      tools: ["list_expenses", "create_expense", "finance_summary", "browse_data"] },
    { re: /склад|остат|залишк|товар|продукт|product|stock|bestand|lager|закуп|закаж|замов|зп-|поставщ|постачальн|supplier|lieferant|bestell|purchase|приход|списан|списа|инвентар|артикул|sku|nomenclat|номенклат|заканч|закінч|нехват|не хватает|reorder/i,
      tools: ["list_products", "create_product", "adjust_stock", "create_supplier", "create_purchase_order", "download_document", "email_report", "browse_data", "list_expenses"] },
    { re: /клиент|клієнт|kunde|customer|контакт|contact|компани|company|firma|сделк|угод|deal|лид|lead|воронк|воронка|pipeline|этап|етап|stage|заметк|нотатк|notiz|note|не общал|давно не|карточк|картк|card|заполни|заповни|поле|поля|field|измени|змін|обнови|поменяй|поставь|впиши|напиши в|запиши в|крм|срм|\bcrm\b/i,
      tools: ["search_contacts", "search_companies", "get_contact", "get_company", "get_deal", "list_deals", "list_stages", "find_stale_contacts", "create_contact", "create_company", "create_deal", "update_deal_stage", "update_deal", "update_contact", "update_company", "open_record", "add_note", "delete_record"] },
    { re: /сегодня|сьогодні|today|heute|завтра|morgen|задач|task|aufgabe|напомн|нагад|remind|календар|calendar|kalender|встреч|зустріч|termin|meeting|событ|подія|проект|project|чат|chat|whatsapp|telegram/i,
      tools: ["list_tasks", "create_task", "update_task", "browse_data", "list_employees", "search_contacts"] },
    { re: /письм|лист|почт|пошт|mail|e-mail|email|inbox|входящ|ответь|відпов|reply/i,
      tools: ["search_mail", "get_mail", "get_mail_thread", "send_email", "search_contacts", "create_deal", "create_task"] },
    { re: /отч[её]т|звіт|report|bericht|на почт|на пошт|per mail|пришли|вышли|отправь мне|надішли|вишли/i,
      tools: ["email_report", "list_products", "list_invoices", "list_expenses", "finance_summary", "browse_data"] },
    { re: /лид|lead|потенциал|клиент.*(мусор|не клиент)|спам|spam|рассылк|мусор|отсе[яи]|отфильтр|фильтр|junk|newsletter|разбер[иё]|проанализ|анализ|качеств|ненужн|лишн|почисти|очисти|канбан|воронк|kanban/i,
      tools: ["analyze_leads", "lead_log", "restore_lead", "cleanup_leads", "set_lead_rules", "list_deals", "search_contacts", "search_companies", "get_deal", "search_mail", "delete_record"] },
    { re: /агент|бот|запрос.* от|agent|bot\b|одобр|approve|разреш/i,
      tools: ["list_agent_requests", "decide_agent_request"] },
    { re: /блог|статьи|статей|статья|article|blog|черновик|draft|опублику|publish/i,
      tools: ["list_blog_posts", "publish_blog_post"] },
    { re: /документ|файл|document|dokument|прочитай документ|read the doc/i,
      tools: ["search_documents", "read_document", "list_employees", "save_employee_contract", "download_document"] },
    { re: /сотрудник|співробітник|працівник|employee|mitarbeiter|команд|team|персонал/i,
      tools: ["list_employees", "save_employee_contract"] },
    { re: /удал|видал|стер|delete|remove|lösch|entfern/i,
      tools: ["delete_record", "browse_data", "search_contacts", "search_companies", "list_deals", "list_tasks", "list_expenses", "list_products", "list_invoices"] },
    { re: /банк|транзакц|движен|заказ|замовлен|order|auftrag|производ|виробн|production|основн.* средств|asset|регуляр|recurring|автоматиз|automation|маркетинг|marketing|склады|warehouse/i,
      tools: ["browse_data", "list_products"] },
];
const NAVIGATION = /открой|открыть|откройте|перейд|покажи страниц|зайди|відкрий|відкрити|перейди|покажи сторінк|open|go to|navigate|öffne|gehe zu|zeig/i;

/** Подмножество инструментов под запрос; не распознали — все. navigate доступен всегда. */
export function pickTools<T extends { def: { name: string } }>(all: T[], recentText: string): T[] {
    const text = String(recentText ?? "");
    const wanted = new Set<string>(["navigate", "remember", "forget", "list_memory", "scroll_page", "queue_tasks"]);
    let matched = false;
    for (const g of GROUPS) if (g.re.test(text)) { matched = true; g.tools.forEach((t) => wanted.add(t)); }
    if (!matched && !NAVIGATION.test(text)) return all;
    return all.filter((t) => wanted.has(t.def.name));
}

export const toolByName = (name: string) => TOOLS.find((t) => t.def.name === name);

// Инструменты, доступные именно этому пользователю: раздел открыт ролью, а наблюдатель (viewer) только читает
export const allowedTools = (c: Pick<AiCtx, "role" | "modules">) => TOOLS.filter((t) => canAccess(c.role, c.modules, t.module, t.write ? "POST" : "GET"));

// Как называется запись, к которой относится действие (для карточки подтверждения: «Update task “Offer”»)
export async function targetLabel(c: Pick<AiCtx, "org">, tool: string, a: Args): Promise<string> {
    try {
        if (tool === "update_task") return (await prisma.task.findFirst({ where: { id: String(a.id), owner: c.org }, select: { title: true } }))?.title ?? "";
        if (tool === "add_note") {
            const id = String(a.id);
            if (a.entity === "deal") return (await prisma.deal.findFirst({ where: { id, owner: c.org }, select: { clientName: true } }))?.clientName ?? "";
            if (a.entity === "contact") return (await prisma.contact.findFirst({ where: { id, owner: c.org }, select: { name: true } }))?.name ?? "";
            if (a.entity === "company") return (await prisma.company.findFirst({ where: { id, owner: c.org }, select: { name: true } }))?.name ?? "";
            return "";
        }
        if (tool === "save_employee_contract") {
            const r = await prisma.employee.findFirst({ where: { id: String(a.employee_id), owner: c.org }, select: { firstname: true, lastname: true } });
            return r ? `${r.firstname} ${r.lastname}`.trim() : "";
        }
        if (["mark_invoice_paid", "send_invoice", "issue_fiscal_receipt", "update_order_status", "invoice_order", "decide_quote", "quote_to_order", "contract_action"].includes(tool)) return String(a.number ?? "");
        if (tool === "create_purchase_order") return String(a.supplier ?? "");
        if (tool === "adjust_stock") return String(a.product ?? "");
        if (tool === "delete_record") return String(a.name ?? "");
        if (tool === "update_deal" || tool === "update_contact" || tool === "update_company") return String(a.name ?? a.lookup ?? "");
        if (tool === "update_deal_stage") return (await prisma.deal.findFirst({ where: { id: String(a.id), owner: c.org }, select: { clientName: true } }))?.clientName ?? "";
        if (tool === "create_invoice" || tool === "create_quote" || tool === "create_order" || tool === "create_contract") return String(a.customer_name ?? "");
    } catch { /* подпись необязательна */ }
    return "";
}
