import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { LOCALES, invoicePdfBuffer, pdfLocale } from "@/lib/finance/document";
import { emailDocument, mailAccount, resolveRecipient } from "@/lib/finance/send";
import { financeSettings } from "@/lib/finance/settings";
import { marketDocumentLocale } from "@/lib/finance/market";
import { assertCompliant } from "@/lib/finance/compliance";
import { computeTotals } from "@/lib/finance/totals";
import { toInvoiceDTO } from "@/lib/finance/dto";
import { ensureSupplyDate } from "@/lib/finance/issue";
import { prisma } from "@/lib/prisma";
import { logDocEvent } from "@/lib/sync/documents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Свой ответ для случаев, когда отправка не состоялась по вине настройки, а не провайдера: интерфейс по code
// понимает, что делать (спросить адрес или предложить подключить ящик), а не показывает общую ошибку.
const needsSetup = (message: string, code: string) => NextResponse.json({ message, code }, { status: 400 });

// POST /api/invoices/:id/send — { to?, accountId?, locale? }. Только ОТПРАВКА клиенту: оплата счёта — отдельное действие (/pay: «Гроші надійшли»)
// Отправляет клиенту письмо с PDF счёта вложением и только после успешной отправки переводит счёт в «отправлен»
// (счёт после этого не редактируется). Кому уходить — введённый адрес, иначе e-mail контакта, иначе фирмы клиента;
// ящик — выбранный или первый подключённый в Web Mails. Адрес сохраняем в sentTo, как и в аудите.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = (await req.json().catch(() => null)) as { to?: unknown; accountId?: unknown; locale?: unknown; skipEmail?: unknown } | null;
    let inv = await prisma.invoice.findFirst({ where: { id: params.id, org: user.id } });
    if (!inv) return notFound();
    if (inv.status !== "draft") return badRequest("Only a draft invoice can be sent");
    inv = await ensureSupplyDate(inv); // счёт без даты оказания услуги получает её автоматически (= дата счёта)


    const recipient = await resolveRecipient(user.id, b?.to, { contact: inv.contact, company: inv.company });
    if (!recipient) return needsSetup("The customer has no email address — enter one to send the invoice", "no_recipient");
    const account = await mailAccount(user.id, b?.accountId);
    if (!account) return needsSetup("Connect a mailbox in Web Mails to send invoices by email", "no_mailbox");

    try {
        // Язык документа: явно заданный (если валиден) → язык страны фирмы → английский — как у КП:
        // раньше письмо всегда уходило на английском
        const settingsFirst = await financeSettings(user.id);
        const locale = (LOCALES as readonly string[]).includes(String(b?.locale)) ? pdfLocale(b?.locale) : marketDocumentLocale(settingsFirst.country) ?? "en";
        const [pdf, sender] = await Promise.all([
            invoicePdfBuffer(user.id, inv, locale),
            prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } }),
        ]);
        const settings = settingsFirst;
        // Выпуск клиенту — момент, когда проверяются обязательные реквизиты (ТЗ §14): черновик можно
        // сохранять и печатать, но отправить неполный документ нельзя. Ошибка уходит 400 со списком кодов.
        const gross = computeTotals((inv.items ?? []) as never).gross;
        assertCompliant(
            {
                kind: inv.kind === "credit_note" ? "credit_note" : "invoice",
                number: inv.number,
                issueDate: inv.issueDate,
                dueDate: inv.dueDate,
                supplyDate: inv.supplyDate,
                supplyPeriodFrom: inv.supplyPeriodFrom,
                supplyPeriodTo: inv.supplyPeriodTo,
                currency: inv.currency,
                party: { name: inv.customerName, address: inv.customerAddress },
                items: (inv.items ?? []) as never,
                totals: { gross },
            },
            settings as never
        );
        await emailDocument(account, recipient.email, {
            kind: "invoice",
            number: inv.number,
            customerName: inv.customerName,
            currency: inv.currency,
            amount: computeTotals((inv.items ?? []) as never).gross,
            dueDate: inv.dueDate,
            locale,
            senderName: sender ? `${sender.firstname} ${sender.lastname}`.trim() : "",
            legalName: settings.legalName ?? "",
            pdf,
        });
    } catch (e) {
        // Письмо не ушло — счёт остаётся черновиком, попытка видна в журнале
        await logAudit({ org: user.id, userId: user.userId, action: "invoice.send_failed", entityType: "invoice", entityId: inv.id, summary: `Invoice ${inv.number} could not be emailed to ${recipient.email}`, meta: { to: recipient.email, reason: e instanceof Error ? e.message : "error" } });
        return failure(e);
    }

    const saved = await prisma.invoice.update({ where: { id: inv.id }, data: { status: "sent", sentAt: new Date(), sentTo: recipient.email } });
    await emit(user.id, { type: "invoice_sent", data: { id: inv.id, number: inv.number, customerName: inv.customerName, dealId: inv.deal ?? "" } });
    await logDocEvent(user.id, inv, "invoice", `Счёт ${inv.number} отправлен клиенту (${recipient.email})`, "sent");
    await logAudit({ org: user.id, userId: user.userId, action: "invoice.sent", entityType: "invoice", entityId: inv.id, summary: `Invoice ${inv.number} emailed to ${recipient.email}`, meta: { currency: inv.currency, to: recipient.email, source: recipient.source } });
    return NextResponse.json(toInvoiceDTO(saved));
}
