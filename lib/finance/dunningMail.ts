import { invoicePdfBuffer, pdfLocale } from "./document";
import { mailAccount, resolveRecipient } from "./send";
import { financeSettings } from "./settings";
import { computeTotals } from "./totals";
import { formatMoney } from "./money";
import { sendFromAccount } from "@/lib/mail";
import Invoice from "@/models/Invoice";
import SectionRecord from "@/models/SectionRecord";

// Что случилось с письмом клиенту при напоминании об оплате
export type DunningMail = "sent" | "by_rule" | "no_recipient" | "no_mailbox" | "failed";

const T = {
    en: {
        titles: ["", "Payment reminder", "Second payment reminder", "Final payment reminder", "Last reminder before legal steps"],
        hello: "Dear", body: (n: string, due: string) => `according to our records, invoice ${n} (due ${due}) is still unpaid. Please find it attached and settle it by the new payment date.`,
        total: "Amount due", fee: "Reminder fee", newDue: "New payment date", ignore: "If you have already paid, please disregard this email.", regards: "Kind regards",
    },
    de: {
        titles: ["", "Zahlungserinnerung", "2. Zahlungserinnerung", "Letzte Zahlungserinnerung", "Letzte Mahnung vor rechtlichen Schritten"],
        hello: "Guten Tag", body: (n: string, due: string) => `nach unseren Unterlagen ist die Rechnung ${n} (fällig am ${due}) noch offen. Sie finden sie im Anhang; bitte begleichen Sie sie bis zum neuen Zahlungsziel.`,
        total: "Offener Betrag", fee: "Mahngebühr", newDue: "Neues Zahlungsziel", ignore: "Falls Sie bereits gezahlt haben, betrachten Sie diese E-Mail bitte als gegenstandslos.", regards: "Mit freundlichen Grüßen",
    },
    ua: {
        titles: ["", "Нагадування про оплату", "Друге нагадування про оплату", "Останнє нагадування про оплату", "Остання вимога перед юридичними кроками"],
        hello: "Вітаємо", body: (n: string, due: string) => `за нашими даними рахунок ${n} (строк оплати ${due}) досі не сплачено. Він у вкладенні; будь ласка, сплатіть його до нового строку.`,
        total: "До сплати", fee: "Плата за нагадування", newDue: "Новий строк оплати", ignore: "Якщо ви вже сплатили, просто проігноруйте цей лист.", regards: "З повагою",
    },
};

// Есть ли у фирмы своё правило «письмо клиенту» на событие напоминания: тогда письмо шлёт оно, а не мы (иначе клиент получит два)
async function hasEmailRule(org: string): Promise<boolean> {
    const rows = await SectionRecord.find({ org, key: "automation:rules", rid: { $ne: "__init__" } }).select("values");
    return rows.some((r) => r.values?.event === "invoice_reminder" && r.values?.action === "send_email" && r.values?.enabled !== "0");
}

// Письмо-напоминание клиенту из ящика фирмы, PDF счёта (с уже поднятой ступенью и сбором) во вложении.
// Не бросает исключений: напоминание записано в любом случае, результат письма показывает интерфейс.
export async function emailDunning(org: string, invoiceId: string, level: number, dueDate: string, locale?: string): Promise<{ status: DunningMail; to?: string }> {
    try {
        if (await hasEmailRule(org)) return { status: "by_rule" };
        const inv = await Invoice.findOne({ _id: invoiceId, org });
        if (!inv) return { status: "failed" };
        const recipient = await resolveRecipient(org, undefined, { contact: inv.contact, company: inv.company });
        if (!recipient) return { status: "no_recipient" };
        const account = await mailAccount(org);
        if (!account) return { status: "no_mailbox", to: recipient.email };

        const lang = pdfLocale(locale ?? "de");
        const t = T[lang as keyof typeof T];
        const settings = await financeSettings(org);
        const pdf = await invoicePdfBuffer(org, inv, lang);
        const total = computeTotals(inv.items ?? []).gross + (Number(inv.dunningFee) || 0);
        const lines = [
            `${t.hello} ${inv.customerName || ""}`.trim() + ",", "",
            t.body(inv.number, inv.dueDate || "—"), "",
            `${t.total}: ${formatMoney(total, inv.currency)}`,
        ];
        if (Number(inv.dunningFee) > 0) lines.push(`${t.fee}: ${formatMoney(Number(inv.dunningFee), inv.currency)}`);
        lines.push(`${t.newDue}: ${dueDate}`, "", t.ignore, "", t.regards + (settings.legalName ? `,\n${settings.legalName}` : ""));
        await sendFromAccount(account, {
            to: recipient.email,
            subject: [t.titles[Math.min(4, Math.max(1, level))], inv.number, settings.legalName].filter(Boolean).join(" · "),
            text: lines.join("\n"),
            attachments: [{ filename: `${inv.number}.pdf`, contentType: "application/pdf", content: pdf }],
        });
        return { status: "sent", to: recipient.email };
    } catch {
        return { status: "failed" };
    }
}
