import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { practiceDetails, setAiMode } from "@/lib/practice/service";
import { practiceFailure } from "@/lib/practice/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        return NextResponse.json(await practiceDetails(params.id, user.userId));
    } catch (e) {
        return practiceFailure(e);
    }
}

// PATCH — { aiMode: none|own|platform }: можно ли применять ИИ к данным клиентов практики (по умолчанию — нет)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        const p = await setAiMode(params.id, user.userId, (b as { aiMode?: unknown }).aiMode);
        return NextResponse.json({ aiMode: p.aiMode });
    } catch (e) {
        return practiceFailure(e);
    }
}
