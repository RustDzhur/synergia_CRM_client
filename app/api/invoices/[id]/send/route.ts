import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import Invoice from "@/models/Invoice";
import { toInvoiceDTO } from "@/lib/finance/dto";

// POST /api/invoices/:id/send — отмечает счёт отправленным (сама отправка письма — отдельно, через send_email/Web Mails,
// это только смена статуса + событие автоматизации invoice_sent). После этого счёт больше не редактируется.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const inv = await Invoice.findOne({ _id: params.id, org: user.id });
    if (!inv) return notFound();
    if (inv.status !== "draft") return badRequest("Only a draft invoice can be sent");
    inv.status = "sent";
    inv.sentAt = new Date();
    await inv.save();
    await emit(user.id, { type: "invoice_sent", data: { id: String(inv._id), number: inv.number, customerName: inv.customerName, dealId: inv.deal ? String(inv.deal) : "" } });
    return NextResponse.json(toInvoiceDTO(inv));
}
