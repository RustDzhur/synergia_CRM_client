import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import { overviewOf } from "@/lib/sync/overview";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/contacts/:id/overview — сводка по клиенту: сделки, задачи, документы, оплаты, остаток к оплате, расходы по его сделкам
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const found = await prisma.contact.findFirst({ where: { id: params.id, owner: user.id }, select: { id: true } });
    if (!found) return notFound();
    return NextResponse.json(await overviewOf(user.id, { contact: found.id }));
}
