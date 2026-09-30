import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import { computeTotals } from "@/lib/finance/totals";
import Contact from "@/models/Contact";
import Contract from "@/models/Contract";
import Invoice from "@/models/Invoice";
import Order from "@/models/Order";
import Quote from "@/models/Quote";

export const dynamic = "force-dynamic";

// GET /api/contacts/[id]/documents — документы клиента одной лентой: предложения, счета, заказы, договоры.
// Владелец: «карточка клиента должна вестись по CRM — что он заказал и так далее, пока клиент не
// свершится полностью». В карточке контакта видно всё, что ему выставили, — как в карточке сделки.
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const contact = await Contact.findOne({ _id: params.id, owner: user.id }).select("_id");
    if (!contact) return notFound();

    const [quotes, invoices, orders, contracts] = await Promise.all([
        Quote.find({ org: user.id, contact: contact._id }).sort({ createdAt: -1 }).limit(50),
        Invoice.find({ org: user.id, contact: contact._id }).sort({ createdAt: -1 }).limit(50),
        Order.find({ org: user.id, contact: contact._id }).sort({ createdAt: -1 }).limit(50),
        Contract.find({ org: user.id, contact: contact._id }).sort({ createdAt: -1 }).limit(50),
    ]);

    const list = [
        ...quotes.map((d) => ({ kind: "quote", id: String(d._id), number: d.number, status: d.status, total: computeTotals(d.items ?? []).gross, currency: d.currency, at: d.createdAt })),
        ...invoices.map((d) => ({ kind: d.kind === "credit_note" ? "credit_note" : "invoice", id: String(d._id), number: d.number, status: d.status, total: computeTotals(d.items ?? []).gross, currency: d.currency, at: d.createdAt })),
        ...orders.map((d) => ({ kind: "order", id: String(d._id), number: d.number, status: d.status, total: computeTotals(d.items ?? []).gross, currency: d.currency, at: d.createdAt })),
        ...contracts.map((d) => ({ kind: "contract", id: String(d._id), number: d.number, status: d.status, total: Number(d.value) || 0, currency: d.currency, at: d.createdAt })),
    ]
        .map((d) => ({ ...d, at: d.at instanceof Date ? d.at.toISOString() : String(d.at ?? "") }))
        .sort((a, b) => (a.at < b.at ? 1 : -1));

    return NextResponse.json(list);
}
