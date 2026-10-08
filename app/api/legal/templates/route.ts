import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { createTemplate, listTemplates } from "@/lib/legal/service";
import { legalFailure } from "@/lib/legal/http";
import { actorOf } from "@/lib/review/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    return NextResponse.json({ templates: await listTemplates(user.id) });
}

// POST { name, body } — шаблон с переменными вида {{name}}
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        return NextResponse.json(await createTemplate(user.id, await actorOf(user), b), { status: 201 });
    } catch (e) {
        return legalFailure(e);
    }
}
