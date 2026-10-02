import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import { computeTotals } from "@/lib/finance/totals";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/contacts/[id]/documents — документы клиента одной лентой: предложения, счета, заказы, договоры.
// Владелец: «карточка клиента должна вестись по CRM — что он заказал и так далее, пока клиент не
// свершится полностью». В карточке контакта видно всё, что ему выставили, — как в карточке сделки.
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const contact = await prisma.contact.findFirst({ where: { id: params.id, owner: user.id }, select: { id: true } });
    if (!contact) return notFound();

    const [quotes, invoices, orders, contracts] = await Promise.all([
        prisma.quote.findMany({ where: { org: user.id, contact: params.id }, orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.invoice.findMany({ where: { org: user.id, contact: params.id }, orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.order.findMany({ where: { org: user.id, contact: params.id }, orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.contract.findMany({ where: { org: user.id, contact: params.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);

    const list = [
        ...quotes.map((d) => ({ kind: "quote", id: d.id, number: d.number, status: d.status, total: computeTotals((d.items as any) ?? []).gross, currency: d.currency, at: d.createdAt })),
        ...invoices.map((d) => ({ kind: d.kind === "credit_note" ? "credit_note" : "invoice", id: d.id, number: d.number, status: d.status, total: computeTotals((d.items as any) ?? []).gross, currency: d.currency, at: d.createdAt })),
        ...orders.map((d) => ({ kind: "order", id: d.id, number: d.number, status: d.status, total: computeTotals((d.items as any) ?? []).gross, currency: d.currency, at: d.createdAt })),
        ...contracts.map((d) => ({ kind: "contract", id: d.id, number: d.number, status: d.status, total: Number(d.value) || 0, currency: d.currency, at: d.createdAt })),
    ]
        .map((d) => ({ ...d, at: d.at instanceof Date ? d.at.toISOString() : String(d.at ?? "") }))
        .sort((a, b) => (a.at < b.at ? 1 : -1));

    return NextResponse.json(list);
}
