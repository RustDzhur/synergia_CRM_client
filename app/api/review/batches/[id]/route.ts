import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { applyBatch, dismissBatch, rollbackBatch } from "@/lib/review/batches";
import { actorOf, reviewFailure } from "@/lib/review/http";
import { withPeriodLock } from "@/lib/finance/periodLock";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET — отчёт «что сделал / сделает робот»: список изменений (было → стало, по какому правилу)
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await prisma.practiceBatch.findFirst({ where: { id: params.id, org: user.id } });
    return b ? NextResponse.json({ ...b }) : NextResponse.json({ message: "Not found" }, { status: 404 });
}

// POST { action: apply | rollback | dismiss }
async function handlePost(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const body = await req.json().catch(() => null);
    const action = String(body?.action ?? "");
    try {
        const actor = await actorOf(user);
        if (action === "apply") { const b = await applyBatch(user.id, actor, params.id); return NextResponse.json({ status: b.status, skipped: b.skipped }); }
        if (action === "rollback") return NextResponse.json({ status: "rolled_back", ...(await rollbackBatch(user.id, actor, params.id)) });
        if (action === "dismiss") { await dismissBatch(user.id, actor, params.id); return NextResponse.json({ status: "dismissed" }); }
        return badRequest("action must be apply, rollback or dismiss");
    } catch (e) {
        return reviewFailure(e);
    }
}
export const POST = withPeriodLock(handlePost);
