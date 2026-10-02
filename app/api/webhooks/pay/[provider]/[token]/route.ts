import { NextResponse } from "next/server";
import { findByToken } from "@/lib/integrations";
import { verifyPayWebhook, type PayProvider } from "@/lib/payments";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { applyPayment, statusAfterPayment } from "@/lib/finance/payments";
import { computeTotals } from "@/lib/finance/totals";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Вебхук эквайринга: monobank, LiqPay, WayForPay или крипта (NOWPayments).
//
// Адрес у каждого провайдера свой (/api/webhooks/pay/<провайдер>/<маркер фирмы>), а логика одна:
// проверить подпись, найти счёт по номеру из платежа и отметить его оплаченным. Подпись проверяется
// всегда — иначе кто угодно мог бы «оплатить» чужой счёт, просто отправив нам JSON.
//
// Оплата может прийти частями и повторно (провайдеры повторяют доставку): лишнее отсекает
// applyPayment — он не даёт заплатить больше суммы счёта.

const PROVIDERS: PayProvider[] = ["monobank", "liqpay", "wayforpay", "cryptopay"];

export async function POST(req: Request, { params }: { params: { provider: string; token: string } }) {
    const provider = params.provider as PayProvider;
    if (!PROVIDERS.includes(provider)) return NextResponse.json({ message: "Unknown provider" }, { status: 404 });
    const integration = await findByToken(provider, params.token);
    if (!integration) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const raw = await req.text();
    let result;
    try {
        result = await verifyPayWebhook(provider, integration, raw, req.headers);
    } catch {
        return NextResponse.json({ message: "Bad request" }, { status: 400 });
    }
    if (!result.ok) return NextResponse.json({ message: "Invalid signature" }, { status: 403 });
    // Промежуточные статусы (создан, обрабатывается) ничего не меняют, но и не ошибка
    if (result.status !== "paid") return NextResponse.json({ ok: true, status: result.status });
    if (!result.reference) return NextResponse.json({ ok: true });

    const inv = await prisma.invoice.findFirst({ where: { org: String(integration.owner), number: result.reference } });
    if (!inv) return NextResponse.json({ ok: true, note: "invoice not found" });
    // Повторный вебхук по уже оплаченному счёту — просто подтверждаем получение
    if (inv.status === "paid") return NextResponse.json({ ok: true, duplicate: true });

    const { gross } = computeTotals(inv.items as never);
    const { paid, full } = applyPayment(inv, Number(result.amount) || gross);
    await prisma.invoice.update({
        where: { id: inv.id },
        data: { paidAmount: paid, status: statusAfterPayment(inv.status, full), ...(full ? { paidAt: new Date() } : {}), paidVia: provider },
    });

    const label = provider === "cryptopay" ? "криптою" : provider;
    if (full) {
        await emit(integration.owner, { type: "invoice_paid", data: { id: inv.id, number: inv.number, customerName: inv.customerName, amount: String(paid), dealId: inv.deal ?? "" } });
    }
    await notify(integration.owner, { type: "message", params: { name: inv.customerName || inv.number, channel: label, text: `Счёт ${inv.number} оплачен ${paid} ${inv.currency}` }, link: "/crm/finance?tab=invoices", key: `pay:${inv.id}:${paid}` }).catch(() => undefined);
    await logAudit({
        org: integration.owner,
        action: full ? "invoice.paid" : "invoice.partially_paid",
        entityType: "invoice",
        entityId: inv.id,
        summary: `Invoice ${inv.number}: ${paid} ${inv.currency} paid via ${label} — ${paid} of ${gross} paid`,
        meta: { provider, amount: paid, gross, currency: inv.currency },
    });
    return NextResponse.json({ ok: true, paid, full });
}
