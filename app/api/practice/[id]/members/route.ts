import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { addMember, removeMember } from "@/lib/practice/service";
import { practiceFailure } from "@/lib/practice/http";

export const dynamic = "force-dynamic";

// POST { email, role } — добавить коллегу (у него уже должен быть аккаунт); DELETE ?user=<id> — убрать (доступ к клиентам закрывается сразу)
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        const m = await addMember(params.id, user.userId, (b as { email?: unknown }).email, (b as { role?: unknown }).role);
        return NextResponse.json({ userId: m.user, role: m.role }, { status: 201 });
    } catch (e) {
        return practiceFailure(e);
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const target = new URL(req.url).searchParams.get("user") ?? "";
    if (!target) return badRequest("user is required");
    try {
        await removeMember(params.id, user.userId, target);
        return NextResponse.json({ ok: true });
    } catch (e) {
        return practiceFailure(e);
    }
}
