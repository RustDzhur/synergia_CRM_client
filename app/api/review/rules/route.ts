import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { createRule, listRules } from "@/lib/review/rules";
import { actorOf, reviewFailure } from "@/lib/review/http";
import { withPeriodLock } from "@/lib/finance/periodLock";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    return NextResponse.json({ rules: await listRules(user.id) });
}

// POST { field: counterparty|reference, pattern, category } — новое правило сверки; сразу применяется к неразмеченным движениям
async function handlePost(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        return NextResponse.json(await createRule(user.id, await actorOf(user), b), { status: 201 });
    } catch (e) {
        return reviewFailure(e);
    }
}
export const POST = withPeriodLock(handlePost);
