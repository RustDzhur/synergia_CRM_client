import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { invoicePdfBuffer } from "@/lib/finance/document";
import { emailDocument, mailAccount, resolveRecipient } from "@/lib/finance/send";
import { financeSettings } from "@/lib/finance/settings";
import { marketDocumentLocale } from "@/lib/finance/market";
import { assertCompliant } from "@/lib/finance/compliance";
import { registerPayment } from "@/lib/sync/payments";
import { logDocEvent } from "@/lib/sync/documents";
import { computeTotals } from "@/lib/finance/totals";
import { fiscalAdvice, fiscalizeInvoice } from "@/lib/finance/fiscal";
import { requireMarket } from "@/lib/finance/marketGuard";
import { nextNumber } from "@/lib/finance/numbering";
import { applyTaxPolicy, taxExempt } from "@/lib/finance/tax";
import { ORDER_STATUSES, OrderStatusError, setOrderStatus as changeOrderStatus } from "@/lib/finance/orderStatus";
import { ensureSupplyDate } from "@/lib/finance/issue";
import { prisma } from "@/lib/prisma";
import { fx } from "@/lib/sync/texts";

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

export async function markPaid(who: Who, ref: string, amountArg?: number, paidDate?: string) {
    let inv = await findInvoice(who.org, ref);
    if (!["draft", "sent", "overdue"].includes(inv.status)) throw new ActionError("Only an open invoice (draft, sent or overdue) can be marked paid");
    if (inv.status === "draft") inv = await ensureSupplyDate(inv);
    const amount = Number.isFinite(Number(amountArg)) && Number(amountArg) > 0 ? Number(amountArg) : undefined;
    // Та же точка учёта оплаты, что у кнопки «оплачен», webhook эквайринга и банка (lib/sync/payments.ts):
    // раньше здесь жила своя копия, и правила расходились
    const res = await registerPayment(who.org, inv.id, {
        amount, source: "assistant", externalId: `${inv.id}:${inv.paidAmount}:${amount ?? "full"}`, actor: { userId: who.userId },
        paidAt: paidDate && /^\d{4}-\d{2}-\d{2}$/.test(paidDate) ? new Date(`${paidDate}T12:00:00.000Z`) : undefined, via: "assistant",
    });
    if (!res.ok) throw new ActionError("Only an open invoice (draft, sent or overdue) can be marked paid");
    return { number: res.invoice.number, customerName: res.invoice.customerName, status: res.invoice.status, paid: res.paid };
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
    await logDocEvent(who.org, inv, "invoice", fx("invoice_sent", { number: inv.number, email: recipient.email }), "sent");
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

export type DocKind = "invoice" | "quote" | "order" | "contract" | "purchase_order";
const DOC_MODEL = { invoice: "invoice", quote: "quote", order: "order", contract: "contract", purchase_order: "purchaseOrder" } as const;

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

// ── Заказы, предложения, договоры: смена состояния (те же шаги, что кнопки «Підтвердити», «Виставити рахунок» и др.) ──
const authorOf = async (userId: string) => { const u = await prisma.user.findUnique({ where: { id: userId }, select: { firstname: true, lastname: true } }); return u ? `${u.firstname} ${u.lastname}`.trim() : ""; };

export { ORDER_STATUSES };

export async function setOrderStatus(who: Who, ref: string, status: string) {
    const doc = await findDocument(who.org, "order", ref);
    try {
        // Та же функция, что у PATCH /api/orders/:id: таблица переходов и склад в одной транзакции
        const { order } = await changeOrderStatus(who.org, doc.id, status, { userId: who.userId });
        return { number: order.number, status: order.status };
    } catch (e) {
        if (e instanceof OrderStatusError) throw new ActionError(e.message);
        throw e;
    }
}

export async function invoiceFromOrder(who: Who, ref: string) {
    const doc = await findDocument(who.org, "order", ref);
    const order = await prisma.order.findFirst({ where: { id: doc.id, org: who.org } });
    if (!order) throw new ActionError("Order not found");
    if (order.invoice) throw new ActionError("This order already has an invoice");
    if (!((order.items as any[]) ?? []).length) throw new ActionError("The order has no line items to invoice");
    const settings = await financeSettings(who.org);
    const number = await nextNumber(who.org, settings.invoicePrefix || "RE");
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + (settings.paymentTermsDays ?? 14) * 86400000).toISOString().slice(0, 10);
    const invoice = await prisma.invoice.create({
        data: {
            org: who.org, number, kind: "invoice", contact: order.contact, company: order.company, customerName: order.customerName, deal: order.deal, order: order.id, contract: order.contract,
            items: applyTaxPolicy((order.items as any[]) ?? [], settings) as any, currency: order.currency, smallBusinessNote: taxExempt(settings), issueDate: today, dueDate: due, template: order.template, createdByName: await authorOf(who.userId),
        },
    });
    await prisma.order.update({ where: { id: order.id }, data: { invoice: invoice.id, status: "invoiced" } });
    await logDocEvent(who.org, invoice, "invoice", fx("invoice_from_order", { number: invoice.number, order: order.number }), "created");
    await emit(who.org, { type: "order_status", data: { id: order.id, number: order.number, status: "invoiced", customerName: order.customerName } });
    return { number: invoice.number, order: order.number, customerName: invoice.customerName };
}

export async function decideQuote(who: Who, ref: string, accepted: boolean) {
    const doc = await findDocument(who.org, "quote", ref);
    const q = await prisma.quote.findFirst({ where: { id: doc.id, org: who.org } });
    if (!q) throw new ActionError("Quote not found");
    if (q.status !== "sent") throw new ActionError("Only a sent quote can be accepted or declined");
    await prisma.quote.update({ where: { id: q.id }, data: { status: accepted ? "accepted" : "declined" } });
    await logDocEvent(who.org, q, "quote", fx(accepted ? "quote_accepted" : "quote_declined", { number: q.number }), accepted ? "accepted" : "declined");
    if (accepted) await emit(who.org, { type: "quote_accepted", data: { id: q.id, number: q.number, customerName: q.customerName, dealId: q.deal ?? "" } });
    return { number: q.number, result: accepted ? "accepted" : "declined" };
}

export async function quoteToOrder(who: Who, ref: string) {
    const doc = await findDocument(who.org, "quote", ref);
    const quote = await prisma.quote.findFirst({ where: { id: doc.id, org: who.org } });
    if (!quote) throw new ActionError("Quote not found");
    if (quote.status !== "accepted") throw new ActionError("Only an accepted quote can become an order — accept it first");
    if (quote.order) throw new ActionError("This quote already has an order");
    const number = await nextNumber(who.org, "SO");
    const order = await prisma.order.create({ data: { org: who.org, number, contact: quote.contact, company: quote.company, customerName: quote.customerName, deal: quote.deal, items: (quote.items ?? undefined) as any, currency: quote.currency, template: quote.template, createdByName: await authorOf(who.userId) } });
    await prisma.quote.update({ where: { id: quote.id }, data: { order: order.id } });
    const total = ((order.items as any[]) ?? []).reduce((s, it) => s + it.qty * it.unitPrice, 0);
    await logDocEvent(who.org, order, "order", fx("order_from_quote", { number: order.number, quote: quote.number }), "created");
    await emit(who.org, { type: "order_created", data: { id: order.id, number: order.number, customerName: order.customerName, total: String(total), currency: order.currency } });
    return { number: order.number, quote: quote.number };
}

export async function contractAction(who: Who, ref: string, action: "sign" | "complete" | "cancel") {
    const doc = await findDocument(who.org, "contract", ref);
    const c = await prisma.contract.findFirst({ where: { id: doc.id, org: who.org } });
    if (!c) throw new ActionError("Contract not found");
    if (action === "sign") {
        if (c.status !== "draft") throw new ActionError("Only a draft contract can be signed");
        const u = await prisma.contract.update({ where: { id: c.id }, data: { status: "active", signedAt: new Date() } });
        await logDocEvent(who.org, u, "contract", fx("contract_signed", { number: u.number, value: u.value, currency: u.currency }), "signed");
        await emit(who.org, { type: "contract_signed", data: { id: u.id, number: u.number, customerName: u.customerName, value: String(u.value), currency: u.currency, dealId: u.deal ?? "" } });
        await logAudit({ org: who.org, userId: who.userId, action: "contract.signed", entityType: "contract", entityId: u.id, summary: `Contract ${u.number} signed by ${u.customerName} — ${u.value} ${u.currency} (via assistant)`, meta: {} });
    } else if (action === "complete") {
        if (c.status !== "active") throw new ActionError("Only an active contract can be completed");
        await prisma.contract.update({ where: { id: c.id }, data: { status: "completed" } });
        await logAudit({ org: who.org, userId: who.userId, action: "contract.completed", entityType: "contract", entityId: c.id, summary: `Contract ${c.number} marked completed (via assistant)` });
    } else {
        if (c.status !== "draft" && c.status !== "active") throw new ActionError("This contract cannot be cancelled");
        await prisma.contract.update({ where: { id: c.id }, data: { status: "cancelled" } });
        await logAudit({ org: who.org, userId: who.userId, action: "contract.cancelled", entityType: "contract", entityId: c.id, summary: `Contract ${c.number} cancelled (via assistant)` });
    }
    return { number: c.number, action };
}
