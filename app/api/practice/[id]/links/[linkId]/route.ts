import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { acceptByPractice, endLink } from "@/lib/practice/service";
import { practiceFailure } from "@/lib/practice/http";

export const dynamic = "force-dynamic";

// POST { action: "accept", members } — подтвердить приглашение клиента; { action: "end", reason } — завершить связь (партнёр практики)
export async function POST(req: Request, { params }: { params: { id: string; linkId: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        if (b.action === "accept") return NextResponse.json({ status: (await acceptByPractice(params.id, user.userId, params.linkId, b.members)).status });
        if (b.action === "end") {
            // связь должна принадлежать этой практике: id в адресе не даёт права на чужую
            const { prisma } = await import("@/lib/prisma");
            const link = await prisma.clientLink.findFirst({ where: { id: params.linkId, practice: params.id } });
            if (!link) return NextResponse.json({ message: "Link not found" }, { status: 404 });
            return NextResponse.json({ status: (await endLink(params.linkId, { userId: user.userId }, b.reason)).status });
        }
        return badRequest("Unknown action");
    } catch (e) {
        return practiceFailure(e);
    }
}
