import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { type Role, effectiveModules } from "@/lib/access";
import { effectivePlan } from "@/lib/billing";
import { orgFeatures } from "@/lib/features";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_ORGS = 10;

// GET /api/orgs — фирмы пользователя (личная создаётся автоматически) и активная: { orgs: [{ id, name, role, plan, modules, features }], activeId }
// features — разделы, доступные фирме по её тарифу: по ним интерфейс решает, что показывать в меню и на страницах.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const memberships = await prisma.membership.findMany({ where: { user: user.userId } });
    const orgs = await prisma.organization.findMany({ where: { id: { in: memberships.map((m) => m.org) } } });
    const list = memberships
        .map((m) => {
            const o = orgs.find((x) => x.id === m.org);
            return o ? { id: o.id, name: o.name, role: m.role as Role, plan: effectivePlan(o), modules: effectiveModules(m.role as Role, m.modules ?? []), features: orgFeatures(o), blocked: !!o.blocked, personal: o.id === user.userId, activities: o.activities ?? [] } : null;
        })
        .filter(Boolean)
        .sort((a, b) => Number(b!.personal) - Number(a!.personal) || a!.name.localeCompare(b!.name));
    return NextResponse.json({ orgs: list, activeId: user.id });
}

// POST /api/orgs — { name }: новая фирма; создатель становится её владельцем. С одного аккаунта можно вести несколько фирм.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.replace(/[\p{Cc}<>]/gu, "").trim().slice(0, 80) : "";
    if (!name) return badRequest("Firm name is required");
    if ((await prisma.membership.count({ where: { user: user.userId, role: "owner" } })) >= MAX_ORGS) return badRequest("Too many firms");
    const org = await prisma.organization.create({ data: { name, ownerUser: user.userId } });
    await prisma.membership.create({ data: { org: org.id, user: user.userId, role: "owner" } });
    return NextResponse.json({ id: org.id, name: org.name, role: "owner" }, { status: 201 });
}
