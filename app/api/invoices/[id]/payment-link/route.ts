import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/appUrl";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { createPayLink, isPayProvider, type PayProvider } from "@/lib/payments";
import { computeTotals } from "@/lib/finance/totals";
import { toInvoiceDTO } from "@/lib/finance/dto";
import { webhookPath } from "@/lib/integrations";
import { sendToConversation } from "@/lib/channels";
import { requireMarket } from "@/lib/finance/marketGuard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/invoices/:id/payment-link — подключённые способы оплаты и чаты клиента: из этого окно
// предлагает, чем принять оплату и куда отправить ссылку (клиенту — в его же переписку).
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    // Приём оплаты через monobank/LiqPay/WayForPay/крипту — украинский набор
    // отказ по режиму рынка — 409 с кодом market, а не 500 от исключения
    try { await requireMarket(user.id, "UA"); } catch (e) { return failure(e); }
    const inv = await prisma.invoice.findFirst({ where: { id: params.id, org: user.id }, select: { contact: true, payLink: true } });
    if (!inv) return notFound();
    const [connected, conversations] = await Promise.all([
        prisma.integration.findMany({ where: { owner: user.id, type: { in: ["monobank", "liqpay", "wayforpay", "cryptopay"] }, status: "connected" }, select: { type: true } }),
        inv.contact ? prisma.conversation.findMany({ where: { owner: user.id, contact: String(inv.contact) }, select: { id: true, channel: true, name: true }, take: 5 }) : [],
    ]);
    return NextResponse.json({
        providers: connected.map((c) => String(c.type)),
        conversations: conversations.map((c) => ({ id: c.id, channel: String(c.channel), name: String(c.name ?? "") })),
        payLink: (inv.payLink as any)?.url ? { provider: String((inv.payLink as any).provider ?? ""), url: String((inv.payLink as any).url) } : null,
    });
}

// POST /api/invoices/:id/payment-link — { provider, conversationId? }: ссылка на оплату счёта.
// С conversationId ссылка сразу уходит клиенту в его переписку (Telegram, Viber, WhatsApp).
//
// Платят клиенту фирмы, а не платформе: ссылку создаёт кабинет эквайринга самой фирмы (monobank,
// LiqPay, WayForPay или крипта), и деньги приходят ей. Когда клиент оплатит, провайдер сам позовёт
// наш вебхук, и счёт закроется — менеджеру не нужно отмечать оплату вручную.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const provider = String(body.provider ?? "");
    if (!isPayProvider(provider)) return badRequest("Обери спосіб оплати");
    try {
        await requireMarket(user.id, "UA");
        const inv = await prisma.invoice.findFirst({ where: { id: params.id, org: user.id } });
        if (!inv) return notFound();
        if (inv.status === "paid") return badRequest("Рахунок уже оплачено");
        const doc = await prisma.integration.findFirst({ where: { owner: user.id, type: provider, status: "connected" } });
        if (!doc) return badRequest(`${provider} не підключено — додайте ключі в Налаштуваннях → Інтеграції`);

        const { gross } = computeTotals(inv.items as never);
        const outstanding = Math.max(0, gross - (Number(inv.paidAmount) || 0));
        if (outstanding <= 0) return badRequest("Рахунок уже оплачено");
        const origin = appOrigin(req);
        const link = await createPayLink(provider as PayProvider, doc, {
            amount: outstanding,
            currency: inv.currency || "UAH",
            reference: inv.number,
            description: `Оплата за рахунком ${inv.number}`,
            webhookUrl: `${origin}${webhookPath(provider as never, String(doc.token))}`,
            returnUrl: `${origin}/pay/done`,
            locale: typeof body.locale === "string" ? body.locale : "uk",
        });
        const saved = await prisma.invoice.update({ where: { id: inv.id }, data: { payLink: { provider, url: link.url, id: link.id, at: new Date().toISOString() } as any } });

        // Отправка ссылки в переписку с клиентом: у мессенджеров писать первым нельзя, поэтому
        // предлагаем только те беседы, что уже есть у этого контакта (окно показывает их списком)
        let sent = false;
        let sendError = "";
        const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
        if (conversationId && validId(conversationId)) {
            try {
                const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, owner: user.id } });
                const account = conversation ? await prisma.integration.findFirst({ where: { id: String(conversation.integration), owner: user.id } }) : null;
                if (!conversation || !account) sendError = "Переписку не знайдено";
                else {
                    await sendToConversation(account, conversation, `Оплата за рахунком ${inv.number}: ${link.url}`);
                    sent = true;
                }
            } catch (e) {
                sendError = e instanceof Error ? e.message : "Не вдалося надіслати посилання";
            }
        }
        return NextResponse.json({ url: link.url, invoice: toInvoiceDTO(saved), sent, sendError }, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
