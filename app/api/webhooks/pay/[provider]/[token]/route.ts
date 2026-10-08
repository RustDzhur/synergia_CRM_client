import { NextResponse } from "next/server";
import { findByToken } from "@/lib/integrations";
import { verifyPayWebhook, type PayProvider } from "@/lib/payments";
import { registerPayment } from "@/lib/sync/payments";
import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";

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

    // Ключ идемпотентности — отпечаток тела уведомления: провайдеры повторяют доставку байт-в-байт, и повтор
    // не должен ни прибавить сумму ещё раз (частичная оплата), ни запустить следствия заново.
    const externalId = createHash("sha256").update(raw).digest("hex").slice(0, 40);
    const label = provider === "cryptopay" ? "криптою" : provider;
    const res = await registerPayment(String(integration.owner), inv.id, { amount: Number(result.amount) || undefined, source: "webhook", externalId, via: provider, actor: { name: label } });
    if (!res.ok) return NextResponse.json({ ok: true, duplicate: true }); // счёт уже оплачен или закрыт — подтверждаем получение
    if (res.duplicate) return NextResponse.json({ ok: true, duplicate: true });
    return NextResponse.json({ ok: true, paid: res.paid, full: res.full });
}
