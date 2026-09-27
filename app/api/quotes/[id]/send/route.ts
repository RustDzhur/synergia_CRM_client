import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { pdfLocale, quotePdfBuffer } from "@/lib/finance/document";
import { emailDocument, mailAccount, resolveRecipient } from "@/lib/finance/send";
import { financeSettings } from "@/lib/finance/settings";
import { computeTotals } from "@/lib/finance/totals";
import Quote from "@/models/Quote";
import User from "@/models/User";
import { toQuoteDTO } from "@/lib/finance/dto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const needsSetup = (message: string, code: string) => NextResponse.json({ message, code }, { status: 400 });

// POST /api/quotes/:id/send — { to?, accountId?, locale? }
// Как у счёта: клиенту уходит PDF предложения вложением, статус «отправлено» ставится только после успешной
// отправки. Адресат — введённый адрес, иначе e-mail контакта, иначе фирмы клиента.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = (await req.json().catch(() => null)) as { to?: unknown; accountId?: unknown; locale?: unknown } | null;
    await connectDB();
    const q = await Quote.findOne({ _id: params.id, org: user.id });
    if (!q) return notFound();
    if (q.status !== "draft") return badRequest("Only a draft quote can be sent");

    const recipient = await resolveRecipient(user.id, b?.to, { contact: q.contact, company: q.company });
    if (!recipient) return needsSetup("The customer has no email address — enter one to send the quote", "no_recipient");
    const account = await mailAccount(user.id, b?.accountId);
    if (!account) return needsSetup("Connect a mailbox in Web Mails to send quotes by email", "no_mailbox");

    try {
        const locale = pdfLocale(b?.locale);
        const [pdf, settings, sender] = await Promise.all([
            quotePdfBuffer(user.id, q, locale),
            financeSettings(user.id),
            User.findById(user.userId).select("firstname lastname"),
        ]);
        await emailDocument(account, recipient.email, {
            kind: "quote",
            number: q.number,
            customerName: q.customerName,
            currency: q.currency,
            amount: computeTotals(q.items ?? []).gross,
            validUntil: q.validUntil,
            locale,
            senderName: sender ? `${sender.firstname} ${sender.lastname}`.trim() : "",
            legalName: settings.legalName ?? "",
            pdf,
        });
    } catch (e) {
        await logAudit({ org: user.id, userId: user.userId, action: "quote.send_failed", entityType: "quote", entityId: String(q._id), summary: `Quote ${q.number} could not be emailed to ${recipient.email}`, meta: { to: recipient.email, reason: e instanceof Error ? e.message : "error" } });
        return failure(e);
    }

    q.status = "sent";
    q.sentAt = new Date();
    q.sentTo = recipient.email;
    await q.save();
    await emit(user.id, { type: "quote_sent", data: { id: String(q._id), number: q.number, customerName: q.customerName, dealId: q.deal ? String(q.deal) : "" } });
    await logAudit({ org: user.id, userId: user.userId, action: "quote.sent", entityType: "quote", entityId: String(q._id), summary: `Quote ${q.number} emailed to ${recipient.email}`, meta: { currency: q.currency, to: recipient.email, source: recipient.source } });
    return NextResponse.json(toQuoteDTO(q));
}
