import { canAccess, type Module, type Role } from "@/lib/access";
import { contactFullName, escapeRegex } from "@/lib/crmFields";
import { postTask } from "@/lib/feed";
import { emit, emitDeal } from "@/lib/automation/emit";
import { sendFromAccount } from "@/lib/mail";
import { extractPdfText } from "@/lib/ai/pdf";
import { getObject } from "@/lib/storage/firebase";
import { ensureStages } from "@/lib/stages";
import Company from "@/models/Company";
import Contact from "@/models/Contact";
import Deal from "@/models/Deal";
import DocItem from "@/models/DocItem";
import Employee from "@/models/Employee";
import Integration from "@/models/Integration";
import MailMessage from "@/models/MailMessage";
import Stage from "@/models/Stage";
import Task from "@/models/Task";
import User from "@/models/User";
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
const rx = (v: string) => new RegExp(escapeRegex(v), "i");
const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{24}$/i.test(v);
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

export const TOOLS: AiTool[] = [
    // ─────────── чтение ───────────
    {
        module: "crm", write: false,
        def: { name: "search_contacts", description: "Search contacts (customers, people) by name, e-mail, phone or company. Empty query lists the most recently changed.", parameters: schema({ query: S("text to look for"), limit: N("max results, default 10, max 25") }) },
        run: async (c, a) => {
            const q = str(a.query, 100);
            const filter: Record<string, unknown> = { owner: c.org };
            if (q) filter.$or = ["name", "email", "phone", "company"].map((k) => ({ [k]: rx(q) }));
            const list = await Contact.find(filter).sort({ updatedAt: -1 }).limit(int(a.limit, 10, 1, 25)).lean();
            return list.map((x) => ({ id: String(x._id), name: x.name, email: x.email, phone: x.phone, company: x.company, position: x.position, lastContact: iso(lastContactAt(x.activities, x.createdAt)) }));
        },
    },
    {
        module: "crm", write: false,
        def: { name: "search_companies", description: "Search companies (legal entities) by name, field of business or e-mail.", parameters: schema({ query: S("text to look for"), limit: N("max results, default 10, max 25") }) },
        run: async (c, a) => {
            const q = str(a.query, 100);
            const filter: Record<string, unknown> = { owner: c.org };
            if (q) filter.$or = ["name", "field", "email", "address"].map((k) => ({ [k]: rx(q) }));
            const list = await Company.find(filter).sort({ updatedAt: -1 }).limit(int(a.limit, 10, 1, 25)).lean();
            return list.map((x) => ({ id: String(x._id), name: x.name, email: x.email, field: x.field, status: x.status, authorisedPerson: x.authorisedPerson, address: cut(x.address, 120) }));
        },
    },
    {
        module: "crm", write: false,
        def: { name: "find_stale_contacts", description: "Contacts with no recorded communication (e-mail, call, message, note) for at least N days, longest silence first. Based on the activity log of each contact.", parameters: schema({ days: N("minimum days without contact, default 30"), limit: N("max results, default 20, max 50") }) },
        run: async (c, a) => {
            const days = int(a.days, 30, 1, 3650);
            const list = await Contact.find({ owner: c.org }).select("name email phone company activities createdAt").limit(1000).lean();
            const now = Date.now();
            return list
                .map((x) => ({ x, ts: lastContactAt(x.activities, x.createdAt) }))
                .filter(({ ts }) => now - ts >= days * 86400000)
                .sort((p, q) => p.ts - q.ts)
                .slice(0, int(a.limit, 20, 1, 50))
                .map(({ x, ts }) => ({ id: String(x._id), name: x.name, email: x.email, company: x.company, lastContact: iso(ts), daysSince: Math.floor((now - ts) / 86400000) }));
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
                filter.stage = { $in: hit.map((s) => s._id) };
            }
            const q = str(a.query, 100);
            if (q) filter.$or = ["clientName", "contactName", "companyName"].map((k) => ({ [k]: rx(q) }));
            const list = await Deal.find(filter).sort({ updatedAt: -1 }).limit(int(a.limit, 15, 1, 40)).lean();
            return list.map((d) => ({ id: String(d._id), name: d.clientName, stage: byId.get(String(d.stage)) ?? "", contact: d.contactName, company: d.companyName, startDate: d.startDate, endDate: d.endDate, responsible: d.responsible, updated: iso(d.updatedAt) }));
        },
    },
    {
        module: "crm", write: false,
        def: { name: "get_contact", description: "Full record of one contact with its latest activity (history of communication). Use it for a customer summary.", parameters: schema({ id: S("contact id from search_contacts") }, ["id"]) },
        run: async (c, a) => {
            if (!isId(a.id)) throw new ToolError("id must be a contact id");
            const x = await Contact.findOne({ _id: a.id, owner: c.org }).lean();
            if (!x) throw new ToolError("Contact not found");
            return { id: String(x._id), name: x.name, email: x.email, phone: x.phone, company: x.company, position: x.position, website: x.website, notes: cut(x.notes, 500), source: x.source, created: iso(x.createdAt), lastContact: iso(lastContactAt(x.activities, x.createdAt)), activity: acts(x.activities) };
        },
    },
    {
        module: "crm", write: false,
        def: { name: "get_company", description: "Full record of one company with its latest activity.", parameters: schema({ id: S("company id from search_companies") }, ["id"]) },
        run: async (c, a) => {
            if (!isId(a.id)) throw new ToolError("id must be a company id");
            const x = await Company.findOne({ _id: a.id, owner: c.org }).lean();
            if (!x) throw new ToolError("Company not found");
            return { id: String(x._id), name: x.name, email: x.email, field: x.field, status: x.status, authorisedPerson: x.authorisedPerson, businessType: x.businessType, address: x.address, registrationDate: x.registrationDate, created: iso(x.createdAt), activity: acts(x.activities) };
        },
    },
    {
        module: "crm", write: false,
        def: { name: "get_deal", description: "Full record of one deal with its history (stage changes, notes, e-mails).", parameters: schema({ id: S("deal id from list_deals") }, ["id"]) },
        run: async (c, a) => {
            if (!isId(a.id)) throw new ToolError("id must be a deal id");
            const x = await Deal.findOne({ _id: a.id, owner: c.org }).lean();
            if (!x) throw new ToolError("Deal not found");
            const stage = await Stage.findById(x.stage).select("name").lean();
            return { id: String(x._id), name: x.clientName, stage: stage?.name ?? "", contact: x.contactName, company: x.companyName, startDate: x.startDate, endDate: x.endDate, type: x.dealType, responsible: x.responsible, created: iso(x.createdAt), activity: acts(x.activities) };
        },
    },
    {
        module: "tasks", write: false,
        def: { name: "list_tasks", description: "Tasks of the firm. filter: open (not done), today (due today), overdue, completed or all. Optionally only tasks of one responsible person (name).", parameters: schema({ filter: { type: "string", enum: ["open", "today", "overdue", "completed", "all"] }, responsible: S("person name to filter by"), limit: N("max results, default 30, max 60") }) },
        run: async (c, a) => {
            const f = str(a.filter, 20) || "open";
            const filter: Record<string, unknown> = { owner: c.org };
            const who = str(a.responsible, 80);
            if (who) filter.responsible = rx(who);
            if (f === "completed") filter.completed = true;
            else if (f !== "all") filter.completed = false;
            if (f === "today") filter.deadline = { $regex: `^${c.today}` };
            if (f === "overdue") filter.deadline = { $gt: "", $lt: c.now };
            const list = await Task.find(filter).sort({ deadline: 1, createdAt: -1 }).limit(int(a.limit, 30, 1, 60)).lean();
            return list.map((t) => ({ id: String(t._id), title: t.title, deadline: t.deadline, responsible: t.responsible, completed: t.completed, overdue: !t.completed && !!t.deadline && t.deadline < c.now, description: cut(t.description, 200) }));
        },
    },
    {
        module: "company", write: false,
        def: { name: "list_employees", description: "Employees of the company with position, department and their open / overdue task counts (tasks are matched by the responsible name).", parameters: schema({ query: S("name, position or department to look for"), limit: N("max results, default 20, max 50") }) },
        run: async (c, a) => {
            const q = str(a.query, 80);
            const filter: Record<string, unknown> = { owner: c.org };
            if (q) filter.$or = ["firstname", "lastname", "position", "department", "email"].map((k) => ({ [k]: rx(q) }));
            const [people, open] = await Promise.all([Employee.find(filter).limit(int(a.limit, 20, 1, 50)).lean(), Task.find({ owner: c.org, completed: false }).select("responsible deadline title").lean()]);
            return people.map((p) => {
                const full = `${p.firstname} ${p.lastname}`.toLowerCase();
                const mine = open.filter((t) => [full, String(p.firstname).toLowerCase()].includes(String(t.responsible ?? "").toLowerCase().trim()));
                const overdue = mine.filter((t) => t.deadline && t.deadline < c.now);
                return { id: String(p._id), name: `${p.firstname} ${p.lastname}`, email: p.email, position: p.position, department: p.department, openTasks: mine.length, overdueTasks: overdue.length, overdueTitles: overdue.slice(0, 5).map((t) => t.title) };
            });
        },
    },
    {
        module: "mail", write: false,
        def: { name: "search_mail", description: "Search e-mails (subject, sender, recipient, text). Newest first. Only short previews; use get_mail for the full text.", parameters: schema({ query: S("text to look for"), folder: { type: "string", enum: ["inbox", "sent"] }, limit: N("max results, default 10, max 20") }) },
        run: async (c, a) => {
            const filter: Record<string, unknown> = { owner: c.org, deleted: { $ne: true } };
            const folder = str(a.folder, 10);
            if (folder === "inbox" || folder === "sent") filter.folder = folder;
            const q = str(a.query, 100);
            if (q) filter.$or = ["subject", "from", "to", "body"].map((k) => ({ [k]: rx(q) }));
            const list = await MailMessage.find(filter).sort({ at: -1 }).limit(int(a.limit, 10, 1, 20)).lean();
            return list.map((m) => ({ id: String(m._id), folder: m.folder, from: m.from, to: m.to, subject: m.subject, at: new Date(m.at).toISOString(), read: m.read, preview: cut(m.body, 200) }));
        },
    },
    {
        module: "mail", write: false,
        def: { name: "get_mail", description: "Full text of one e-mail.", parameters: schema({ id: S("mail id from search_mail") }, ["id"]) },
        run: async (c, a) => {
            if (!isId(a.id)) throw new ToolError("id must be a mail id");
            const m = await MailMessage.findOne({ _id: a.id, owner: c.org, deleted: { $ne: true } }).lean();
            if (!m) throw new ToolError("E-mail not found");
            return { id: String(m._id), folder: m.folder, from: m.from, to: m.to, subject: m.subject, at: new Date(m.at).toISOString(), body: cut(m.body, 4000) };
        },
    },
    {
        module: "mail", write: false,
        def: { name: "get_mail_thread", description: "The correspondence with one e-mail address (both directions), oldest first, each message shortened. Use it to summarize a long conversation.", parameters: schema({ email: S("the other person's e-mail address"), limit: N("max messages, default 20, max 40") }, ["email"]) },
        run: async (c, a) => {
            const email = need(str(a.email, 200).toLowerCase(), "email");
            const list = await MailMessage.find({ owner: c.org, deleted: { $ne: true }, $or: [{ from: rx(email) }, { to: rx(email) }] }).sort({ at: -1 }).limit(int(a.limit, 20, 1, 40)).lean();
            return list.reverse().map((m) => ({ id: String(m._id), direction: m.folder === "sent" ? "we wrote" : "they wrote", subject: m.subject, at: new Date(m.at).toISOString().slice(0, 16), text: cut(m.body, 600) }));
        },
    },
    {
        module: "collab", write: false,
        def: { name: "search_documents", description: "Search uploaded files in Documents by name (not Google Docs/Sheets/Slides — only uploaded files, e.g. PDFs). Use it to find a file's id before read_document.", parameters: schema({ query: S("text in the file name"), limit: N("max results, default 10, max 25") }) },
        run: async (c, a) => {
            const q = str(a.query, 150);
            const filter: Record<string, unknown> = { owner: c.org, kind: "file", archived: { $ne: true } };
            if (q) filter.name = rx(q);
            const list = await DocItem.find(filter).sort({ createdAt: -1 }).limit(int(a.limit, 10, 1, 25)).lean();
            return list.map((d) => ({ id: String(d._id), name: d.name, mime: d.mime, sizeKb: Math.round((d.size ?? 0) / 1024), uploaded: iso(d.createdAt) }));
        },
    },
    {
        module: "collab", write: false,
        def: { name: "read_document", description: "Read the text of an uploaded PDF file (not Google Docs/Sheets/Slides, and not images or other file types — PDF only, for now). Use it to summarize a document or, for an employment contract, to find the employee name, contract type and start date before proposing save_employee_contract.", parameters: schema({ id: S("file id from search_documents") }, ["id"]) },
        run: async (c, a) => {
            if (!isId(a.id)) throw new ToolError("id must be a file id from search_documents");
            const doc = await DocItem.findOne({ _id: a.id, owner: c.org, kind: "file" }).lean();
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
            const author = await User.findById(c.userId).select("firstname lastname").lean<{ firstname: string; lastname: string }>();
            const task = await Task.create({ owner: c.org, title: a.title, description: a.description, deadline: a.deadline, createdBy: author ? `${author.firstname} ${author.lastname}`.trim() : "", responsible: a.responsible || author?.firstname || "" });
            await postTask(c.org, c.userId, task);
            await emit(c.org, { type: "task_created", data: { id: String(task._id), title: task.title, responsible: task.responsible ?? "" } });
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
            const t = await Task.findOneAndUpdate({ _id: id, owner: c.org }, { $set: set }, { new: true });
            if (!t) throw new ToolError("Task not found");
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
            const order = await Deal.countDocuments({ owner: c.org, stage: stage._id });
            const deal = await Deal.create({ owner: c.org, stage: stage._id, clientName: a.name, order, contactName: a.contact_name, companyName: a.company_name, endDate: a.end_date, responsible: a.responsible, activities: [{ type: "created", text: a.name }] });
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
            const x = await Contact.create({ ...a, name, owner: c.org });
            await emit(c.org, { type: "contact_created", data: { id: String(x._id), name, email: x.email ?? "", phone: x.phone ?? "" } });
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
            const Model = a.entity === "deal" ? Deal : a.entity === "contact" ? Contact : Company;
            const r = await Model.updateOne({ _id: a.id, owner: c.org }, { $push: { activities: { type: "note", text: a.text, meta: "" } } });
            if (!r.matchedCount) throw new ToolError("Record not found");
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
            const box = await Integration.findOne({ owner: c.org, type: "mail", status: "connected" });
            if (!box) throw new ToolError("No mailbox is connected. Connect one in Web Mails first.");
            await sendFromAccount(box, { to: String(a.to), subject: String(a.subject), text: String(a.body) });
            await Contact.updateOne({ owner: c.org, email: new RegExp(`^${escapeRegex(String(a.to))}$`, "i") }, { $push: { activities: { type: "email", text: `Email: ${a.subject}`, meta: "" } } }).catch(() => undefined);
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
            const emp = await Employee.findOneAndUpdate({ _id: employee_id, owner: c.org }, { $set: set }, { new: true });
            if (!emp) throw new ToolError("Employee not found");
            return { params: { name: `${emp.firstname} ${emp.lastname}`.trim() }, link: "/crm/company" };
        },
    },
];

export const toolByName = (name: string) => TOOLS.find((t) => t.def.name === name);

// Инструменты, доступные именно этому пользователю: раздел открыт ролью, а наблюдатель (viewer) только читает
export const allowedTools = (c: Pick<AiCtx, "role" | "modules">) => TOOLS.filter((t) => canAccess(c.role, c.modules, t.module, t.write ? "POST" : "GET"));

// Как называется запись, к которой относится действие (для карточки подтверждения: «Update task “Offer”»)
export async function targetLabel(c: Pick<AiCtx, "org">, tool: string, a: Args): Promise<string> {
    try {
        if (tool === "update_task") return (await Task.findOne({ _id: a.id, owner: c.org }).select("title").lean<{ title: string }>())?.title ?? "";
        if (tool === "add_note") {
            const Model = a.entity === "deal" ? Deal : a.entity === "contact" ? Contact : Company;
            const r = await Model.findOne({ _id: a.id, owner: c.org }).select("name clientName").lean<{ name?: string; clientName?: string }>();
            return r?.name ?? r?.clientName ?? "";
        }
        if (tool === "save_employee_contract") {
            const r = await Employee.findOne({ _id: a.employee_id, owner: c.org }).select("firstname lastname").lean<{ firstname: string; lastname: string }>();
            return r ? `${r.firstname} ${r.lastname}`.trim() : "";
        }
    } catch { /* подпись необязательна */ }
    return "";
}
