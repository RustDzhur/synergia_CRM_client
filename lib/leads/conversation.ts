import { emit } from "@/lib/automation/emit";
import { notify } from "@/lib/notify";
import { ensureStages } from "@/lib/stages";
import { mkActivity } from "@/lib/activities";
import { prisma } from "@/lib/prisma";
import { filterEnabled, logDecision, qualifyOne } from "./qualify";

// Лиды из чатов и звонков. Беседа с незнакомым человеком оценивается по его сообщениям (lib/leads/qualify.ts): живой интерес к
// покупке → контакт и карточка в первой колонке воронки; болтовня, спам и пустые сообщения → в воронку не идут (решение
// остаётся в журнале). Звонок без содержания (пропущенный) лидом не считается — он виден в журнале звонков; когда человек
// после него напишет, его сообщение оценится так же, как любое другое.
// Оцениваются первые сообщения беседы, пока решение не «lead» и не «junk»; три «unsure» подряд — дальше не гадаем.

const PHONE = /^\+?[\d\s()-]{7,}$/;

interface Conv { id: string; contact: string | null; name: string; externalId: string }

export async function leadFromConversation(owner: string, channel: string, conv: Conv, input: { kind?: string; text?: string; missed?: boolean }): Promise<string | null> {
    if (!filterEnabled() || conv.contact) return null;
    const prior = await prisma.sectionRecord.findMany({ where: { org: owner, key: "ai:leadlog", values: { path: ["ref"], equals: conv.id } as never }, take: 6 }).catch(() => []);
    const verdicts = prior.map((r) => String((r.values as { verdict?: string } | null)?.verdict ?? ""));
    if (verdicts.includes("lead") || verdicts.includes("junk") || verdicts.filter((v) => v === "unsure").length >= 3) return null;

    const base = { source: input.kind === "call" ? "call" : "chat", ref: conv.id, from: conv.externalId, name: conv.name, subject: `${channel}` };
    if (input.kind === "call") {
        if (!input.missed || prior.length) return null; // про один звонок одной беседы запись достаточно
        await logDecision(owner, { ...base, snippet: "", verdict: "unsure", category: "empty", score: 15, reason: "пропущенный звонок без содержания — в воронку не идёт", by: "rules" });
        return null;
    }
    const text = String(input.text ?? "").trim();
    const org = await prisma.organization.findUnique({ where: { id: owner }, select: { name: true } }).catch(() => null);
    const q = await qualifyOne(owner, org?.name ?? "", { source: "chat", from: conv.externalId, name: conv.name, text });
    if (q.verdict !== "lead") {
        await logDecision(owner, { ...base, snippet: text.slice(0, 400), verdict: q.verdict, category: q.category, score: q.score, reason: q.reason, by: q.by });
        return null;
    }

    const phone = PHONE.test(conv.externalId) ? conv.externalId : "";
    const contact = await prisma.contact.create({ data: { owner, name: conv.name || conv.externalId, ...(phone ? { phone } : {}), source: channel, activities: [mkActivity("note", `Первое сообщение (${channel}): ${text.slice(0, 300)}`)] } });
    await prisma.conversation.update({ where: { id: conv.id }, data: { contact: contact.id } }).catch(() => undefined);
    const stage = String((await ensureStages(owner))[0]._id);
    const order = await prisma.deal.count({ where: { owner, stage } });
    const title = text.replace(/\s+/g, " ").slice(0, 80) || `${channel}: ${conv.name}`;
    const deal = await prisma.deal.create({
        data: { owner, stage, clientName: title, contactName: contact.name, contact: contact.id, order, source: channel, activities: [mkActivity("created", title), mkActivity("note", `Айрис: потенциальный клиент (${q.category}, ${q.score}%) — ${q.reason}`)] },
    });
    await logDecision(owner, { ...base, snippet: text.slice(0, 400), verdict: "lead", category: q.category, score: q.score, reason: q.reason, by: q.by, dealId: deal.id });
    await emit(owner, { type: "lead_created", data: { id: deal.id, dealId: deal.id, contactId: contact.id, name: contact.name, contactName: contact.name, email: "", subject: title } });
    await notify(owner, { type: "lead", params: { name: contact.name, subject: title }, link: "/crm/crm", key: `lead:${conv.id}` });
    return deal.id;
}
