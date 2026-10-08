import { prisma } from "@/lib/prisma";
import { mkActivity } from "@/lib/activities";
import { plainFx } from "@/lib/sync/texts";
import { ensureStages } from "@/lib/stages";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { type Candidate, getLeadRules, readLog, setLeadRules, qualifyBatch } from "@/lib/leads/qualify";

// Инструменты Айрис для отбора потенциальных клиентов: массовый разбор того, что уже лежит в воронке, контактах, компаниях,
// почте и беседах; журнал отсеянного; возврат ошибочно отсеянного; чистка мусора; своё правило фирмы.
export class LeadToolError extends Error {}
export const SCOPES = ["deals", "contacts", "companies", "mail", "conversations"] as const;
type Scope = (typeof SCOPES)[number];
const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const actText = (acts: unknown, n = 6) => (Array.isArray(acts) ? acts.slice(0, n).map((a: { text?: string }) => plainFx(a?.text)).join(" · ") : "");

interface Row { id: string; title: string; cand: Candidate }

async function load(org: string, scope: Scope, limit: number): Promise<Row[]> {
    if (scope === "deals") {
        const rows = await prisma.deal.findMany({ where: { owner: org, wonAt: null }, orderBy: { updatedAt: "desc" }, take: limit });
        return rows.map((d) => ({ id: d.id, title: d.clientName, cand: { source: "deal", from: d.contactName || d.companyName, name: d.contactName, subject: d.clientName, text: `${d.companyName ? `Компания: ${d.companyName}. ` : ""}${actText(d.activities)}` } }));
    }
    if (scope === "contacts") {
        const rows = await prisma.contact.findMany({ where: { owner: org }, orderBy: { updatedAt: "desc" }, take: limit });
        return rows.map((c) => ({ id: c.id, title: `${c.name}${c.email ? ` <${c.email}>` : ""}`, cand: { source: "contact", from: c.email ?? c.name, name: c.name, subject: [c.company, c.position].filter(Boolean).join(", "), text: `${c.notes ?? ""} ${actText(c.activities)}` } }));
    }
    if (scope === "companies") {
        const rows = await prisma.company.findMany({ where: { owner: org }, orderBy: { updatedAt: "desc" }, take: limit });
        return rows.map((c) => ({ id: c.id, title: c.name, cand: { source: "company", from: c.email || c.name, name: c.name, subject: c.field, text: [c.status, c.businessType, c.address, actText(c.activities)].filter(Boolean).join(" · ") } }));
    }
    if (scope === "mail") {
        const since = new Date(Date.now() - 30 * 86400000);
        const rows = await prisma.mailMessage.findMany({ where: { owner: org, folder: "inbox", at: { gte: since } }, orderBy: { at: "desc" }, take: limit });
        return rows.map((m) => ({ id: m.id, title: `${clip(m.from, 60)} — ${clip(m.subject, 70)}`, cand: { source: "email", from: m.from, subject: m.subject ?? "", text: m.body ?? "" } }));
    }
    const rows = await prisma.conversation.findMany({ where: { owner: org }, orderBy: { lastAt: "desc" }, take: limit });
    return rows.map((c) => ({ id: c.id, title: `${c.name} (${c.channel})`, cand: { source: "chat", from: c.externalId, name: c.name, text: c.lastText ?? "" } }));
}

/** Массовый разбор: что из этого — потенциальные клиенты, а что мусор. Только читает, ничего не меняет. */
export async function analyze(org: string, orgName: string, scope: Scope, limitArg: unknown) {
    const limit = Math.min(80, Math.max(5, Math.trunc(Number(limitArg)) || 40));
    const rows = await load(org, scope, limit);
    if (!rows.length) return { scope, checked: 0, counts: { lead: 0, junk: 0, unsure: 0 }, junk: [], unsure: [] };
    const q = await qualifyBatch(org, orgName, rows.map((r) => r.cand));
    const counts = { lead: 0, junk: 0, unsure: 0 };
    const junk: unknown[] = [], unsure: unknown[] = [];
    rows.forEach((r, i) => {
        counts[q[i].verdict]++;
        const item = { id: r.id, title: clip(r.title, 90), category: q[i].category, reason: q[i].reason };
        if (q[i].verdict === "junk" && junk.length < 25) junk.push(item);
        else if (q[i].verdict === "unsure" && unsure.length < 15) unsure.push(item);
    });
    return { scope, checked: rows.length, counts, junk, unsure, hint: scope === "deals" || scope === "contacts" || scope === "companies" ? "To remove the junk ones call cleanup_leads with their ids (it asks the user first)." : "Mail is not deleted by this — it only shows what would not become a lead." };
}

export async function leadLog(org: string, verdict: unknown, limit: unknown) {
    const entries = await readLog(org, { verdict: ["lead", "junk", "unsure"].includes(String(verdict)) ? String(verdict) : undefined, limit: Math.trunc(Number(limit)) || 15 });
    return { rules: await getLeadRules(org), entries: entries.map((e) => ({ id: e.id, at: e.at.slice(0, 16).replace("T", " "), source: e.source, from: clip(e.from, 60), subject: clip(e.subject, 70), verdict: e.verdict, category: e.category, score: e.score, reason: e.reason, dealId: e.dealId })) };
}

/** Возвращает ошибочно отсеянное: создаёт контакт и карточку в первой колонке воронки по записи журнала. */
export async function restoreLead(org: string, id: string) {
    const rec = await prisma.sectionRecord.findFirst({ where: { org, key: "ai:leadlog", rid: id } });
    if (!rec) throw new LeadToolError("No such entry in the filter log");
    const e = rec.values as { source: string; from: string; name?: string; subject: string; snippet: string; dealId?: string; reason: string };
    if (e.dealId) throw new LeadToolError("This one is already in the pipeline");
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.from) ? e.from.toLowerCase() : "";
    const name = e.name || e.from;
    let contact = email ? await prisma.contact.findFirst({ where: { owner: org, email: { equals: email, mode: "insensitive" } } }) : null;
    if (!contact) contact = await prisma.contact.create({ data: { owner: org, name, email: email || null, source: e.source === "email" ? "email" : e.source, activities: [mkActivity("note", `Вернула вручную: ${e.snippet.slice(0, 300)}`)] } });
    const stage = String((await ensureStages(org))[0]._id);
    const order = await prisma.deal.count({ where: { owner: org, stage } });
    const title = e.subject && e.subject !== e.source ? e.subject : `${name}`;
    const deal = await prisma.deal.create({ data: { owner: org, stage, clientName: title, contactName: contact.name, contact: contact.id, order, activities: [mkActivity("created", title), mkActivity("note", e.snippet.slice(0, 300))] } });
    await prisma.sectionRecord.update({ where: { id: rec.id }, data: { values: { ...(rec.values as object), verdict: "lead", dealId: deal.id, reason: `${e.reason} (вернули вручную)` } as never } });
    await emit(org, { type: "lead_created", data: { id: deal.id, dealId: deal.id, contactId: contact.id, name: contact.name, contactName: contact.name, email, subject: title } });
    return { name: contact.name, deal: deal.id };
}

/** Удаляет мусорные карточки/контакты/компании по id (вызывается только после подтверждения человека). */
export async function cleanup(org: string, userId: string, entity: "deal" | "contact" | "company", ids: string[]) {
    const clean = Array.from(new Set(ids.filter((i) => /^[A-Za-z0-9_-]{10,40}$/.test(i)))).slice(0, 100);
    if (!clean.length) throw new LeadToolError("No valid ids");
    const where = { id: { in: clean }, owner: org };
    const res = entity === "deal" ? await prisma.deal.deleteMany({ where }) : entity === "contact" ? await prisma.contact.deleteMany({ where }) : await prisma.company.deleteMany({ where });
    await logAudit({ org, userId, action: `${entity}.bulk_deleted`, entityType: entity, entityId: clean[0], summary: `${res.count} ${entity}(s) removed as non-leads via assistant`, meta: { count: res.count } }).catch(() => undefined);
    return { count: res.count };
}

export async function saveRules(org: string, text: string) {
    await setLeadRules(org, text);
    return { rules: text.trim().slice(0, 1500) };
}
