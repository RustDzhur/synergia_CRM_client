import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { endLink } from "@/lib/practice/service";
import { practiceFailure } from "@/lib/practice/http";

export const dynamic = "force-dynamic";

// POST { action: "end", reason? } — клиент отзывает доступ практики; доступ закрывается немедленно
export async function POST(req: Request, { params }: { params: { linkId: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || b.action !== "end") return badRequest("Unknown action");
    try {
        const link = await endLink(params.linkId, { userId: user.userId, role: user.role, org: user.id }, b.reason);
        return NextResponse.json({ status: link.status });
    } catch (e) {
        return practiceFailure(e);
    }
}
