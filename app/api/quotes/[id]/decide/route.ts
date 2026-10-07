import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { emit } from "@/lib/automation/emit";
import { logDocEvent } from "@/lib/sync/documents";
import { toQuoteDTO } from "@/lib/finance/dto";

// POST /api/quotes/:id/decide — { accepted: boolean }: фиксирует ответ клиента на отправленное предложение.
// Отдельного события автоматизации на решение клиента нет — тариф на предложении не создаёт ни счёт, ни заказ сам по
// себе, а accepted-предложение можно превратить в заказ через /api/quotes/:id/order.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    const found = await prisma.quote.findFirst({ where: { id: params.id, org: user.id } });
    if (!found) return notFound();
    if (found.status !== "sent") return badRequest("Only a sent quote can be accepted or declined");
    const q = await prisma.quote.update({ where: { id: found.id }, data: { status: b.accepted ? "accepted" : "declined" } });
    await logDocEvent(user.id, q, "quote", b.accepted ? `Предложение ${q.number} принято клиентом` : `Предложение ${q.number} отклонено клиентом`, q.status);
    if (b.accepted) await emit(user.id, { type: "quote_accepted", data: { id: q.id, number: q.number, customerName: q.customerName, dealId: q.deal ?? "" } });
    return NextResponse.json(toQuoteDTO(q));
}
