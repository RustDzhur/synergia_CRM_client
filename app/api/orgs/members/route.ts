import { NextResponse } from "next/server";
import { planFor } from "@/config/plans";
import { effectivePlan } from "@/lib/billing";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { appOrigin } from "@/lib/appUrl";
import { sendInviteEmail } from "@/lib/inviteEmail";
import { type Role, ASSIGNABLE_ROLES, GRANTABLE, NO_MODULES, effectiveModules } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const cleanModules = (v: unknown) => (Array.isArray(v) ? Array.from(new Set(v.filter((m): m is string => typeof m === "string" && (GRANTABLE as string[]).includes(m) || m === NO_MODULES))) : []);

// GET /api/orgs/members — участники фирмы и неотправленные приглашения (владелец и администратор)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const memberships = await prisma.membership.findMany({ where: { org: user.id } });
    const users = await prisma.user.findMany({ where: { id: { in: memberships.map((m) => m.user) } }, select: { id: true, firstname: true, lastname: true, email: true, avatarUrl: true } });
    const members = memberships.map((m) => {
        const u = users.find((x) => x.id === m.user);
        return { userId: m.user, name: u ? `${u.firstname} ${u.lastname}` : "—", email: u?.email ?? "", role: m.role as Role, modules: m.modules ?? [], effective: effectiveModules(m.role as Role, m.modules ?? []), you: m.user === user.userId };
    });
    const invitations = (await prisma.invitation.findMany({ where: { org: user.id, expiresAt: { gt: new Date() } } })).map((i) => ({ id: i.id, email: i.email, role: i.role, modules: i.modules, createdAt: i.createdAt.toISOString() }));
    return NextResponse.json({ members, invitations, myRole: user.role });
}

// POST /api/orgs/members — { email, role, modules?, lang? }: добавить сотрудника. Есть аккаунт — доступ сразу; нет — приглашение,
// которое сработает при регистрации с этим e-mail. Если у фирмы подключена почта, туда же уходит письмо (emailed).
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = body?.role as Role;
    if (!/^\S+@\S+\.\S+$/.test(email)) return badRequest("Enter a valid email address");
    if (!ASSIGNABLE_ROLES.includes(role)) return badRequest("Invalid role");
    if (role === "admin" && user.role !== "owner") return NextResponse.json({ message: "Only the owner can add administrators", code: "forbidden" }, { status: 403 });
    const modules = cleanModules(body?.modules);
    const org = await prisma.organization.findUnique({ where: { id: user.id }, select: { plan: true, planOverride: true, planOverrideUntil: true } });
    const plan = planFor(org ? effectivePlan(org) : "free");
    if (plan.users !== null) {
        const seats = (await prisma.membership.count({ where: { org: user.id } })) + (await prisma.invitation.count({ where: { org: user.id, expiresAt: { gt: new Date() } } }));
        if (seats >= plan.users) return NextResponse.json({ message: `Your plan allows ${plan.users} team members. Upgrade the plan to add more.`, code: "plan_limit" }, { status: 402 });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        if (await prisma.membership.findFirst({ where: { org: user.id, user: existing.id } })) return NextResponse.json({ message: "This person is already in the firm" }, { status: 409 });
        await prisma.membership.create({ data: { org: user.id, user: existing.id, role, modules } });
        await prisma.invitation.deleteMany({ where: { org: user.id, email } });
        const emailed = await sendInviteEmail(user.id, email, user.orgName, appOrigin(req), true, String(body?.lang ?? ""));
        return NextResponse.json({ added: true, invited: false, emailed }, { status: 201 });
    }
    const expiresAt = new Date(Date.now() + 30 * 86400_000);
    const inv = await prisma.invitation.findFirst({ where: { org: user.id, email } });
    if (inv) await prisma.invitation.update({ where: { id: inv.id }, data: { role, modules, invitedBy: user.userId, expiresAt } });
    else await prisma.invitation.create({ data: { org: user.id, email, role, modules, invitedBy: user.userId, expiresAt } });
    const emailed = await sendInviteEmail(user.id, email, user.orgName, appOrigin(req), false, String(body?.lang ?? ""));
    return NextResponse.json({ added: false, invited: true, emailed }, { status: 201 });
}
