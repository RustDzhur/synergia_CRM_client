import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { effectiveModules, type Role } from "@/lib/access";
import { effectivePlan } from "@/lib/billing";
import Membership from "@/models/Membership";
import Organization from "@/models/Organization";

export const dynamic = "force-dynamic";

const MAX_ORGS = 10;

// GET /api/orgs — фирмы пользователя (личная создаётся автоматически) и активная: { orgs: [{ id, name, role, plan, modules }], activeId }
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const memberships = await Membership.find({ user: user.userId });
    const orgs = await Organization.find({ _id: { $in: memberships.map((m) => m.org) } });
    const list = memberships
        .map((m) => {
            const o = orgs.find((x) => String(x._id) === String(m.org));
            return o ? { id: String(o._id), name: o.name, role: m.role as Role, plan: effectivePlan(o), modules: effectiveModules(m.role as Role, m.modules ?? []), blocked: !!o.blocked, personal: String(o._id) === user.userId } : null;
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
    await connectDB();
    if ((await Membership.countDocuments({ user: user.userId, role: "owner" })) >= MAX_ORGS) return badRequest("Too many firms");
    const org = await Organization.create({ name, ownerUser: user.userId });
    await Membership.create({ org: org._id, user: user.userId, role: "owner" });
    return NextResponse.json({ id: String(org._id), name: org.name, role: "owner" }, { status: 201 });
}
