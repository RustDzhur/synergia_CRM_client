import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { LOCALES, pdfLocale, quotePdfBuffer } from "@/lib/finance/document";
import { emailDocument, mailAccount, resolveRecipient } from "@/lib/finance/send";
import { financeSettings } from "@/lib/finance/settings";
import { marketDocumentLocale } from "@/lib/finance/market";
import { assertCompliant } from "@/lib/finance/compliance";
import { computeTotals } from "@/lib/finance/totals";
import { toQuoteDTO } from "@/lib/finance/dto";
import { prisma } from "@/lib/prisma";
import { logDocEvent } from "@/lib/sync/documents";

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
    const q = await prisma.quote.findFirst({ where: { id: params.id, org: user.id } });
    if (!q) return notFound();
    if (q.status !== "draft") return badRequest("Only a draft quote can be sent");

    const recipient = await resolveRecipient(user.id, b?.to, { contact: q.contact, company: q.company });
    if (!recipient) return needsSetup("The customer has no email address — enter one to send the quote", "no_recipient");
    const account = await mailAccount(user.id, b?.accountId);
    if (!account) return needsSetup("Connect a mailbox in Web Mails to send quotes by email", "no_mailbox");

    try {
        // Язык документа: явно заданный (если валиден) → язык страны фирмы → английский. Раньше язык
        // не передавался и письмо с PDF всегда уходили на английском, хотя документ украинской фирмы
        // должен быть украинским (язык кабинета может быть любым)
        const settingsFirst = await financeSettings(user.id);
        const locale = (LOCALES as readonly string[]).includes(String(b?.locale)) ? pdfLocale(b?.locale) : marketDocumentLocale(settingsFirst.country) ?? "en";
        const [pdf, sender] = await Promise.all([
            quotePdfBuffer(user.id, q, locale),
            prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } }),
        ]);
        const settings = settingsFirst;
        // Выпуск клиенту — момент проверки обязательных реквизитов (ТЗ §14)
        const gross = computeTotals((q.items ?? []) as never).gross;
        assertCompliant(
            { kind: "quote", number: q.number, issueDate: q.issueDate, currency: q.currency, party: { name: q.customerName }, items: (q.items ?? []) as never, totals: { gross } },
            settings as never
        );
        await emailDocument(account, recipient.email, {
            kind: "quote",
            number: q.number,
            customerName: q.customerName,
            currency: q.currency,
            amount: computeTotals((q.items ?? []) as never).gross,
            validUntil: q.validUntil,
            locale,
            senderName: sender ? `${sender.firstname} ${sender.lastname}`.trim() : "",
            legalName: settings.legalName ?? "",
            pdf,
        });
    } catch (e) {
        await logAudit({ org: user.id, userId: user.userId, action: "quote.send_failed", entityType: "quote", entityId: q.id, summary: `Quote ${q.number} could not be emailed to ${recipient.email}`, meta: { to: recipient.email, reason: e instanceof Error ? e.message : "error" } });
        return failure(e);
    }

    const saved = await prisma.quote.update({ where: { id: q.id }, data: { status: "sent", sentAt: new Date(), sentTo: recipient.email } });
    await emit(user.id, { type: "quote_sent", data: { id: q.id, number: q.number, customerName: q.customerName, dealId: q.deal ?? "" } });
    await logDocEvent(user.id, q, "quote", `Предложение ${q.number} отправлено клиенту (${recipient.email})`, "sent");
    await logAudit({ org: user.id, userId: user.userId, action: "quote.sent", entityType: "quote", entityId: q.id, summary: `Quote ${q.number} emailed to ${recipient.email}`, meta: { currency: q.currency, to: recipient.email, source: recipient.source } });
    return NextResponse.json(toQuoteDTO(saved));
}
