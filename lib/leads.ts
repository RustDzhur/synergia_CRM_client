import { emit } from "@/lib/automation/emit";
import { notify } from "@/lib/notify";
import type { Fetched } from "@/lib/mail/types";
import { ensureStages } from "@/lib/stages";
import { mkActivity } from "@/lib/activities";
import { prisma } from "@/lib/prisma";

// Автоматические лиды из входящей почты: письмо от нового человека → контакт в CRM и карточка в первой колонке
// доски сделок («New Lead»). Письмо от уже известного контакта просто попадает в его ленту активности.
// Не клиент — карточку и контакт можно удалить вручную; рассылки и автописьма лидами не считаются.

// Адреса, с которых пишут роботы, а не люди
const NOISE = /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|donotreply|mailer[-_.]?daemon|postmaster|bounces?|notifications?|notify|alerts?|newsletter|automated|auto[-_.]?reply|system)([-_.+].*)?$/i;
const ADDRESS = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

export interface Sender { name: string; email: string }

const titleCase = (s: string) => s.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

// «Имя Фамилия <a@b.c>», «"Имя" <a@b.c>» или просто «a@b.c»
export function parseSender(from: string): Sender | null {
    const m = from.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/);
    const email = (m ? m[2] : from).trim().toLowerCase();
    if (!ADDRESS.test(email)) return null;
    const name = (m?.[1] ?? "").trim();
    return { email, name: name && !name.includes("@") ? name : titleCase(email.split("@")[0]) };
}

export const isRobotAddress = (email: string) => NOISE.test(email.split("@")[0]);

// Создаёт лиды из свежих входящих писем ящика ownEmail; возвращает число созданных лидов
export async function createLeadsFromMail(owner: string, ownEmail: string, mails: Fetched[]): Promise<number> {
    const inbox = mails
        .filter((m) => m.folder === "inbox" && !m.bulk)
        .sort((a, b) => a.at.getTime() - b.at.getTime());
    let created = 0;
    const seen = new Set<string>(); // от одного отправителя за раз — один лид
    let firstStage: string | null = null;

    for (const mail of inbox) {
        const sender = parseSender(mail.from);
        if (!sender || sender.email === ownEmail.toLowerCase() || isRobotAddress(sender.email)) continue;
        const subject = (mail.subject || "(no subject)").slice(0, 200);
        const activity = () => mkActivity("email", `Email: ${subject}`);

        const existing = await prisma.contact.findFirst({ where: { owner, email: { equals: sender.email, mode: "insensitive" } } });
        if (existing) {
            const acts = Array.isArray(existing.activities) ? existing.activities : [];
            acts.push(activity());
            await prisma.contact.update({ where: { id: existing.id }, data: { activities: acts } });
            continue;
        }
        if (seen.has(sender.email)) {
            const c = await prisma.contact.findFirst({ where: { owner, email: sender.email } });
            if (c) {
                const acts = Array.isArray(c.activities) ? c.activities : [];
                acts.push(activity());
                await prisma.contact.update({ where: { id: c.id }, data: { activities: acts } });
            }
            continue;
        }
        seen.add(sender.email);

        const [firstName, ...rest] = sender.name.split(" ");
        const contactDoc = await prisma.contact.create({
            data: {
                owner,
                name: sender.name,
                firstName: rest.length ? firstName : "",
                lastName: rest.join(" "),
                email: sender.email,
                source: "email",
                activities: [activity()],
            },
        });

        firstStage = firstStage ?? String((await ensureStages(owner))[0]._id);
        const order = await prisma.deal.count({ where: { owner, stage: firstStage } });
        const dealDoc = await prisma.deal.create({
            data: {
                owner,
                stage: firstStage,
                clientName: subject,
                contactName: sender.name,
                order,
                activities: [mkActivity("created", subject), mkActivity("email", `Email from ${sender.name} <${sender.email}>`)],
            },
        });
        created += 1;
        await emit(owner, { type: "lead_created", data: { id: dealDoc.id, dealId: dealDoc.id, contactId: contactDoc.id, name: sender.name, contactName: sender.name, email: sender.email, subject } });
        await notify(owner, { type: "lead", params: { name: sender.name, subject }, link: "/crm/crm", key: `lead:${sender.email}:${new Date().toISOString().slice(0, 10)}` });
    }
    return created;
}
