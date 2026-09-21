import { ProviderError, fetchProvider } from "@/lib/http";
import { notify } from "@/lib/notify";
import { assertPublicHost } from "@/lib/mail/hosts";
import { sendFromAccount } from "@/lib/mail";
import { randomToken } from "@/lib/crypto";
import AutomationJob from "@/models/AutomationJob";
import Contact from "@/models/Contact";
import Deal from "@/models/Deal";
import Integration from "@/models/Integration";
import Organization from "@/models/Organization";
import SectionRecord from "@/models/SectionRecord";
import Stage from "@/models/Stage";
import Task from "@/models/Task";
import User from "@/models/User";

// Автоматизация (как триггеры в Bitrix24/HubSpot): событие CRM → подходящие правила → действие сразу или через заданное время.
// Правила лежат в записях раздела Automation (key "automation:rules"), переменные и константы — там же, журнал — "automation:logs".
export const EVENTS = ["deal_created", "deal_stage", "contact_created", "lead_created", "message_received", "call_missed", "task_created", "deadline"] as const;
export type EventType = (typeof EVENTS)[number];
export const ACTIONS = ["notify", "create_task", "add_note", "move_stage", "send_email", "webhook"] as const;

export interface AutoEvent {
    type: EventType;
    // deal: { id, name, stageId, stageName, contactName, email }; contact: { id, name, email, phone }; task: { id, title };
    // message: { from, text, channel }; deadline: { kind, title, stage }
    data: Record<string, string>;
    auto?: boolean; // событие вызвано самой автоматизацией — правила на него не реагируют (защита от циклов)
}

const DELAY_MIN: Record<string, number> = { immediately: 0, after_1h: 60, after_1d: 1440, after_3d: 4320 };
type Rule = { id: string; values: Record<string, string> };
const RULES = "automation:rules";

async function keyValues(org: string, key: string) {
    const rows = await SectionRecord.find({ org, key, rid: { $ne: "__init__" } });
    return Object.fromEntries(rows.map((r) => [String(r.values?.name ?? ""), String(r.values?.value ?? "")]).filter(([k]) => k));
}

// «Здравствуйте, {{contact.name}}!» → значения события, констант и переменных раздела
export async function render(org: string, template: string, ev: AutoEvent) {
    const [constants, variables] = await Promise.all([keyValues(org, "automation:constants"), keyValues(org, "automation:variables")]);
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
        const [head, ...rest] = path.split(".");
        const name = rest.join(".");
        if (head === "constants") return constants[name] ?? "";
        if (head === "variables") return variables[name] ?? "";
        const bucket = ev.type.startsWith("deal") ? "deal" : ev.type.startsWith("contact") || ev.type === "lead_created" ? "contact" : ev.type.startsWith("task") ? "task" : ev.type.startsWith("message") || ev.type === "call_missed" ? "message" : "deadline";
        if (head === bucket || head === "event") return ev.data[name] ?? "";
        return ev.data[path] ?? ev.data[name] ?? "";
    });
}

async function log(org: string, rule: Rule, status: "success" | "error", message: string) {
    try {
        await SectionRecord.updateOne({ org, key: "automation:logs", rid: "__init__" }, { $setOnInsert: { values: {} } }, { upsert: true });
        await SectionRecord.create({ org, key: "automation:logs", rid: randomToken(5), values: { name: rule.values.name ?? "", date: new Date().toISOString().slice(0, 10), status, message: message.slice(0, 300) } });
        const extra = await SectionRecord.find({ org, key: "automation:logs", rid: { $ne: "__init__" } }).sort({ createdAt: -1 }).skip(200).select("_id");
        if (extra.length) await SectionRecord.deleteMany({ _id: { $in: extra.map((e) => e._id) } });
    } catch (e) {
        console.error("automation log failed", e);
    }
}

// ── действия ──────────────────────────────────────────────────────────────────

async function clientEmail(org: string, ev: AutoEvent) {
    if (ev.data.email) return ev.data.email;
    const name = ev.data.contactName || ev.data.name;
    if (!name) return "";
    const c = await Contact.findOne({ owner: org, name, email: { $exists: true, $ne: "" } }).select("email");
    return c?.email ?? "";
}

async function perform(org: string, rule: Rule, ev: AutoEvent): Promise<string> {
    const v = rule.values;
    const text = await render(org, v.message || v.name || "", ev);
    switch (v.action) {
        case "notify": {
            await notify(org, { type: "automation", params: { text: text || v.name }, link: ev.type.startsWith("deal") || ev.type === "lead_created" ? "/crm/crm" : ev.type.startsWith("task") || ev.type === "deadline" ? "/crm/tasks" : "/crm/collaboration/chat-and-calls", key: `auto:${rule.id}:${randomToken(4)}` });
            return "Notification sent";
        }
        case "create_task": {
            const owner = await Organization.findById(org).select("ownerUser");
            const me = owner ? await User.findById(owner.ownerUser).select("firstname") : null;
            const task = await Task.create({ owner: org, title: (text || v.name).slice(0, 200), createdBy: "Automation", responsible: v.target === "responsible" ? ev.data.responsible || me?.firstname || "" : me?.firstname || "" });
            return `Task created: ${task.title}`;
        }
        case "add_note": {
            const entry = { type: "note", text: text.slice(0, 2000) || v.name, meta: "" };
            if (ev.data.id && (ev.type.startsWith("deal") || ev.type === "lead_created")) {
                const r = await Deal.updateOne({ _id: ev.data.dealId || ev.data.id, owner: org }, { $push: { activities: entry } }).catch(() => ({ matchedCount: 0 }));
                if (r.matchedCount) return "Note added to the deal";
            }
            if (ev.data.contactId || ev.type === "contact_created" || ev.type === "lead_created") {
                const id = ev.data.contactId || ev.data.id;
                const r = await Contact.updateOne({ _id: id, owner: org }, { $push: { activities: entry } }).catch(() => ({ matchedCount: 0 }));
                if (r.matchedCount) return "Note added to the contact";
            }
            throw new ProviderError("Nothing to attach the note to for this event");
        }
        case "move_stage": {
            const dealId = ev.data.dealId || (ev.type.startsWith("deal") || ev.type === "lead_created" ? ev.data.id : "");
            if (!dealId) throw new ProviderError("This event has no deal to move");
            const stage = await Stage.findOne({ _id: v.moveTo, owner: org });
            if (!stage) throw new ProviderError("The target stage does not exist");
            const deal = await Deal.findOne({ _id: dealId, owner: org });
            if (!deal) throw new ProviderError("The deal no longer exists");
            if (String(deal.stage) !== String(stage._id)) {
                deal.stage = stage._id;
                deal.activities.push({ type: "stage", text: stage.name, meta: "" });
                await deal.save();
            }
            return `Deal moved to “${stage.name}”`;
        }
        case "send_email": {
            const account = await Integration.findOne({ owner: org, type: "mail", status: "connected" });
            if (!account) throw new ProviderError("No connected mailbox: connect one in Web Mails");
            const to = v.target === "client" ? await clientEmail(org, ev) : (await User.findById((await Organization.findById(org).select("ownerUser"))?.ownerUser).select("email"))?.email ?? "";
            if (!to) throw new ProviderError(v.target === "client" ? "The client has no email address" : "The recipient has no email address");
            await sendFromAccount(account, { to, subject: (await render(org, v.name || "Firmspace CRM", ev)).slice(0, 200), text });
            return `Email sent to ${to}`;
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
        const rows = await SectionRecord.find({ org, key: RULES, rid: { $ne: "__init__" } });
        for (const row of rows) {
            const rule: Rule = { id: row.rid, values: (row.values ?? {}) as Record<string, string> };
            if (!matches(rule, ev)) continue;
            const minutes = DELAY_MIN[rule.values.timing] ?? 0;
            if (minutes === 0) await runRule(org, rule, { ...ev, auto: true });
            else await AutomationJob.create({ org, rule: rule.id, event: ev, runAt: new Date(Date.now() + minutes * 60_000) });
        }
    } catch (e) {
        console.error("automation fireEvent failed", e);
    }
}

// Выполняет наступившие отложенные действия. Вызывается, пока кто-то из фирмы работает в CRM (опрос уведомлений),
// и раз в сутки по расписанию (/api/cron/automation) — на случай, когда CRM никто не открывал.
const lastRun = new Map<string, number>();
export async function runDueJobs(org?: string, throttleMs = 20_000) {
    if (org) {
        if (Date.now() - (lastRun.get(org) ?? 0) < throttleMs) return 0;
        lastRun.set(org, Date.now());
    }
    let done = 0;
    for (let i = 0; i < 25; i++) {
        const job = await AutomationJob.findOneAndUpdate({ ...(org ? { org } : {}), done: false, runAt: { $lte: new Date() } }, { done: true }, { sort: { runAt: 1 } });
        if (!job) break;
        const orgId = String(job.org);
        const row = await SectionRecord.findOne({ org: orgId, key: RULES, rid: job.rule });
        if (!row || row.values?.enabled === "0") continue; // правило удалили или выключили, пока ждало
        const rule: Rule = { id: row.rid, values: row.values as Record<string, string> };
        const ev = job.event as AutoEvent;
        // сделка ушла с этапа, к которому привязано правило, — действие уже не нужно
        if (rule.values.stage && ["deal_created", "deal_stage"].includes(ev.type)) {
            const deal = await Deal.findOne({ _id: ev.data.id, owner: orgId }).select("stage");
            if (!deal || String(deal.stage) !== rule.values.stage) { await log(orgId, rule, "success", "Skipped: the deal left this stage"); continue; }
        }
        await runRule(orgId, rule, { ...ev, auto: true });
        done += 1;
    }
    return done;
}

// Данные сделки для события
export async function dealEvent(org: string, deal: { _id: unknown; clientName: string; stage: unknown; contactName?: string; responsible?: string }, type: "deal_created" | "deal_stage"): Promise<AutoEvent> {
    const stage = await Stage.findOne({ _id: deal.stage, owner: org }).select("name");
    const contact = deal.contactName ? await Contact.findOne({ owner: org, name: deal.contactName }).select("email") : null;
    return { type, data: { id: String(deal._id), name: deal.clientName, stageId: String(deal.stage), stageName: stage?.name ?? "", contactName: deal.contactName ?? "", email: contact?.email ?? "", responsible: deal.responsible ?? "" } };
}
