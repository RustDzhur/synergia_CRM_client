import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import Quote from "@/models/Quote";
import { toQuoteDTO } from "@/lib/finance/dto";

// POST /api/quotes/:id/send — как invoices/:id/send: только смена статуса + событие quote_sent
// (собственно отправка письма клиенту — отдельно, вручную или правилом send_email на это событие).
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const q = await Quote.findOne({ _id: params.id, org: user.id });
    if (!q) return notFound();
    if (q.status !== "draft") return badRequest("Only a draft quote can be sent");
    q.status = "sent";
    q.sentAt = new Date();
    await q.save();
    await emit(user.id, { type: "quote_sent", data: { id: String(q._id), number: q.number, customerName: q.customerName, dealId: q.deal ? String(q.deal) : "" } });
    return NextResponse.json(toQuoteDTO(q));
}
