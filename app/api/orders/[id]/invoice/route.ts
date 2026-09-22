import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { nextNumber } from "@/lib/finance/numbering";
import { financeSettings } from "@/lib/finance/settings";
import Order from "@/models/Order";
import Invoice from "@/models/Invoice";
import User from "@/models/User";
import { toInvoiceDTO } from "@/lib/finance/dto";

// POST /api/orders/:id/invoice — { customerAddress?, customerTaxId? }: выставить счёт по заказу. Заказ переходит в "invoiced"
// и получает ссылку на счёт; повторно выставить счёт по тому же заказу нельзя (один заказ — один счёт).
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const order = await Order.findOne({ _id: params.id, org: user.id });
    if (!order) return notFound();
    if (order.invoice) return badRequest("This order already has an invoice");
    if (!order.items.length) return badRequest("The order has no line items to invoice");

    const b = await req.json().catch(() => ({}));
    const [settings, author] = await Promise.all([financeSettings(user.id), User.findById(user.userId).select("firstname lastname")]);
    const number = await nextNumber(user.id, settings.invoicePrefix || "RE");
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + (settings.paymentTermsDays ?? 14) * 86400000).toISOString().slice(0, 10);

    const invoice = await Invoice.create({
        org: user.id, number, kind: "invoice",
        contact: order.contact, company: order.company, customerName: order.customerName,
        customerAddress: typeof b.customerAddress === "string" ? b.customerAddress.trim().slice(0, 500) : "",
        customerTaxId: typeof b.customerTaxId === "string" ? b.customerTaxId.trim().slice(0, 60) : "",
        deal: order.deal, order: order._id, contract: order.contract,
        items: order.items, currency: order.currency,
        smallBusinessNote: !!settings.smallBusiness,
        issueDate: today, dueDate: due,
        createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
    });
    order.invoice = invoice._id as any;
    order.status = "invoiced";
    await order.save();
    await emit(user.id, { type: "order_status", data: { id: String(order._id), number: order.number, status: "invoiced", customerName: order.customerName } });
    return NextResponse.json(toInvoiceDTO(invoice), { status: 201 });
}
