import { isValidObjectId } from "mongoose";
import { sendFromAccount } from "@/lib/mail";
import Contact from "@/models/Contact";
import Company from "@/models/Company";
import Integration from "@/models/Integration";
import type { DocKind } from "./pdf";

// Отправка финансового документа клиенту. До этого «Отправить» только менял статус на «отправлен»:
// письмо никто не слал, и было непонятно, куда документ уходит. Теперь адресат определяется здесь,
// а PDF (тот же файл, что и по кнопке «Скачать») уходит вложением через подключённый ящик фирмы.

export const ADDRESS = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export type RecipientSource = "manual" | "contact" | "company";
export interface Recipient { email: string; source: RecipientSource }

// Кому уходит документ: адрес, введённый вручную → e-mail контакта → e-mail фирмы клиента.
// null означает «адреса нет» — интерфейс в этом случае просит ввести его и повторить отправку.
export async function resolveRecipient(org: string, explicit: unknown, doc: { contact?: unknown; company?: unknown }): Promise<Recipient | null> {
    const typed = typeof explicit === "string" ? explicit.trim() : "";
    if (typed) return ADDRESS.test(typed) ? { email: typed, source: "manual" } : null;

    if (doc.contact && isValidObjectId(String(doc.contact))) {
        const c = await Contact.findOne({ _id: doc.contact, owner: org }).select("email");
        const email = (c?.email ?? "").trim();
        if (ADDRESS.test(email)) return { email, source: "contact" };
    }
    if (doc.company && isValidObjectId(String(doc.company))) {
        const c = await Company.findOne({ _id: doc.company, owner: org }).select("email");
        const email = (c?.email ?? "").trim();
        if (ADDRESS.test(email)) return { email, source: "company" };
    }
    return null;
}

// Ящик, из которого уходит письмо: выбранный вручную либо первый подключённый (Web Mails → Accounts).
// Владелец ящика — user.id, ровно как в /api/mail/*, поэтому список тот же, что видит пользователь.
export async function mailAccount(owner: string, accountId?: unknown) {
    if (typeof accountId === "string" && accountId) {
        if (!isValidObjectId(accountId)) return null;
        return Integration.findOne({ _id: accountId, owner, type: "mail" });
    }
    return Integration.findOne({ owner, type: "mail", status: "connected" }).sort({ createdAt: 1 });
}

const TITLE: Record<string, Record<DocKind, string>> = {
    en: { invoice: "Invoice", credit_note: "Credit note", quote: "Quotation", order: "Order confirmation", contract: "Contract", delivery_note: "Delivery note" },
    de: { invoice: "Rechnung", credit_note: "Gutschrift", quote: "Angebot", order: "Auftragsbestätigung", contract: "Vertrag", delivery_note: "Lieferschein" },
    ua: { invoice: "Рахунок", credit_note: "Кредит-нота", quote: "Комерційна пропозиція", order: "Підтвердження замовлення", contract: "Договір", delivery_note: "Видаткова накладна" },
};

// Текст письма на трёх языках интерфейса — как и подписи в PDF, держим рядом с отправкой, без messages/*.json
const T = {
    en: { hello: "Dear", attached: "Please find our document attached as a PDF.", total: "Total", due: "Due date", valid: "Valid until", value: "Contract value", question: "If you have any questions, just reply to this email.", regards: "Kind regards" },
    de: { hello: "Guten Tag", attached: "im Anhang finden Sie unser Dokument als PDF.", total: "Gesamt", due: "Fällig am", valid: "Gültig bis", value: "Vertragswert", question: "Bei Fragen antworten Sie einfach auf diese E-Mail.", regards: "Mit freundlichen Grüßen" },
    ua: { hello: "Вітаємо", attached: "у вкладенні — наш документ у форматі PDF.", total: "Разом", due: "Термін оплати", valid: "Дійсний до", value: "Сума договору", question: "Якщо виникнуть питання, просто дайте відповідь на цей лист.", regards: "З повагою" },
};

const money = (n: number, currency: string) => {
    try { return new Intl.NumberFormat("de-DE", { style: "currency", currency, maximumFractionDigits: 2 }).format(n); }
    catch { return `${n.toFixed(2)} ${currency}`; }
};

export interface DocumentMail {
    kind: DocKind;
    number: string;
    customerName: string;
    currency: string;
    amount: number; // брутто по позициям или сумма договора — печатается в письме
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

    // У договора вместо итога по позициям печатается сумма договора, у счёта и предложения — итог
    const amountLabel = m.kind === "contract" ? t.value : t.total;
    const lines = [
        `${t.hello} ${m.customerName || ""}`.trim() + ",",
        "",
        `${title} ${m.number}: ${t.attached}`,
        "",
        `${amountLabel}: ${money(Number(m.amount) || 0, m.currency)}`,
    ];
    if (m.kind === "invoice" && m.dueDate) lines.push(`${t.due}: ${m.dueDate}`);
    if (m.kind === "quote" && m.validUntil) lines.push(`${t.valid}: ${m.validUntil}`);
    lines.push("", t.question, "", t.regards + (m.senderName ? `,\n${m.senderName}` : ""));
    if (m.senderName && m.legalName) lines[lines.length - 1] += `\n${m.legalName}`;

    return { subject, text: lines.join("\n"), filename: `${m.number}.pdf` };
}

// Отправляет документ через конкретный ящик и возвращает адрес, с которого письмо ушло.
// Сбой провайдера приходит сюда как ProviderError и превращается в 502 в маршруте — статус документа
// в этом случае не меняется, попытку видно в аудите.
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
