import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/finance/audit — журнал финансово значимых действий фирмы (см. lib/audit.ts), самые новые первыми.
// Тот же модуль доступа, что и у остального Finance ("inventory") — отдельного права заводить не стали.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const list = await prisma.auditLog.findMany({ where: { org: user.id }, orderBy: { createdAt: "desc" }, take: 200 });
    return NextResponse.json(
        list.map((l) => ({
            id: l.id, action: l.action, entityType: l.entityType, entityId: String(l.entityId),
            summary: l.summary, userName: l.userName, createdAt: l.createdAt.toISOString(),
        }))
    );
}
