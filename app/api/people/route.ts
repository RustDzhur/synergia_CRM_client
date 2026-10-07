import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/people — сотрудники фирмы для выбора ответственного: только имена (без адресов и ролей), доступно любому
// участнику фирмы. Список участников с правами и приглашениями — /api/orgs/members, он только для владельца и администраторов.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const members = await prisma.membership.findMany({ where: { org: user.id }, select: { user: true } });
    const users = await prisma.user.findMany({ where: { id: { in: members.map((m) => String(m.user)) } }, select: { id: true, firstname: true, lastname: true } });
    return NextResponse.json(users.map((u) => ({ id: u.id, name: `${u.firstname} ${u.lastname}`.trim() })).filter((u) => u.name).sort((a, b) => a.name.localeCompare(b.name)));
}
