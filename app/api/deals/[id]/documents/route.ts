import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import { documentsOf } from "@/lib/sync/overview";
import { dealScope } from "@/lib/sync/people";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/deals/[id]/documents — все документы сделки одной лентой: предложения, счета, заказы и договоры.
// Карточка показывает их вместе, чтобы по клиенту было видно, что ему уже выставили и что подписали.
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const deal = await prisma.deal.findFirst({ where: { id: params.id, owner: user.id, ...dealScope(user) }, select: { id: true } });
    if (!deal) return notFound();
    return NextResponse.json(await documentsOf(user.id, { deal: deal.id }));
}
