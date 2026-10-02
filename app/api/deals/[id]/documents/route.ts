import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import { computeTotals } from "@/lib/finance/totals";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/deals/[id]/documents — все документы сделки одной лентой: предложения, счета, заказы и договоры.
// Карточка показывает их вместе, чтобы по клиенту было видно, что ему уже выставили и что подписали.
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const deal = await prisma.deal.findFirst({ where: { id: params.id, owner: user.id }, select: { id: true } });
    if (!deal) return notFound();

    const [quotes, invoices, orders, contracts] = await Promise.all([
        prisma.quote.findMany({ where: { org: user.id, deal: deal.id }, orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.invoice.findMany({ where: { org: user.id, deal: deal.id }, orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.order.findMany({ where: { org: user.id, deal: deal.id }, orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.contract.findMany({ where: { org: user.id, deal: deal.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);

    const list = [
        ...quotes.map((d) => ({ kind: "quote", id: d.id, number: d.number, status: d.status, total: computeTotals((d.items ?? []) as never).gross, currency: d.currency, at: d.createdAt as unknown })),
        ...invoices.map((d) => ({ kind: d.kind === "credit_note" ? "credit_note" : "invoice", id: d.id, number: d.number, status: d.status, total: computeTotals((d.items ?? []) as never).gross, currency: d.currency, at: d.createdAt as unknown })),
        ...orders.map((d) => ({ kind: "order", id: d.id, number: d.number, status: d.status, total: computeTotals((d.items ?? []) as never).gross, currency: d.currency, at: d.createdAt as unknown })),
        ...contracts.map((d) => ({ kind: "contract", id: d.id, number: d.number, status: d.status, total: Number(d.value) || 0, currency: d.currency, at: d.createdAt as unknown })),
    ]
        .map((d) => ({ ...d, at: d.at instanceof Date ? d.at.toISOString() : String(d.at ?? "") }))
        .sort((a, b) => (a.at < b.at ? 1 : -1));

    return NextResponse.json(list);
}
