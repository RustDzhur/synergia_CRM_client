import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import Quote from "@/models/Quote";
import { toQuoteDTO } from "@/lib/finance/dto";

// POST /api/quotes/:id/decide — { accepted: boolean }: фиксирует ответ клиента на отправленное предложение.
// Отдельного события автоматизации на решение клиента нет — тариф на предложении не создаёт ни счёт, ни заказ сам по
// себе, а accepted-предложение можно превратить в заказ через /api/quotes/:id/order.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    await connectDB();
    const q = await Quote.findOne({ _id: params.id, org: user.id });
    if (!q) return notFound();
    if (q.status !== "sent") return badRequest("Only a sent quote can be accepted or declined");
    q.status = b.accepted ? "accepted" : "declined";
    await q.save();
    return NextResponse.json(toQuoteDTO(q));
}
