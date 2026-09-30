import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { findByToken } from "@/lib/integrations";
import { verifyPayWebhook, type PayProvider } from "@/lib/payments";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { applyPayment, statusAfterPayment } from "@/lib/finance/payments";
import { computeTotals } from "@/lib/finance/totals";
import Invoice from "@/models/Invoice";

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
    await connectDB();
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

    const inv = await Invoice.findOne({ org: integration.owner, number: result.reference });
    if (!inv) return NextResponse.json({ ok: true, note: "invoice not found" });
    // Повторный вебхук по уже оплаченному счёту — просто подтверждаем получение
    if (inv.status === "paid") return NextResponse.json({ ok: true, duplicate: true });

    const { gross } = computeTotals(inv.items as never);
    const { paid, full } = applyPayment(inv, Number(result.amount) || gross);
    inv.paidAmount = paid;
    inv.status = statusAfterPayment(inv.status, full);
    if (full) inv.paidAt = new Date();
    inv.paidVia = provider;
    await inv.save();

    const label = provider === "cryptopay" ? "криптою" : provider;
    if (full) {
        await emit(integration.owner, { type: "invoice_paid", data: { id: String(inv._id), number: inv.number, customerName: inv.customerName, amount: String(paid), dealId: inv.deal ? String(inv.deal) : "" } });
    }
    await notify(integration.owner, { type: "message", params: { name: inv.customerName || inv.number, channel: label, text: `Счёт ${inv.number} оплачен ${paid} ${inv.currency}` }, link: "/crm/finance?tab=invoices", key: `pay:${String(inv._id)}:${paid}` }).catch(() => undefined);
    await logAudit({
        org: integration.owner,
        action: full ? "invoice.paid" : "invoice.partially_paid",
        entityType: "invoice",
        entityId: String(inv._id),
        summary: `Invoice ${inv.number}: ${paid} ${inv.currency} paid via ${label} — ${paid} of ${gross} paid`,
        meta: { provider, amount: paid, gross, currency: inv.currency },
    });
    return NextResponse.json({ ok: true, paid, full });
}
