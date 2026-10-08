import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { inviteFromPractice } from "@/lib/practice/service";
import { practiceFailure } from "@/lib/practice/http";

export const dynamic = "force-dynamic";

// POST { access, modules, expiresInDays, members, note } — приглашение клиента: возвращает токен, который клиент вводит у себя
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    if (typeof b !== "object" || !b) return badRequest("Invalid body");
    try {
        const link = await inviteFromPractice(params.id, user.userId, b);
        return NextResponse.json({ id: link.id, token: link.token, access: link.access, modules: link.modules, expiresAt: link.expiresAt }, { status: 201 });
    } catch (e) {
        return practiceFailure(e);
    }
}
