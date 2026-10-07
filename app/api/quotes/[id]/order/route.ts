import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { nextNumber } from "@/lib/finance/numbering";
import { toOrderDTO } from "@/lib/finance/dto";
import { prisma } from "@/lib/prisma";
import { logDocEvent } from "@/lib/sync/documents";
import { fx } from "@/lib/sync/texts";

// POST /api/quotes/:id/order — превращает принятое клиентом предложение в заказ (как orders/:id/invoice для счёта).
// Одно предложение — один заказ; повторно нельзя.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const quote = await prisma.quote.findFirst({ where: { id: params.id, org: user.id } });
    if (!quote) return notFound();
    if (quote.status !== "accepted") return badRequest("Only an accepted quote can become an order");
    if (quote.order) return badRequest("This quote already has an order");

    const author = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
    const number = await nextNumber(user.id, "SO");
    const order = await prisma.order.create({
        data: {
            org: user.id, number,
            contact: quote.contact, company: quote.company, customerName: quote.customerName, deal: quote.deal,
            items: (quote.items ?? undefined) as any, currency: quote.currency, template: quote.template,
            createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
        },
    });
    await prisma.quote.update({ where: { id: quote.id }, data: { order: order.id } });
    const totals = ((order.items as any[]) ?? []).reduce((s, it) => s + it.qty * it.unitPrice, 0);
    await logDocEvent(user.id, order, "order", fx("order_from_quote", { number: order.number, quote: quote.number }), "created");
    await emit(user.id, { type: "order_created", data: { id: order.id, number: order.number, customerName: order.customerName, total: String(totals), currency: order.currency } });
    return NextResponse.json(toOrderDTO(order), { status: 201 });
}
