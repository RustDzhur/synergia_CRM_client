import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { listBatches, proposeRulesBatch } from "@/lib/review/batches";
import { actorOf, reviewFailure } from "@/lib/review/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const rows = await listBatches(user.id);
    return NextResponse.json({ batches: rows.map((b) => ({ id: b.id, kind: b.kind, status: b.status, count: Array.isArray(b.changes) ? b.changes.length : 0, skipped: b.skipped, createdByName: b.createdByName, createdAt: b.createdAt, appliedAt: b.appliedAt, rolledBackAt: b.rolledBackAt })) });
}

// POST — «Что сделает робот»: предложить пакет по правилам сверки. Ничего не записывает, пока человек не применит пакет.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        const b = await proposeRulesBatch(user.id, await actorOf(user));
        return NextResponse.json({ id: b.id, count: (b.changes as unknown[]).length }, { status: 201 });
    } catch (e) {
        return reviewFailure(e);
    }
}
