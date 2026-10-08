import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { addVersion } from "@/lib/legal/service";
import { legalFailure } from "@/lib/legal/http";
import { actorOf } from "@/lib/review/http";

export const dynamic = "force-dynamic";

// POST { body, note?, aiDraft? } — новая версия; прежние остаются, согласование начинается заново
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        return NextResponse.json(await addVersion(user.id, await actorOf(user), params.id, b), { status: 201 });
    } catch (e) {
        return legalFailure(e);
    }
}
