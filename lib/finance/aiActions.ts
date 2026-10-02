import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { invoicePdfBuffer } from "@/lib/finance/document";
import { emailDocument, mailAccount, resolveRecipient } from "@/lib/finance/send";
import { financeSettings } from "@/lib/finance/settings";
import { marketDocumentLocale } from "@/lib/finance/market";
import { assertCompliant } from "@/lib/finance/compliance";
import { applyPayment, statusAfterPayment } from "@/lib/finance/payments";
import { computeTotals } from "@/lib/finance/totals";
import { fiscalAdvice, fiscalConfig, fiscalizeInvoice, findFiscal } from "@/lib/finance/fiscal";
import { requireMarket } from "@/lib/finance/marketGuard";
import { prisma } from "@/lib/prisma";

// Действия бухгалтерии для ассистента Айрис: оплата счёта, отправка клиенту, фискальный чек. Это те же шаги, что
// делают маршруты app/api/invoices/[id]/{pay,send,fiscal}; здесь они — функции от имени пользователя, без HTTP.
// ВАЖНО: правило должно меняться в обоих местах — если правите проверки в маршруте, правьте и здесь.
export class ActionError extends Error {}

interface Who { org: string; userId: string }

// Номер на словах и на экране отличается раскладкой: «РЕ-2026-5» голосом/с клавиатуры — кириллические Р и Е,
// в базе — латинские RE. Сравниваем номера, приведя похожие буквы к латинским.
const LOOKALIKE: Record<string, string> = { А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "R", С: "C", Т: "T", Х: "X", І: "I", У: "Y" };
export const normNumber = (s: string) => String(s ?? "").toUpperCase().replace(/[А-ЯІЇЄҐ]/g, (c) => LOOKALIKE[c] ?? c).replace(/[\s–—]/g, (c) => (c === " " ? "" : "-"));

/** Счёт по номеру («RE-2026-5», «РЕ-2026-5», «2026-5») или по id. */
export async function findInvoice(org: string, ref: string) {
    const r = String(ref ?? "").trim();
    if (!r) throw new ActionError("Invoice number is required");
    if (/^[A-Za-z0-9_-]{20,40}$/.test(r)) { const byId = await prisma.invoice.findFirst({ where: { id: r, org } }); if (byId) return byId; }
    const want = normNumber(r);
    const tail = want.match(/\d+(?:-\d+)*$/)?.[0] ?? want;
    const rows = await prisma.invoice.findMany({ where: { org, number: { contains: tail } }, take: 50 });
    const exact = rows.filter((i) => normNumber(i.number) === want);
    const hit = exact.length ? exact : rows.filter((i) => normNumber(i.number).endsWith(want));
    if (hit.length === 1) return hit[0];
    if (!hit.length) throw new ActionError(`Invoice "${r}" not found`);
    throw new ActionError(`Several invoices match "${r}": ${hit.slice(0, 5).map((i) => i.number).join(", ")}`);
}

export async function markPaid(who: Who, ref: string, amountArg?: number) {
    let inv = await findInvoice(who.org, ref);
    if (!["sent", "overdue"].includes(inv.status)) throw new ActionError("Only a sent (or overdue) invoice can be marked paid");
    const { gross } = computeTotals(inv.items as never);
    const amount = Number.isFinite(Number(amountArg)) && Number(amountArg) > 0 ? Number(amountArg) : gross;
    const { paid, full } = applyPayment(inv, amount);
    inv = await prisma.invoice.update({ where: { id: inv.id }, data: { paidAmount: paid, status: statusAfterPayment(inv.status, full), ...(full ? { paidAt: new Date() } : {}) } });
    if (full) await emit(who.org, { type: "invoice_paid", data: { id: inv.id, number: inv.number, customerName: inv.customerName, amount: String(amount), dealId: inv.deal ?? "" } });
    // ПРРО (Украина): чек при полной оплате пробивается сам, если подключён Checkbox и включена автофискализация
    if (full && !inv.fiscalCode) {
        let fiscalData: Record<string, unknown> = {};
        try {
            const advice = fiscalAdvice(inv);
            const fiscalDoc = advice.needed ? await findFiscal(who.org) : null;
            if (fiscalDoc && fiscalConfig(fiscalDoc).auto) {
                const receipt = await fiscalizeInvoice(who.org, inv, gross, advice.payType);
                fiscalData = { fiscalId: receipt.receiptId, fiscalCode: receipt.fiscalCode, fiscalUrl: receipt.url, fiscalAt: new Date(), fiscalPayType: advice.payType, fiscalError: "" };
            }
        } catch (e) {
            fiscalData = { fiscalError: e instanceof Error ? e.message.slice(0, 300) : "Чек не вдалося пробити" };
        }
        if (Object.keys(fiscalData).length) inv = await prisma.invoice.update({ where: { id: inv.id }, data: fiscalData as never });
    }
    await logAudit({ org: who.org, userId: who.userId, action: full ? "invoice.paid" : "invoice.partially_paid", entityType: "invoice", entityId: inv.id, summary: `Invoice ${inv.number}: ${amount} ${inv.currency} booked — ${paid} of ${gross} paid (via assistant)`, meta: { amount, paid, gross, currency: inv.currency } });
    return { number: inv.number, customerName: inv.customerName, status: inv.status, paid };
}

export async function sendInvoice(who: Who, ref: string, to?: string) {
    const inv = await findInvoice(who.org, ref);
    if (inv.status !== "draft") throw new ActionError("Only a draft invoice can be sent");
    const recipient = await resolveRecipient(who.org, to, { contact: inv.contact, company: inv.company });
    if (!recipient) throw new ActionError("The customer has no email address — give one in the command");
    const account = await mailAccount(who.org, undefined);
    if (!account) throw new ActionError("Connect a mailbox in Web Mails first to send invoices by email");
    try {
        const settings = await financeSettings(who.org);
        const locale = marketDocumentLocale(settings.country) ?? "en";
        const [pdf, sender] = await Promise.all([invoicePdfBuffer(who.org, inv, locale), prisma.user.findUnique({ where: { id: who.userId }, select: { firstname: true, lastname: true } })]);
        const gross = computeTotals((inv.items ?? []) as never).gross;
        assertCompliant({
            kind: inv.kind === "credit_note" ? "credit_note" : "invoice", number: inv.number, issueDate: inv.issueDate, dueDate: inv.dueDate,
            supplyDate: inv.supplyDate, supplyPeriodFrom: inv.supplyPeriodFrom, supplyPeriodTo: inv.supplyPeriodTo, currency: inv.currency,
            party: { name: inv.customerName, address: inv.customerAddress }, items: (inv.items ?? []) as never, totals: { gross },
        }, settings as never);
        await emailDocument(account, recipient.email, {
            kind: "invoice", number: inv.number, customerName: inv.customerName, currency: inv.currency, amount: gross, dueDate: inv.dueDate, locale,
            senderName: sender ? `${sender.firstname} ${sender.lastname}`.trim() : "", legalName: settings.legalName ?? "", pdf,
        });
    } catch (e) {
        await logAudit({ org: who.org, userId: who.userId, action: "invoice.send_failed", entityType: "invoice", entityId: inv.id, summary: `Invoice ${inv.number} could not be emailed to ${recipient.email}`, meta: { to: recipient.email, reason: e instanceof Error ? e.message : "error" } });
        throw new ActionError(e instanceof Error ? e.message.slice(0, 300) : "The invoice could not be sent");
    }
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: "sent", sentAt: new Date(), sentTo: recipient.email } });
    await emit(who.org, { type: "invoice_sent", data: { id: inv.id, number: inv.number, customerName: inv.customerName, dealId: inv.deal ?? "" } });
    await logAudit({ org: who.org, userId: who.userId, action: "invoice.sent", entityType: "invoice", entityId: inv.id, summary: `Invoice ${inv.number} emailed to ${recipient.email} (via assistant)`, meta: { currency: inv.currency, to: recipient.email, source: recipient.source } });
    return { number: inv.number, to: recipient.email };
}

export async function fiscalReceipt(who: Who, ref: string, payType?: "CASH" | "CARD") {
    await requireMarket(who.org, "UA"); // фискальные чеки — украинское ПРРО
    let inv = await findInvoice(who.org, ref);
    if (inv.fiscalCode) throw new ActionError("The receipt for this invoice has already been issued");
    const { gross } = computeTotals(inv.items as never);
    const amount = Number(inv.paidAmount) || gross;
    try {
        const receipt = await fiscalizeInvoice(who.org, inv, amount, payType);
        inv = await prisma.invoice.update({ where: { id: inv.id }, data: { fiscalId: receipt.receiptId, fiscalCode: receipt.fiscalCode, fiscalUrl: receipt.url, fiscalAt: new Date(), fiscalPayType: payType ?? fiscalAdvice(inv).payType, fiscalError: "" } });
        return { number: inv.number, code: inv.fiscalCode };
    } catch (e) {
        const message = e instanceof Error ? e.message.slice(0, 300) : "Чек не вдалося пробити";
        await prisma.invoice.update({ where: { id: inv.id }, data: { fiscalError: message } });
        throw new ActionError(message);
    }
}

export type DocKind = "invoice" | "quote" | "order" | "contract";
const DOC_MODEL = { invoice: "invoice", quote: "quote", order: "order", contract: "contract" } as const;

/** Счёт, предложение, заказ или договор по номеру — для скачивания PDF. */
export async function findDocument(org: string, kind: DocKind, ref: string) {
    if (kind === "invoice") { const i = await findInvoice(org, ref); return { id: i.id, number: i.number }; }
    const want = normNumber(ref);
    if (!want) throw new ActionError("Document number is required");
    const tail = want.match(/\d+(?:-\d+)*$/)?.[0] ?? want;
    const delegate = (prisma as unknown as Record<string, { findMany: (o: unknown) => Promise<{ id: string; number: string }[]> }>)[DOC_MODEL[kind]];
    const rows = await delegate.findMany({ where: { org, number: { contains: tail } }, take: 50 });
    const hit = rows.filter((r) => normNumber(r.number) === want);
    const pick = hit.length ? hit : rows.filter((r) => normNumber(r.number).endsWith(want));
    if (pick.length === 1) return { id: pick[0].id, number: pick[0].number };
    throw new ActionError(pick.length ? `Several documents match "${ref}": ${pick.slice(0, 5).map((r) => r.number).join(", ")}` : `${kind} "${ref}" not found`);
}

/** Товар по id, артикулу или названию (точное совпадение важнее частичного). */
export async function findProduct(org: string, ref: string) {
    const r = String(ref ?? "").trim();
    if (!r) throw new ActionError("Product is required");
    if (/^[A-Za-z0-9_-]{20,40}$/.test(r)) { const byId = await prisma.product.findFirst({ where: { id: r, org } }); if (byId) return byId; }
    const rows = await prisma.product.findMany({ where: { org, archived: false, OR: [{ name: { contains: r, mode: "insensitive" } }, { sku: { equals: r, mode: "insensitive" } }] }, take: 20 });
    const exact = rows.filter((p) => p.name.toLowerCase() === r.toLowerCase() || (p.sku && p.sku.toLowerCase() === r.toLowerCase()));
    const hit = exact.length ? exact : rows;
    if (hit.length === 1) return hit[0];
    throw new ActionError(hit.length ? `Several products match "${r}": ${hit.slice(0, 6).map((p) => p.name).join(", ")}` : `Product "${r}" not found`);
}

/** Поставщик по id или названию. */
export async function findSupplier(org: string, ref: string) {
    const r = String(ref ?? "").trim();
    if (!r) throw new ActionError("Supplier is required");
    if (/^[A-Za-z0-9_-]{20,40}$/.test(r)) { const byId = await prisma.supplier.findFirst({ where: { id: r, org } }); if (byId) return byId; }
    const rows = await prisma.supplier.findMany({ where: { org, archived: false, name: { contains: r, mode: "insensitive" } }, take: 20 });
    const exact = rows.filter((x) => x.name.toLowerCase() === r.toLowerCase());
    const hit = exact.length ? exact : rows;
    if (hit.length === 1) return hit[0];
    throw new ActionError(hit.length ? `Several suppliers match "${r}": ${hit.slice(0, 6).map((x) => x.name).join(", ")}` : `Supplier "${r}" not found — create it first with create_supplier`);
}
