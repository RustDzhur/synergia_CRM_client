import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized, validId } from "@/lib/api";
import { customerBlockers } from "@/lib/sync/customer";
import { prisma } from "@/lib/prisma";

// GET /api/companies/:id/blockers — что связано с записью и мешает или предупреждает при удалении:
// неоплаченные счета, открытые сделки и задачи
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const found = await prisma.company.findFirst({ where: { id: params.id, owner: user.id }, select: { id: true } });
    if (!found) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json(await customerBlockers(user.id, { company: found.id }));
}
