import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { acceptInvite } from "@/lib/practice/service";
import { practiceFailure } from "@/lib/practice/http";

export const dynamic = "force-dynamic";

// POST { token } — владелец/администратор фирмы принимает приглашение практики. Принятие оформляет согласие клиента (ConsentRecord).
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        const link = await acceptInvite(user.id, { userId: user.userId, role: user.role }, (b as { token?: unknown }).token);
        return NextResponse.json({ id: link.id, status: link.status });
    } catch (e) {
        return practiceFailure(e);
    }
}
