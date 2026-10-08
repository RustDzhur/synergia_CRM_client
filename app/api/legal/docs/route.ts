import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { createDoc, listDocs } from "@/lib/legal/service";
import { legalFailure } from "@/lib/legal/http";
import { actorOf } from "@/lib/review/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const docs = await listDocs(user.id);
    return NextResponse.json({ docs });
}

// POST { title, counterparty?, body, dueDate?, note?, aiDraft? } — новый документ (версия 1)
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        const a = await actorOf(user);
        return NextResponse.json(await createDoc(user.id, a, b), { status: 201 });
    } catch (e) {
        return legalFailure(e);
    }
}
