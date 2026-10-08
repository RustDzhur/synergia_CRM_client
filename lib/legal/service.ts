import { prisma } from "@/lib/prisma";
import { fillTemplate, templateVars } from "./diff";

// Хранилище договоров клиента (docs/TZ_MASTER.md §5.2 п. 10). Версии не перезаписываются: каждая правка — новая версия.
// Текст, подготовленный ИИ, помечается aiDraft и везде показывается как «черновик для проверки специалистом».
// Платформа не даёт юридических заключений: чек-лист — памятка для проверки, решение остаётся за специалистом.

export class LegalError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}

export const LEGAL_STATUSES = ["draft", "in_review", "approved", "rejected", "signed", "archived"] as const;
export type LegalStatus = (typeof LEGAL_STATUSES)[number];
// допустимые переходы: подписанное не возвращается в черновик, только архивируется
const NEXT: Record<LegalStatus, LegalStatus[]> = {
    draft: ["in_review", "archived"], in_review: ["approved", "rejected", "draft"], approved: ["signed", "in_review", "archived"],
    rejected: ["draft", "archived"], signed: ["archived"], archived: [],
};
export const CHECKLIST_ITEMS = ["parties", "subject", "price_terms", "term_termination", "liability", "confidentiality", "governing_law", "signatures"] as const;

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\p{Cc}<>]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const longText = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max) : "");
const DATE = /^\d{4}-\d{2}-\d{2}$/;
type Actor = { userId: string; name: string };

async function syncReminder(doc: { id: string; org: string; title: string; dueDate: string; reminderEvent: string | null }, actor: Actor) {
    // напоминание о сроке — событие календаря фирмы; смена срока двигает событие, пустой срок убирает его
    if (doc.reminderEvent) await prisma.event.deleteMany({ where: { id: doc.reminderEvent, org: doc.org } });
    if (!doc.dueDate) { await prisma.legalDoc.update({ where: { id: doc.id }, data: { reminderEvent: null } }); return; }
    const ev = await prisma.event.create({ data: { org: doc.org, title: `⚖ ${doc.title}`, description: "Contract deadline", date: doc.dueDate, reminder: 1440, createdBy: actor.userId, createdByName: actor.name, source: "legal" } });
    await prisma.legalDoc.update({ where: { id: doc.id }, data: { reminderEvent: ev.id } });
}

export async function createDoc(org: string, actor: Actor, input: { title?: unknown; counterparty?: unknown; body?: unknown; dueDate?: unknown; aiDraft?: unknown; note?: unknown }) {
    const title = clean(input.title, 160);
    if (title.length < 2) throw new LegalError("Enter the title");
    const body = longText(input.body, 200_000);
    if (!body.trim()) throw new LegalError("The text is empty");
    const due = typeof input.dueDate === "string" && DATE.test(input.dueDate) ? input.dueDate : "";
    const doc = await prisma.legalDoc.create({ data: { org, title, counterparty: clean(input.counterparty, 160), dueDate: due, createdBy: actor.userId, createdByName: actor.name } });
    await prisma.legalDocVersion.create({ data: { org, doc: doc.id, n: 1, body, note: clean(input.note, 300), aiDraft: input.aiDraft === true, createdBy: actor.userId, createdByName: actor.name } });
    if (due) await syncReminder(doc, actor);
    return doc;
}

export const listDocs = (org: string) => prisma.legalDoc.findMany({ where: { org }, orderBy: { updatedAt: "desc" }, take: 200 });

export async function getDoc(org: string, id: string) {
    const doc = await prisma.legalDoc.findFirst({ where: { id, org } });
    if (!doc) throw new LegalError("Not found", 404);
    const versions = await prisma.legalDocVersion.findMany({ where: { org, doc: id }, orderBy: { n: "desc" } });
    return { doc, versions };
}

export async function addVersion(org: string, actor: Actor, id: string, input: { body?: unknown; note?: unknown; aiDraft?: unknown }) {
    const doc = await prisma.legalDoc.findFirst({ where: { id, org } });
    if (!doc) throw new LegalError("Not found", 404);
    if (doc.status === "signed" || doc.status === "archived") throw new LegalError("A signed or archived document cannot get a new version — create a new document", 409);
    const body = longText(input.body, 200_000);
    if (!body.trim()) throw new LegalError("The text is empty");
    const last = await prisma.legalDocVersion.findFirst({ where: { org, doc: id }, orderBy: { n: "desc" } });
    if (last?.body === body) throw new LegalError("The text has not changed", 409);
    const n = (last?.n ?? 0) + 1;
    await prisma.legalDocVersion.create({ data: { org, doc: id, n, body, note: clean(input.note, 300), aiDraft: input.aiDraft === true, createdBy: actor.userId, createdByName: actor.name } });
    // после правки согласование начинается заново
    return prisma.legalDoc.update({ where: { id }, data: { currentVersion: n, status: "draft" } });
}

export async function setStatus(org: string, id: string, status: unknown) {
    const doc = await prisma.legalDoc.findFirst({ where: { id, org } });
    if (!doc) throw new LegalError("Not found", 404);
    if (!(LEGAL_STATUSES as readonly string[]).includes(String(status))) throw new LegalError("Invalid status");
    if (!NEXT[doc.status as LegalStatus].includes(status as LegalStatus)) throw new LegalError(`Cannot move from ${doc.status} to ${status}`, 409);
    return prisma.legalDoc.update({ where: { id }, data: { status: status as string } });
}

export async function setDue(org: string, actor: Actor, id: string, due: unknown) {
    const doc = await prisma.legalDoc.findFirst({ where: { id, org } });
    if (!doc) throw new LegalError("Not found", 404);
    const dueDate = typeof due === "string" && DATE.test(due) ? due : "";
    const upd = await prisma.legalDoc.update({ where: { id }, data: { dueDate } });
    await syncReminder(upd, actor);
    return prisma.legalDoc.findUnique({ where: { id } });
}

export async function setChecklist(org: string, id: string, items: unknown) {
    const doc = await prisma.legalDoc.findFirst({ where: { id, org } });
    if (!doc) throw new LegalError("Not found", 404);
    const o = (items && typeof items === "object" ? items : {}) as Record<string, unknown>;
    const checklist = Object.fromEntries(CHECKLIST_ITEMS.map((k) => [k, o[k] === true]));
    return prisma.legalDoc.update({ where: { id }, data: { checklist } });
}

// ── шаблоны с переменными ─────────────────────────────────────────────────────────────────────────────────

export async function createTemplate(org: string, actor: Actor, input: { name?: unknown; body?: unknown }) {
    const name = clean(input.name, 120), body = longText(input.body, 100_000);
    if (name.length < 2 || !body.trim()) throw new LegalError("Enter the name and the text");
    if ((await prisma.legalTemplate.count({ where: { org } })) >= 100) throw new LegalError("Too many templates", 409);
    return prisma.legalTemplate.create({ data: { org, name, body, createdBy: actor.userId } });
}
export const listTemplates = async (org: string) => (await prisma.legalTemplate.findMany({ where: { org }, orderBy: { createdAt: "desc" } })).map((t) => ({ ...t, vars: templateVars(t.body) }));
export async function deleteTemplate(org: string, id: string) {
    const r = await prisma.legalTemplate.deleteMany({ where: { id, org } });
    if (!r.count) throw new LegalError("Not found", 404);
}
/** Документ из шаблона: переменные подставляются, неуказанные остаются {{так}} — это видно в тексте и в чек-листе. */
export async function docFromTemplate(org: string, actor: Actor, templateId: string, input: { title?: unknown; counterparty?: unknown; values?: unknown; dueDate?: unknown }) {
    const t = await prisma.legalTemplate.findFirst({ where: { id: templateId, org } });
    if (!t) throw new LegalError("Not found", 404);
    const values = Object.fromEntries(Object.entries((input.values && typeof input.values === "object" ? input.values : {}) as Record<string, unknown>).map(([k, v]) => [k, clean(v, 300)]));
    return createDoc(org, actor, { title: input.title || t.name, counterparty: input.counterparty, body: fillTemplate(t.body, values), dueDate: input.dueDate, note: `template: ${t.name}` });
}
