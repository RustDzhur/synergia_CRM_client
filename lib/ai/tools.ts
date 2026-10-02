import { type Role, type Module, canAccess } from "@/lib/access";
import { contactFullName } from "@/lib/crmFields";
import { postTask } from "@/lib/feed";
import { emit, emitDeal } from "@/lib/automation/emit";
import { sendFromAccount } from "@/lib/mail";
import { extractPdfText } from "@/lib/ai/pdf";
import { getObject } from "@/lib/storage";
import { ensureStages } from "@/lib/stages";
import { prisma } from "@/lib/prisma";
import { financeSettings, defaultCurrency } from "@/lib/finance/settings";
import { nextNumber } from "@/lib/finance/numbering";
import { numberPrefix } from "@/lib/finance/documents/store";
import { applyTaxPolicy, taxExempt } from "@/lib/finance/tax";
import { cleanItems } from "@/lib/finance/totals";
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
    module: Module;
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

// Разделы CRM, в которые ассистент переходит по команде «перейди в …» (navigate)
const NAV_SECTIONS: Record<string, { label: string; link: string }> = {
    dashboard: { label: "Головна", link: "/crm" },
    deals: { label: "Воронка угод", link: "/crm/crm" },
    contacts: { label: "Контакти", link: "/crm/crm" },
    tasks: { label: "Задачі", link: "/crm/tasks" },
    employees: { label: "Співробітники", link: "/crm/company" },
    calendar: { label: "Календар", link: "/crm/collaboration/calendar" },
    chat: { label: "Чат і дзвінки", link: "/crm/collaboration/chat-and-calls" },
    mails: { label: "Пошта", link: "/crm/collaboration/web-mails" },
    documents: { label: "Документи", link: "/crm/collaboration/online-documents" },
    finance: { label: "Бухгалтерія", link: "/crm/finance" },
    marketing: { label: "Маркетинг", link: "/crm/marketing" },
    automation: { label: "Автоматизація", link: "/crm/automation" },
    settings: { label: "Налаштування", link: "/crm/settings" },
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
        module: "crm", write: true,
        def: { name: "navigate", description: "Open a section of the CRM: dashboard, deals board, tasks, employees, calendar, chat and calls, web-mail, documents, accounting/finance (invoices, quotes, orders, contracts, expenses), marketing, automation, settings. Use it when the user asks to go somewhere, e.g. «перейди в бухгалтерию» (finance). Needs user confirmation; the user then lands on the section.", parameters: schema({ section: { type: "string", enum: Object.keys(NAV_SECTIONS), description: "target section key" } }, ["section"]) },
        check: (a) => {
            const section = str(a.section, 40);
            if (!NAV_SECTIONS[section]) throw new ToolError("Unknown section. Choose one of: " + Object.keys(NAV_SECTIONS).join(", "));
            return { section };
        },
        run: async (_c, a) => ({ params: { section: NAV_SECTIONS[a.section as string].label }, link: NAV_SECTIONS[a.section as string].link }),
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
];

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
        if (tool === "navigate") return NAV_SECTIONS[String(a.section)]?.label ?? "";
        if (tool === "create_invoice" || tool === "create_quote" || tool === "create_order" || tool === "create_contract") return String(a.customer_name ?? "");
    } catch { /* подпись необязательна */ }
    return "";
}
