import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { applyPayment, statusAfterPayment } from "@/lib/finance/payments";
import { computeTotals } from "@/lib/finance/totals";
import { fiscalAdvice, fiscalConfig, fiscalizeInvoice, findFiscal } from "@/lib/finance/fiscal";
import { logActivity } from "@/lib/sync/feed";
import { recordSyncError } from "@/lib/sync/errors";

// Единственная точка, где деньги зачитываются в счёт. Раньше оплата считалась в четырёх местах (кнопка «оплачен»,
// webhook эквайринга, ассистент Айрис, сверка с банком), и результат у них был разным: банковская оплата не
// запускала автоматизацию, платёж картой не пробивал фискальный чек, ни один путь не писал в ленту клиента.
// Теперь все четыре вызывают registerPayment / revertPayment, и набор следствий один.

export type PaymentSource = "manual" | "assistant" | "webhook" | "bank";

// В каком статусе счёт принимает деньги. Банк черновики не закрывает (привязка остаётся пометкой), остальные — могут:
// деньги бывают получены по счёту, который клиенту отдали другим путём.
const OPEN: Record<PaymentSource, string[]> = {
    manual: ["draft", "sent", "overdue"],
    assistant: ["draft", "sent", "overdue"],
    webhook: ["draft", "sent", "overdue"],
    bank: ["sent", "overdue"],
};

export interface PaymentInput {
    amount?: number; // без суммы — вся сумма счёта
    source: PaymentSource;
    externalId: string; // ключ идемпотентности: id платежа у провайдера, id банковской строки, ключ запроса
    paidAt?: Date;
    via?: string; // monobank, liqpay, …
    actor?: { userId?: string; name?: string };
    note?: string;
}

export type PaymentOutcome =
    | { ok: true; duplicate: false; invoice: any; paid: number; gross: number; full: boolean; applied: number }
    | { ok: true; duplicate: true; invoice: any; paid: number; gross: number; full: boolean; applied: 0 }
    | { ok: false; reason: "not_found" | "closed"; invoice?: any };

const lockInvoice = (tx: Prisma.TransactionClient, id: string) => tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${id} FOR UPDATE`;

export async function registerPayment(org: string, invoiceId: string, input: PaymentInput): Promise<PaymentOutcome> {
    const first = await prisma.invoice.findFirst({ where: { id: invoiceId, org } });
    if (!first) return { ok: false, reason: "not_found" };

    const result = await prisma.$transaction(async (tx) => {
        // блокировка строки счёта: два платежа одновременно не прочитают одну и ту же сумму «уже оплачено»
        await lockInvoice(tx, first.id);
        const inv = await tx.invoice.findUniqueOrThrow({ where: { id: first.id } });
        const existing = await tx.paymentEvent.findUnique({ where: { org_source_externalId: { org, source: input.source, externalId: input.externalId } } });
        const { gross } = computeTotals(inv.items as never);
        if (existing) return { duplicate: true as const, inv, gross };
        if (!OPEN[input.source].includes(inv.status)) return { closed: true as const, inv };

        const amount = input.amount === undefined ? gross : Math.max(0, Number(input.amount) || 0);
        const { paid, full } = applyPayment(inv, amount);
        // applied — сколько фактически прибавилось к paidAmount (переплата тоже видна: paidAmount может превысить сумму счёта)
        const applied = Math.round((paid - (Number(inv.paidAmount) || 0)) * 100) / 100;
        await tx.paymentEvent.create({ data: { org, invoice: inv.id, source: input.source, externalId: input.externalId, amount: applied, currency: inv.currency, via: input.via ?? "" } });
        const updated = await tx.invoice.update({
            where: { id: inv.id },
            data: {
                paidAmount: paid,
                status: statusAfterPayment(inv.status, full),
                ...(full ? { paidAt: input.paidAt ?? new Date() } : {}),
                ...(input.via ? { paidVia: input.via } : {}),
            },
        });
        return { inv: updated, gross, paid, full, applied, previous: inv };
    }).catch((e) => {
        // два одинаковых платежа пришли одновременно: второй упёрся в уникальный ключ — это повтор, а не ошибка
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { duplicate: true as const, inv: first, gross: computeTotals(first.items as never).gross };
        throw e;
    });

    if ("closed" in result) return { ok: false, reason: "closed", invoice: result.inv };
    if ("duplicate" in result) {
        const { paid, full } = applyPayment({ items: result.inv.items, paidAmount: 0 }, Number(result.inv.paidAmount) || 0);
        return { ok: true, duplicate: true, invoice: result.inv, paid, gross: result.gross, full, applied: 0 };
    }

    const { inv, gross, paid, full, applied } = result;
    await afterPayment(org, inv, { gross, paid, full, applied, input });
    return { ok: true, duplicate: false, invoice: await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } }), paid, gross, full, applied };
}

// Побочные эффекты — после фиксации платежа и каждый отдельно: сбой одного не отменяет деньги и не мешает остальным.
async function afterPayment(org: string, inv: any, ctx: { gross: number; paid: number; full: boolean; applied: number; input: PaymentInput }) {
    const { gross, paid, full, applied, input } = ctx;
    const step = async (name: string, fn: () => Promise<unknown>) => {
        try { await fn(); } catch (e) { await recordSyncError(org, name, e, { id: inv.id }); }
    };
    const money = `${applied} ${inv.currency}`;
    const who = input.actor?.name ? ` (${input.actor.name})` : "";

    await step("payment.audit", () =>
        logAudit({
            org, userId: input.actor?.userId, userName: input.actor?.name,
            action: full ? "invoice.paid" : "invoice.partially_paid", entityType: "invoice", entityId: inv.id,
            summary: `Invoice ${inv.number}: ${money} booked via ${input.via || input.source} — ${paid} of ${gross} paid`,
            meta: { amount: applied, paid, gross, currency: inv.currency, source: input.source, via: input.via ?? "" },
        }));

    // След в карточках клиента: сделка, контакт и фирма видят оплату без захода в «Финансы»
    await step("payment.feed", () =>
        logActivity(org, { deal: inv.deal, contact: inv.contact, company: inv.company }, {
            type: "payment",
            text: full ? `Счёт ${inv.number} оплачен полностью: ${paid} ${inv.currency}${who}` : `Счёт ${inv.number}: получено ${money}, оплачено ${paid} из ${gross}${who}`,
            meta: `invoice:${inv.id}`,
            key: `pay:${inv.id}:${input.source}:${input.externalId}`,
        }));

    await step("payment.automation", () =>
        emit(org, {
            type: full ? "invoice_paid" : "invoice_partial_paid",
            data: { id: inv.id, number: inv.number, customerName: inv.customerName, amount: String(full ? paid : applied), dealId: inv.deal ?? "", contactId: inv.contact ?? "" },
        }));

    await step("payment.notify", () =>
        notify(org, {
            type: "message",
            params: { name: inv.customerName || inv.number, channel: input.via || input.source, text: full ? `Счёт ${inv.number} оплачен ${paid} ${inv.currency}` : `Счёт ${inv.number}: получено ${money}` },
            link: "/crm/finance?tab=invoices",
            key: `pay:${inv.id}:${input.source}:${input.externalId}`,
        }));

    if (!full) return;
    await step("payment.order", () => markOrderPaid(org, inv));
    await step("payment.deal", () => winDealIfSettled(org, inv));
    await step("payment.fiscal", () => autoFiscalize(org, inv, gross));
}

// Заказ, по которому выставлен этот счёт, становится «оплачен» (только из «выставлен счёт»: закрытый и отменённый не трогаем)
async function markOrderPaid(org: string, inv: any) {
    if (!inv.order) return;
    const moved = await prisma.order.updateMany({ where: { id: inv.order, org, status: "invoiced" }, data: { status: "paid" } });
    if (!moved.count) return;
    const order = await prisma.order.findFirst({ where: { id: inv.order, org } });
    if (!order) return;
    await emit(org, { type: "order_status", data: { id: order.id, number: order.number, status: "paid", customerName: order.customerName } });
    await logActivity(org, { deal: order.deal, contact: order.contact, company: order.company }, { type: "order", text: `Заказ ${order.number} оплачен`, meta: `order:${order.id}`, key: `order-paid:${order.id}` });
}

// Сделка выиграна, когда по ней оплачены все счета (черновики и отменённые не считаются). Настройка фирмы
// FinanceSettings.autoWinDealOnPaid; ручная отметка владельца главнее: уже выигранную не трогаем.
async function winDealIfSettled(org: string, inv: any) {
    if (!inv.deal) return;
    const settings = await prisma.financeSettings.findUnique({ where: { org }, select: { autoWinDealOnPaid: true } });
    if (settings && settings.autoWinDealOnPaid === false) return;
    const open = await prisma.invoice.count({ where: { org, deal: inv.deal, kind: "invoice", status: { notIn: ["paid", "draft", "cancelled"] } } });
    if (open > 0) return;
    const won = await prisma.deal.updateMany({ where: { id: inv.deal, owner: org, wonAt: null }, data: { wonAt: new Date() } });
    if (!won.count) return;
    const deal = await prisma.deal.findFirst({ where: { id: inv.deal, owner: org } });
    if (!deal) return;
    await logActivity(org, { deal: deal.id, contact: deal.contact, company: deal.company }, { type: "won", text: `Сделка выиграна: все счета оплачены (последний ${inv.number})`, meta: `deal:${deal.id}`, key: `won:${deal.id}` });
    await emit(org, { type: "deal_won", data: { id: deal.id, name: deal.clientName, contactName: deal.contactName, stageId: String(deal.stage), responsible: deal.responsible } });
}

// ПРРО (Украина): чек при полной оплате пробивается сам, если подключён Checkbox и включена автофискализация.
// Ошибку показываем в счёте, оплату не отменяем. Теперь — для любого источника оплаты, включая карту и банк.
async function autoFiscalize(org: string, inv: any, gross: number) {
    if (inv.fiscalCode) return;
    let fiscalData: Record<string, unknown> = {};
    try {
        const advice = fiscalAdvice(inv);
        const fiscalDoc = advice.needed ? await findFiscal(org) : null;
        if (fiscalDoc && fiscalConfig(fiscalDoc).auto) {
            const receipt = await fiscalizeInvoice(org, inv, gross, advice.payType);
            fiscalData = { fiscalId: receipt.receiptId, fiscalCode: receipt.fiscalCode, fiscalUrl: receipt.url, fiscalAt: new Date(), fiscalPayType: advice.payType, fiscalError: "" };
        }
    } catch (e) {
        fiscalData = { fiscalError: e instanceof Error ? e.message.slice(0, 300) : "Чек не вдалося пробити" };
    }
    if (Object.keys(fiscalData).length) await prisma.invoice.update({ where: { id: inv.id }, data: fiscalData as never });
}

// Платёж снят (банковское движение отвязали): сумма возвращается, счёт снова в работе. Идемпотентно по тому же ключу:
// повторный откат не вычтет сумму дважды.
export async function revertPayment(org: string, invoiceId: string, input: { source: PaymentSource; externalId: string; amount: number; actor?: { userId?: string; name?: string } }) {
    const inv0 = await prisma.invoice.findFirst({ where: { id: invoiceId, org } });
    if (!inv0) return { ok: false as const, reason: "not_found" as const };
    const revertKey = `revert:${input.externalId}`;
    const result = await prisma.$transaction(async (tx) => {
        await lockInvoice(tx, inv0.id);
        const inv = await tx.invoice.findUniqueOrThrow({ where: { id: inv0.id } });
        if (!["sent", "overdue", "paid"].includes(inv.status)) return null;
        if (await tx.paymentEvent.findUnique({ where: { org_source_externalId: { org, source: input.source, externalId: revertKey } } })) return null;
        // снимаем только то, что этим платежом было зачтено
        const original = await tx.paymentEvent.findUnique({ where: { org_source_externalId: { org, source: input.source, externalId: input.externalId } } });
        const amount = original ? original.amount : Math.abs(input.amount);
        const { paid, full } = applyPayment(inv, -amount);
        await tx.paymentEvent.create({ data: { org, invoice: inv.id, source: input.source, externalId: revertKey, amount: -amount, currency: inv.currency } });
        const updated = await tx.invoice.update({
            where: { id: inv.id },
            data: { paidAmount: paid, status: statusAfterPayment(inv.status, full), ...(full ? {} : { paidAt: null }) },
        });
        return { inv: updated, paid, amount };
    }).catch((e) => {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null;
        throw e;
    });
    if (!result) return { ok: false as const, reason: "closed" as const };
    const { inv, paid, amount } = result;
    const gross = computeTotals(inv.items as never).gross;
    await logAudit({
        org, userId: input.actor?.userId, userName: input.actor?.name, action: "invoice.payment_reverted", entityType: "invoice", entityId: inv.id,
        summary: `Invoice ${inv.number}: payment removed ${amount} ${inv.currency} — ${paid} of ${gross}`, meta: { amount, paid, gross, currency: inv.currency, source: input.source },
    }).catch((e) => recordSyncError(org, "payment.audit", e, { id: inv.id }));
    await logActivity(org, { deal: inv.deal, contact: inv.contact, company: inv.company }, { type: "payment", text: `Счёт ${inv.number}: платёж ${amount} ${inv.currency} отменён, оплачено ${paid} из ${gross}`, meta: `invoice:${inv.id}`, key: `revert:${inv.id}:${input.externalId}` });
    return { ok: true as const, invoice: inv, paid, gross };
}
