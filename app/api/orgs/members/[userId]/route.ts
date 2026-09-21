import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { ASSIGNABLE_ROLES, GRANTABLE, type Role } from "@/lib/access";
import Membership from "@/models/Membership";

export const dynamic = "force-dynamic";

const forbidden = (message: string) => NextResponse.json({ message, code: "forbidden" }, { status: 403 });

// PATCH /api/orgs/members/:userId — { role?, modules? }. Владельца изменить нельзя; администраторов назначает и меняет только владелец.
export async function PATCH(req: Request, { params }: { params: { userId: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.userId)) return notFound();
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid JSON");
    await connectDB();
    const m = await Membership.findOne({ org: user.id, user: params.userId });
    if (!m) return notFound();
    if (m.role === "owner") return forbidden("The owner's access cannot be changed");
    if (m.role === "admin" && user.role !== "owner") return forbidden("Only the owner can change administrators");
    if ("role" in body) {
        if (!ASSIGNABLE_ROLES.includes(body.role as Role)) return badRequest("Invalid role");
        if (body.role === "admin" && user.role !== "owner") return forbidden("Only the owner can add administrators");
        m.role = body.role;
    }
    if ("modules" in body) m.modules = Array.isArray(body.modules) ? body.modules.filter((x: unknown) => typeof x === "string" && (GRANTABLE as string[]).includes(x)) : [];
    await m.save();
    return NextResponse.json({ userId: params.userId, role: m.role, modules: m.modules });
}

// DELETE /api/orgs/members/:userId — убрать сотрудника из фирмы (владельца убрать нельзя)
export async function DELETE(req: Request, { params }: { params: { userId: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.userId)) return notFound();
    await connectDB();
    const m = await Membership.findOne({ org: user.id, user: params.userId });
    if (!m) return notFound();
    if (m.role === "owner") return forbidden("The owner cannot be removed");
    if (m.role === "admin" && user.role !== "owner") return forbidden("Only the owner can remove administrators");
    await Membership.deleteOne({ _id: m._id });
    return NextResponse.json({ ok: true });
}
