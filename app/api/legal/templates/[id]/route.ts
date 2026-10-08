import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { deleteTemplate, docFromTemplate } from "@/lib/legal/service";
import { legalFailure } from "@/lib/legal/http";
import { actorOf } from "@/lib/review/http";

export const dynamic = "force-dynamic";

// POST { title?, counterparty?, values: { имя: значение }, dueDate? } — документ из шаблона
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        return NextResponse.json(await docFromTemplate(user.id, await actorOf(user), params.id, b), { status: 201 });
    } catch (e) {
        return legalFailure(e);
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        await deleteTemplate(user.id, params.id);
        return NextResponse.json({ ok: true });
    } catch (e) {
        return legalFailure(e);
    }
}
