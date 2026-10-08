import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { practiceDashboard } from "@/lib/practice/dashboard";
import { prisma } from "@/lib/prisma";
import { practiceFailure } from "@/lib/practice/http";

export const dynamic = "force-dynamic";

// GET /api/practice/:id/dashboard — панель «Мои клиенты»: агрегаты по действующим связям сотрудника
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        const u = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
        return NextResponse.json({ clients: await practiceDashboard(params.id, user.userId, `${u?.firstname ?? ""} ${u?.lastname ?? ""}`.trim()) });
    } catch (e) {
        return practiceFailure(e);
    }
}
