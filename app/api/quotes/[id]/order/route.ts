import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { nextNumber } from "@/lib/finance/numbering";
import Quote from "@/models/Quote";
import Order from "@/models/Order";
import User from "@/models/User";
import { toOrderDTO } from "@/app/api/orders/route";

// POST /api/quotes/:id/order — превращает принятое клиентом предложение в заказ (как orders/:id/invoice для счёта).
// Одно предложение — один заказ; повторно нельзя.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const quote = await Quote.findOne({ _id: params.id, org: user.id });
    if (!quote) return notFound();
    if (quote.status !== "accepted") return badRequest("Only an accepted quote can become an order");
    if (quote.order) return badRequest("This quote already has an order");

    const author = await User.findById(user.userId).select("firstname lastname");
    const number = await nextNumber(user.id, "SO");
    const order = await Order.create({
        org: user.id, number,
        contact: quote.contact, company: quote.company, customerName: quote.customerName, deal: quote.deal,
        items: quote.items, currency: quote.currency,
        createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
    });
    quote.order = order._id as any;
    await quote.save();
    const totals = (order.items as any[]).reduce((s, it) => s + it.qty * it.unitPrice, 0);
    await emit(user.id, { type: "order_created", data: { id: String(order._id), number: order.number, customerName: order.customerName, total: String(totals), currency: order.currency } });
    return NextResponse.json(toOrderDTO(order), { status: 201 });
}
