import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { ASSIGNABLE_ROLES, GRANTABLE, effectiveModules, type Role } from "@/lib/access";
import Invitation from "@/models/Invitation";
import Membership from "@/models/Membership";
import User from "@/models/User";

export const dynamic = "force-dynamic";

const cleanModules = (v: unknown) => (Array.isArray(v) ? Array.from(new Set(v.filter((m): m is string => typeof m === "string" && (GRANTABLE as string[]).includes(m)))) : []);

// GET /api/orgs/members — участники фирмы и неотправленные приглашения (владелец и администратор)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const memberships = await Membership.find({ org: user.id });
    const users = await User.find({ _id: { $in: memberships.map((m) => m.user) } }).select("firstname lastname email avatarUrl");
    const members = memberships.map((m) => {
        const u = users.find((x) => String(x._id) === String(m.user));
        return { userId: String(m.user), name: u ? `${u.firstname} ${u.lastname}` : "—", email: u?.email ?? "", role: m.role as Role, modules: m.modules ?? [], effective: effectiveModules(m.role as Role, m.modules ?? []), you: String(m.user) === user.userId };
    });
    const invitations = (await Invitation.find({ org: user.id, expiresAt: { $gt: new Date() } })).map((i) => ({ id: String(i._id), email: i.email, role: i.role, modules: i.modules, createdAt: i.createdAt.toISOString() }));
    return NextResponse.json({ members, invitations, myRole: user.role });
}

// POST /api/orgs/members — { email, role, modules? }: добавить сотрудника. Есть аккаунт — доступ сразу; нет — приглашение,
// которое сработает при регистрации с этим e-mail.
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
    await connectDB();
    const existing = await User.findOne({ email });
    if (existing) {
        if (await Membership.exists({ org: user.id, user: existing._id })) return NextResponse.json({ message: "This person is already in the firm" }, { status: 409 });
        await Membership.create({ org: user.id, user: existing._id, role, modules });
        await Invitation.deleteMany({ org: user.id, email });
        return NextResponse.json({ added: true, invited: false }, { status: 201 });
    }
    await Invitation.findOneAndUpdate({ org: user.id, email }, { role, modules, invitedBy: user.userId, expiresAt: new Date(Date.now() + 30 * 86400_000) }, { upsert: true });
    return NextResponse.json({ added: false, invited: true }, { status: 201 });
}
