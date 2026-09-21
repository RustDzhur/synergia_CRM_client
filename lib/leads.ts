import { notify } from "@/lib/notify";
import type { Fetched } from "@/lib/mail/types";
import { ensureStages } from "@/lib/stages";
import Contact from "@/models/Contact";
import Deal from "@/models/Deal";

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

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
        const activity = { type: "email", text: `Email: ${subject}`, meta: "" };

        const existing = await Contact.findOne({ owner, email: new RegExp(`^${escapeRe(sender.email)}$`, "i") }).select("_id");
        if (existing) {
            await Contact.updateOne({ _id: existing._id }, { $push: { activities: activity } });
            continue;
        }
        if (seen.has(sender.email)) {
            await Contact.updateOne({ owner, email: sender.email }, { $push: { activities: activity } });
            continue;
        }
        seen.add(sender.email);

        const [firstName, ...rest] = sender.name.split(" ");
        await Contact.create({
            owner,
            name: sender.name,
            firstName: rest.length ? firstName : "",
            lastName: rest.join(" "),
            email: sender.email,
            source: "email",
            activities: [activity],
        });

        firstStage = firstStage ?? String((await ensureStages(owner))[0]._id);
        const order = await Deal.countDocuments({ owner, stage: firstStage });
        await Deal.create({
            owner,
            stage: firstStage,
            clientName: subject,
            contactName: sender.name,
            order,
            activities: [{ type: "created", text: subject }, { type: "email", text: `Email from ${sender.name} <${sender.email}>` }],
        });
        created += 1;
        await notify(owner, { type: "lead", params: { name: sender.name, subject }, link: "/crm/crm", key: `lead:${sender.email}:${new Date().toISOString().slice(0, 10)}` });
    }
    return created;
}
