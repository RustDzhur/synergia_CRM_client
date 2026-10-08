import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { REVIEW_KINDS, approveMany, type ReviewKind } from "@/lib/review/service";
import { actorOf, reviewFailure } from "@/lib/review/http";

export const dynamic = "force-dynamic";

// POST { kind, ids[] } — пакетно одобрить документы, которые стоят «на проверке» (до 200 за раз)
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || !(REVIEW_KINDS as readonly string[]).includes(String(b.kind)) || !Array.isArray(b.ids)) return badRequest("Invalid body");
    try {
        return NextResponse.json(await approveMany(user.id, b.kind as ReviewKind, b.ids, await actorOf(user)));
    } catch (e) {
        return reviewFailure(e);
    }
}
