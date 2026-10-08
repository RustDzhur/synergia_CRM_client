import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized, validId } from "@/lib/api";
import { answerRequest } from "@/lib/review/service";
import { actorOf, reviewFailure } from "@/lib/review/http";

export const dynamic = "force-dynamic";

// PATCH { answer } — ответить на запрос; { cancel: true } — отменить (автор, владелец или администратор)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return badRequest("Invalid id");
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        return NextResponse.json(await answerRequest(user.id, await actorOf(user), params.id, b));
    } catch (e) {
        return reviewFailure(e);
    }
}
