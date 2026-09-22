import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import AuditLog from "@/models/AuditLog";

export const dynamic = "force-dynamic";

// GET /api/finance/audit — журнал финансово значимых действий фирмы (см. lib/audit.ts), самые новые первыми.
// Тот же модуль доступа, что и у остального Finance ("inventory") — отдельного права заводить не стали.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const list = await AuditLog.find({ org: user.id }).sort({ createdAt: -1 }).limit(200);
    return NextResponse.json(
        list.map((l) => ({
            id: String(l._id), action: l.action, entityType: l.entityType, entityId: String(l.entityId),
            summary: l.summary, userName: l.userName, createdAt: l.createdAt.toISOString(),
        }))
    );
}
