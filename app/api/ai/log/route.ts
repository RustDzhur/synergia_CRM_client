import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/ai/log — журнал действий ИИ фирмы (последние 100); только владелец и администратор
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!["owner", "admin"].includes(user.role)) return NextResponse.json({ message: "You have no access to this section", code: "forbidden" }, { status: 403 });
    const rows = await prisma.aiLog.findMany({ where: { org: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
    const users = await prisma.user.findMany({ where: { id: { in: Array.from(new Set(rows.map((r) => r.user))) } }, select: { id: true, firstname: true, lastname: true } });
    const name = new Map(users.map((u) => [u.id, `${u.firstname} ${u.lastname}`.trim()]));
    return NextResponse.json(rows.map((r) => ({ at: r.createdAt.toISOString(), user: name.get(r.user) ?? "", kind: r.kind, tool: r.tool, args: r.args, result: r.result })));
}
