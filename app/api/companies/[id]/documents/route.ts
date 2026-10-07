import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import { documentsOf } from "@/lib/sync/overview";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/companies/[id]/documents — документы фирмы-заказчика одной лентой, как в карточке контакта и сделки
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const company = await prisma.company.findFirst({ where: { id: params.id, owner: user.id }, select: { id: true } });
    if (!company) return notFound();
    return NextResponse.json(await documentsOf(user.id, { company: company.id }));
}
