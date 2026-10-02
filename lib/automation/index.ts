import { ProviderError, fetchProvider } from "@/lib/http";
import { notify } from "@/lib/notify";
import { assertPublicHost } from "@/lib/mail/hosts";
import { sendFromAccount } from "@/lib/mail";
import { randomToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

// Автоматизация (как триггеры в Bitrix24/HubSpot): событие CRM → подходящие правила → действие сразу или через заданное время.
// Правила лежат в записях раздела Automation (key "automation:rules"), переменные и константы — там же, журнал — "automation:logs".
export const EVENTS = [
    "deal_created", "deal_stage", "contact_created", "lead_created", "message_received", "call_missed", "task_created", "deadline",
    "order_created", "order_status", "invoice_sent", "invoice_paid", "invoice_overdue", "contract_signed", "quote_sent",
    "invoice_credit_note_created", "invoice_recurring_created", "invoice_reminder",
] as const;
export type EventType = (typeof EVENTS)[number];
export const ACTIONS = ["notify", "create_task", "add_note", "move_stage", "send_email", "webhook", "ai_action"] as const;

export interface AutoEvent {
    type: EventType;
    data: Record<string, string>;
    auto?: boolean;
}

const DELAY_MIN: Record<string, number> = { immediately: 0, after_1h: 60, after_1d: 1440, after_3d: 4320 };
type Rule = { id: string; values: Record<string, string> };
const RULES = "automation:rules";

async function keyValues(org: string, key: string) {
    const rows = await prisma.sectionRecord.findMany({ where: { org, key, rid: { not: "__init__" } } });
    return Object.fromEntries(rows.map((r) => [String((r.values as any)?.name ?? ""), String((r.values as any)?.value ?? "")]).filter(([k]) => k));
}

// Какая сущность стоит за событием — на неё и «нанизываются» поля события (deal.stageName, task.title, invoice.number)
function eventBucket(type: string) {
    return type.startsWith("deal") ? "deal" : type.startsWith("contact") || type === "lead_created" ? "contact" : type.startsWith("task") ? "task"
        : type.startsWith("message") || type === "call_missed" ? "message"
        : type.startsWith("order") ? "order" : type.startsWith("invoice") ? "invoice" : type.startsWith("contract") ? "contract" : type.startsWith("quote") ? "quote"
        : "deadline";
}

const ALIASES: Record<string, string[]> = {
    "contact.name": ["contactName", "name", "from", "customerName"],
    "contact.email": ["email", "contactEmail"],
    "deal.name": ["customerName"],
    "deal.contactName": ["contactName"],
    "deal.stageName": ["stageName"],
    "task.title": ["title"],
    "message.text": ["text"],
    "message.from": ["from", "name"],
};

function eventView(ev: AutoEvent) {
    const bucket = eventBucket(ev.type);
    const view: Record<string, string> = { "event.type": ev.type };
    for (const [k, v] of Object.entries(ev.data)) {
        const s = String(v ?? "");
        if (!(k in view)) view[k] = s;
        if (!view[`${bucket}.${k}`]) view[`${bucket}.${k}`] = s;
    }
    for (const [path, sources] of Object.entries(ALIASES)) {
        if (view[path]) continue;
        const found = sources.map((s) => view[s]).find(Boolean);
        if (found) view[path] = found;
    }
    // номер документа один и тот же у счёта, заказа, предложения и договора
    if (view.number) for (const b of ["invoice", "order", "quote", "contract"]) if (!view[`${b}.number`]) view[`${b}.number`] = view.number;
    return view;
}

// «Здравствуйте, {{contact.name}}!» → значения события, констант и переменных раздела
export async function render(org: string, template: string, ev: AutoEvent) {
    if (!template.includes("{{")) return template;
    const [constants, variables] = await Promise.all([keyValues(org, "automation:constants"), keyValues(org, "automation:variables")]);
    const view = eventView(ev);
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
        const [head, ...rest] = path.split(".");
        if (head === "constants") return constants[rest.join(".")] ?? "";
        if (head === "variables") return variables[rest.join(".")] ?? "";
        return view[path] ?? "";
    });
}

async function log(org: string, rule: Rule, status: "success" | "error", message: string) {
    try {
        const initExists = await prisma.sectionRecord.findFirst({ where: { org, key: "automation:logs", rid: "__init__" } });
        if (!initExists) await prisma.sectionRecord.create({ data: { org, key: "automation:logs", rid: "__init__", values: {} } });
        await prisma.sectionRecord.create({ data: { org, key: "automation:logs", rid: randomToken(5), values: { name: rule.values.name ?? "", date: new Date().toISOString().slice(0, 10), status, message: message.slice(0, 300) } as any } });
        const extra = await prisma.sectionRecord.findMany({ where: { org, key: "automation:logs", rid: { not: "__init__" } }, orderBy: { createdAt: "desc" }, skip: 200, select: { id: true } });
        if (extra.length) await prisma.sectionRecord.deleteMany({ where: { id: { in: extra.map((e) => e.id) } } });
    } catch (e) {
        console.error("automation log failed", e);
    }
}

// ── действия ──────────────────────────────────────────────────────────────────

async function clientEmail(org: string, ev: AutoEvent) {
    if (ev.data.email) return ev.data.email;
    const name = ev.data.contactName || ev.data.name;
    if (!name) return "";
    const c = await prisma.contact.findFirst({ where: { owner: org, name, email: { not: "" } }, select: { email: true } });
    return c?.email ?? "";
}

const LINKS: [string, string][] = [
    ["/crm/crm", "deal"],
    ["/crm/tasks", "task"],
    ["/crm/finance?tab=invoices", "invoice"],
    ["/crm/finance?tab=orders", "order"],
    ["/crm/finance?tab=quotes", "quote"],
    ["/crm/finance?tab=contracts", "contract"],
];
function eventLink(ev: AutoEvent) {
    const bucket = eventBucket(ev.type);
    if (ev.type === "lead_created") return "/crm/crm";
    if (ev.type === "deadline") return "/crm/tasks";
    if (ev.type === "contact_created") return "/crm/crm/contacts";
    return LINKS.find(([, b]) => b === bucket)?.[0] ?? "/crm/collaboration/chat-and-calls";
}

// $push в activities (Json-массив): читаем, добавляем, пишем — запись одна, гонок здесь нет
async function pushActivity(kind: "deal" | "contact", id: string, owner: string, entry: Record<string, unknown>): Promise<boolean> {
    if (kind === "deal") {
        const doc = await prisma.deal.findFirst({ where: { id, owner }, select: { id: true, activities: true } });
        if (!doc) return false;
        await prisma.deal.update({ where: { id: doc.id }, data: { activities: [...((doc.activities as any[]) ?? []), entry] as any } });
        return true;
    }
    const doc = await prisma.contact.findFirst({ where: { id, owner }, select: { id: true, activities: true } });
    if (!doc) return false;
    await prisma.contact.update({ where: { id: doc.id }, data: { activities: [...((doc.activities as any[]) ?? []), entry] as any } });
    return true;
}

async function perform(org: string, rule: Rule, ev: AutoEvent): Promise<string> {
    const v = rule.values;
    const text = await render(org, v.message || v.name || "", ev);
    switch (v.action) {
        case "notify": {
            await notify(org, { type: "automation", params: { text: text || v.name }, link: eventLink(ev), key: `auto:${rule.id}:${randomToken(4)}` });
            return "Notification sent";
        }
        case "create_task": {
            const owner = await prisma.organization.findUnique({ where: { id: org }, select: { ownerUser: true } });
            const me = owner ? await prisma.user.findUnique({ where: { id: owner.ownerUser }, select: { firstname: true } }) : null;
            const task = await prisma.task.create({ data: { owner: org, title: (text || v.name).slice(0, 200), createdBy: "Automation", responsible: v.target === "responsible" ? ev.data.responsible || me?.firstname || "" : me?.firstname || "" } });
            return `Task created: ${task.title}`;
        }
        case "add_note": {
            const entry = { type: "note", text: text.slice(0, 2000) || v.name, meta: "" };
            if (ev.data.id && (ev.type.startsWith("deal") || ev.type === "lead_created")) {
                if (await pushActivity("deal", ev.data.dealId || ev.data.id, org, entry)) return "Note added to the deal";
            }
            if (ev.data.contactId || ev.type === "contact_created" || ev.type === "lead_created") {
                if (await pushActivity("contact", ev.data.contactId || ev.data.id, org, entry)) return "Note added to the contact";
            }
            throw new ProviderError("Nothing to attach the note to for this event");
        }
        case "move_stage": {
            const dealId = ev.data.dealId || (ev.type.startsWith("deal") || ev.type === "lead_created" ? ev.data.id : "");
            if (!dealId) throw new ProviderError("This event has no deal to move");
            const stage = await prisma.stage.findFirst({ where: { id: v.moveTo, owner: org } });
            if (!stage) throw new ProviderError("The target stage does not exist");
            const deal = await prisma.deal.findFirst({ where: { id: dealId, owner: org } });
            if (!deal) throw new ProviderError("The deal no longer exists");
            if (String(deal.stage) !== String(stage.id)) {
                await prisma.deal.update({ where: { id: deal.id }, data: { stage: stage.id, activities: [...((deal.activities as any[]) ?? []), { type: "stage", text: stage.name, meta: "" }] as any } });
            }
            return `Deal moved to “${stage.name}”`;
        }
        case "send_email": {
            const account = await prisma.integration.findFirst({ where: { owner: org, type: "mail", status: "connected" } });
            if (!account) throw new ProviderError("No connected mailbox: connect one in Web Mails");
            let to = "";
            if (v.target === "client") to = await clientEmail(org, ev);
            else {
                const ownerDoc = await prisma.organization.findUnique({ where: { id: org }, select: { ownerUser: true } });
                const u = ownerDoc ? await prisma.user.findUnique({ where: { id: ownerDoc.ownerUser }, select: { email: true } }) : null;
                to = u?.email ?? "";
            }
            if (!to) throw new ProviderError(v.target === "client" ? "The client has no email address" : "The recipient has no email address");
            await sendFromAccount(account as any, { to, subject: (await render(org, v.name || "Firmspace CRM", ev)).slice(0, 200), text });
            return `Email sent to ${to}`;
        }
        case "ai_action": {
            const { orgFeatures } = await import("@/lib/features");
            const orgDoc = await prisma.organization.findUnique({ where: { id: org }, select: { plan: true, planOverride: true, planOverrideUntil: true, featureOverrides: true } });
            if (!orgFeatures(orgDoc ?? {}).aiAutomation) {
                throw new ProviderError("This firm's plan no longer includes the autonomous AI automation step");
            }
            const { runAiAction } = await import("@/lib/ai/automationStep");
            return await runAiAction(org, v.message || "", ev);
        }
        case "webhook": {
            let url: URL;
            try { url = new URL(v.url); } catch { throw new ProviderError("Webhook address is not valid"); }
            if (url.protocol !== "https:") throw new ProviderError("Webhook address must start with https://");
            await assertPublicHost(url.hostname);
            const res = await fetchProvider(url.toString(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rule: v.name, event: ev.type, data: ev.data, text }) });
            if (!res.ok) throw new ProviderError(`Webhook answered ${res.status}`);
            return `Webhook delivered (${res.status})`;
        }
        default:
            throw new ProviderError("The rule has no action");
    }
}

// Выполняет действие правила и пишет результат в журнал; ошибка действия не роняет вызывающую операцию
export async function runRule(org: string, rule: Rule, ev: AutoEvent) {
    try {
        const message = await perform(org, rule, ev);
        await log(org, rule, "success", message);
        return { ok: true, message };
    } catch (e) {
        const message = e instanceof ProviderError ? e.message : "Unexpected error";
        if (!(e instanceof ProviderError)) console.error("automation action failed", e);
        await log(org, rule, "error", message);
        return { ok: false, message };
    }
}

const matches = (rule: Rule, ev: AutoEvent) =>
    rule.values.enabled !== "0" &&
    rule.values.event === ev.type &&
    (!rule.values.stage || !["deal_created", "deal_stage"].includes(ev.type) || rule.values.stage === ev.data.stageId);

// Событие CRM: находит подходящие правила и запускает их сразу или ставит в очередь на заданное время. Не бросает исключений.
export async function fireEvent(org: string, ev: AutoEvent) {
    if (ev.auto) return;
    try {
        const rows = await prisma.sectionRecord.findMany({ where: { org, key: RULES, rid: { not: "__init__" } } });
        for (const row of rows) {
            const rule: Rule = { id: row.rid, values: ((row.values ?? {}) as Record<string, string>) };
            if (!matches(rule, ev)) continue;
            const minutes = DELAY_MIN[rule.values.timing] ?? 0;
            if (minutes === 0) await runRule(org, rule, { ...ev, auto: true });
            else await prisma.automationJob.create({ data: { org, rule: rule.id, event: ev as any, runAt: new Date(Date.now() + minutes * 60_000) } });
        }
    } catch (e) {
        console.error("automation fireEvent failed", e);
    }
}

// Выполняет наступившие отложенные действия.
const lastRun = new Map<string, number>();
export async function runDueJobs(org?: string, throttleMs = 20_000) {
    if (org) {
        if (Date.now() - (lastRun.get(org) ?? 0) < throttleMs) return 0;
        lastRun.set(org, Date.now());
    }
    let done = 0;
    for (let i = 0; i < 25; i++) {
        // Атомарный «claim»: находим ближайшую готовую задачу и сразу помечаем её выполненной
        const job = await prisma.automationJob.findFirst({ where: { ...(org ? { org } : {}), done: false, runAt: { lte: new Date() } }, orderBy: { runAt: "asc" } });
        if (!job) break;
        await prisma.automationJob.update({ where: { id: job.id }, data: { done: true } });
        const orgId = String(job.org);
        const row = await prisma.sectionRecord.findFirst({ where: { org: orgId, key: RULES, rid: job.rule } });
        if (!row || (row.values as any)?.enabled === "0") continue; // правило удалили или выключили, пока ждало
        const rule: Rule = { id: row.rid, values: (row.values ?? {}) as Record<string, string> };
        const ev = job.event as unknown as AutoEvent;
        // сделка ушла с этапа, к которому привязано правило, — действие уже не нужно
        if (rule.values.stage && ["deal_created", "deal_stage"].includes(ev.type)) {
            const deal = await prisma.deal.findFirst({ where: { id: ev.data.id, owner: orgId }, select: { stage: true } });
            if (!deal || String(deal.stage) !== rule.values.stage) { await log(orgId, rule, "success", "Skipped: the deal left this stage"); continue; }
        }
        await runRule(orgId, rule, { ...ev, auto: true });
        done += 1;
    }
    return done;
}

// Данные сделки для события
export async function dealEvent(org: string, deal: { id?: string; _id?: unknown; clientName: string; stage: unknown; contactName?: string; responsible?: string }, type: "deal_created" | "deal_stage"): Promise<AutoEvent> {
    const dealId = deal.id ?? String(deal._id ?? "");
    const stage = await prisma.stage.findFirst({ where: { id: String(deal.stage), owner: org }, select: { name: true } });
    const contact = deal.contactName ? await prisma.contact.findFirst({ where: { owner: org, name: deal.contactName }, select: { email: true } }) : null;
    return { type, data: { id: dealId, name: deal.clientName, stageId: String(deal.stage), stageName: stage?.name ?? "", contactName: deal.contactName ?? "", email: contact?.email ?? "", responsible: deal.responsible ?? "" } };
}
