import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized, validId } from "@/lib/api";
import { REVIEW_KINDS, REVIEW_STATUSES, setReview, type ReviewKind, type ReviewStatus } from "@/lib/review/service";
import { actorOf, reviewFailure } from "@/lib/review/http";

export const dynamic = "force-dynamic";

// PATCH { status: needs_review | approved | needs_fix | draft, note? } — отметка проверки счёта (invoices) или расхода (expenses)
export async function PATCH(req: Request, { params }: { params: { kind: string; id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!(REVIEW_KINDS as readonly string[]).includes(params.kind) || !validId(params.id)) return badRequest("Unknown document");
    const b = await req.json().catch(() => null);
    if (!b || !(REVIEW_STATUSES as readonly string[]).includes(String(b.status))) return badRequest("Invalid status");
    try {
        return NextResponse.json({ review: await setReview(user.id, params.kind as ReviewKind, params.id, await actorOf(user), b.status as ReviewStatus, b.note) });
    } catch (e) {
        return reviewFailure(e);
    }
}
