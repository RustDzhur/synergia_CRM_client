import { validId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "./money";
import { sendFromAccount } from "@/lib/mail";
import type { DocKind } from "./pdf";

// Отправка финансового документа клиенту. Адресат определяется здесь, а PDF (тот же файл, что и по кнопке
// «Скачать») уходит вложением через подключённый ящик фирмы.

export const ADDRESS = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export type RecipientSource = "manual" | "contact" | "company";
export interface Recipient { email: string; source: RecipientSource }

// Кому уходит документ: адрес, введённый вручную → e-mail контакта → e-mail фирмы клиента.
export async function resolveRecipient(org: string, explicit: unknown, doc: { contact?: unknown; company?: unknown }): Promise<Recipient | null> {
    const typed = typeof explicit === "string" ? explicit.trim() : "";
    if (typed) return ADDRESS.test(typed) ? { email: typed, source: "manual" } : null;

    if (doc.contact && validId(String(doc.contact))) {
        const c = await prisma.contact.findFirst({ where: { id: String(doc.contact), owner: org }, select: { email: true } });
        const email = (c?.email ?? "").trim();
        if (ADDRESS.test(email)) return { email, source: "contact" };
    }
    if (doc.company && validId(String(doc.company))) {
        const c = await prisma.company.findFirst({ where: { id: String(doc.company), owner: org }, select: { email: true } });
        const email = (c?.email ?? "").trim();
        if (ADDRESS.test(email)) return { email, source: "company" };
    }
    return null;
}

// Ящик, из которого уходит письмо: выбранный вручную либо первый подключённый (Web Mails → Accounts).
export async function mailAccount(owner: string, accountId?: unknown) {
    if (typeof accountId === "string" && accountId) {
        if (!validId(accountId)) return null;
        return prisma.integration.findFirst({ where: { id: accountId, owner, type: "mail" } });
    }
    return prisma.integration.findFirst({ where: { owner, type: "mail", status: "connected" }, orderBy: { createdAt: "asc" } });
}

const TITLE: Record<string, Record<DocKind, string>> = {
    en: { invoice: "Invoice", credit_note: "Credit note", quote: "Quotation", order: "Order confirmation", contract: "Contract", delivery_note: "Delivery note", act: "Certificate of services", packing_list: "Packing list" },
    de: { invoice: "Rechnung", credit_note: "Gutschrift", quote: "Angebot", order: "Auftragsbestätigung", contract: "Vertrag", delivery_note: "Lieferschein", act: "Leistungsnachweis", packing_list: "Packliste" },
    ua: { invoice: "Рахунок", credit_note: "Кредит-нота", quote: "Комерційна пропозиція", order: "Підтвердження замовлення", contract: "Договір", delivery_note: "Видаткова накладна", act: "Акт виконаних робіт", packing_list: "Пакувальний лист" },
};

const T = {
    en: { hello: "Dear", attached: "Please find our document attached as a PDF.", total: "Total", due: "Due date", valid: "Valid until", value: "Contract value", question: "If you have any questions, just reply to this email.", regards: "Kind regards" },
    de: { hello: "Guten Tag", attached: "im Anhang finden Sie unser Dokument als PDF.", total: "Gesamt", due: "Fällig am", valid: "Gültig bis", value: "Vertragswert", question: "Bei Fragen antworten Sie einfach auf diese E-Mail.", regards: "Mit freundlichen Grüßen" },
    ua: { hello: "Вітаємо", attached: "у вкладенні — наш документ у форматі PDF.", total: "Разом", due: "Термін оплати", valid: "Дійсний до", value: "Сума договору", question: "Якщо виникнуть питання, просто дайте відповідь на цей лист.", regards: "З повагою" },
};

export interface DocumentMail {
    kind: DocKind;
    number: string;
    customerName: string;
    currency: string;
    amount: number;
    dueDate?: string;
    validUntil?: string;
    locale: string;
    senderName?: string;
    legalName?: string;
    pdf: Buffer;
}

// Тема и текст письма. Подпись — имя отправителя и (если заполнены) реквизиты фирмы из настроек бухгалтерии.
export function documentMail(m: DocumentMail): { subject: string; text: string; filename: string } {
    const locale = m.locale in T ? m.locale : "en";
    const t = T[locale as keyof typeof T];
    const title = TITLE[locale][m.kind];
    const subject = [title, m.number, m.legalName].filter(Boolean).join(" · ");

    const amountLabel = m.kind === "contract" ? t.value : t.total;
    const lines = [
        `${t.hello} ${m.customerName || ""}`.trim() + ",",
        "",
        `${title} ${m.number}: ${t.attached}`,
        "",
        `${amountLabel}: ${formatMoney(Number(m.amount) || 0, m.currency)}`,
    ];
    if (m.kind === "invoice" && m.dueDate) lines.push(`${t.due}: ${m.dueDate}`);
    if (m.kind === "quote" && m.validUntil) lines.push(`${t.valid}: ${m.validUntil}`);
    lines.push("", t.question, "", t.regards + (m.senderName ? `,\n${m.senderName}` : ""));
    if (m.senderName && m.legalName) lines[lines.length - 1] += `\n${m.legalName}`;

    return { subject, text: lines.join("\n"), filename: `${m.number}.pdf` };
}

// Отправляет документ через конкретный ящик и возвращает адрес, с которого письмо ушло.
export async function emailDocument(account: any, to: string, m: DocumentMail): Promise<{ from: string }> {
    const { subject, text, filename } = documentMail(m);
    await sendFromAccount(account, {
        to,
        subject,
        text,
        attachments: [{ filename, contentType: "application/pdf", content: m.pdf }],
    });
    return { from: String(account.config?.email ?? "") };
}
