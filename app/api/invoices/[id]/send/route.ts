import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { invoicePdfBuffer, pdfLocale } from "@/lib/finance/document";
import { emailDocument, mailAccount, resolveRecipient } from "@/lib/finance/send";
import { financeSettings } from "@/lib/finance/settings";
import { computeTotals } from "@/lib/finance/totals";
import Invoice from "@/models/Invoice";
import User from "@/models/User";
import { toInvoiceDTO } from "@/lib/finance/dto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Свой ответ для случаев, когда отправка не состоялась по вине настройки, а не провайдера: интерфейс по code
// понимает, что делать (спросить адрес или предложить подключить ящик), а не показывает общую ошибку.
const needsSetup = (message: string, code: string) => NextResponse.json({ message, code }, { status: 400 });

// POST /api/invoices/:id/send — { to?, accountId?, locale? }
// Отправляет клиенту письмо с PDF счёта вложением и только после успешной отправки переводит счёт в «отправлен»
// (счёт после этого не редактируется). Кому уходить — введённый адрес, иначе e-mail контакта, иначе фирмы клиента;
// ящик — выбранный или первый подключённый в Web Mails. Адрес сохраняем в sentTo, как и в аудите.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = (await req.json().catch(() => null)) as { to?: unknown; accountId?: unknown; locale?: unknown } | null;
    await connectDB();
    const inv = await Invoice.findOne({ _id: params.id, org: user.id });
    if (!inv) return notFound();
    if (inv.status !== "draft") return badRequest("Only a draft invoice can be sent");

    const recipient = await resolveRecipient(user.id, b?.to, { contact: inv.contact, company: inv.company });
    if (!recipient) return needsSetup("The customer has no email address — enter one to send the invoice", "no_recipient");
    const account = await mailAccount(user.id, b?.accountId);
    if (!account) return needsSetup("Connect a mailbox in Web Mails to send invoices by email", "no_mailbox");

    try {
        const locale = pdfLocale(b?.locale);
        const [pdf, settings, sender] = await Promise.all([
            invoicePdfBuffer(user.id, inv, locale),
            financeSettings(user.id),
            User.findById(user.userId).select("firstname lastname"),
        ]);
        await emailDocument(account, recipient.email, {
            kind: "invoice",
            number: inv.number,
            customerName: inv.customerName,
            currency: inv.currency,
            amount: computeTotals(inv.items ?? []).gross,
            dueDate: inv.dueDate,
            locale,
            senderName: sender ? `${sender.firstname} ${sender.lastname}`.trim() : "",
            legalName: settings.legalName ?? "",
            pdf,
        });
    } catch (e) {
        // Письмо не ушло — счёт остаётся черновиком, попытка видна в журнале
        await logAudit({ org: user.id, userId: user.userId, action: "invoice.send_failed", entityType: "invoice", entityId: String(inv._id), summary: `Invoice ${inv.number} could not be emailed to ${recipient.email}`, meta: { to: recipient.email, reason: e instanceof Error ? e.message : "error" } });
        return failure(e);
    }

    inv.status = "sent";
    inv.sentAt = new Date();
    inv.sentTo = recipient.email;
    await inv.save();
    await emit(user.id, { type: "invoice_sent", data: { id: String(inv._id), number: inv.number, customerName: inv.customerName, dealId: inv.deal ? String(inv.deal) : "" } });
    await logAudit({ org: user.id, userId: user.userId, action: "invoice.sent", entityType: "invoice", entityId: String(inv._id), summary: `Invoice ${inv.number} emailed to ${recipient.email}`, meta: { currency: inv.currency, to: recipient.email, source: recipient.source } });
    return NextResponse.json(toInvoiceDTO(inv));
}
