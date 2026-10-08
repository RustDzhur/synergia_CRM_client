import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { CHECKLIST_ITEMS, getDoc, setChecklist, setDue, setStatus } from "@/lib/legal/service";
import { legalFailure } from "@/lib/legal/http";
import { actorOf } from "@/lib/review/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        return NextResponse.json({ ...(await getDoc(user.id, params.id)), checklistItems: CHECKLIST_ITEMS, disclaimer: "Checklist is a reminder for the specialist, not legal advice." });
    } catch (e) {
        return legalFailure(e);
    }
}

// PATCH { status? | dueDate? | checklist? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        if ("status" in b) return NextResponse.json(await setStatus(user.id, params.id, b.status));
        if ("dueDate" in b) return NextResponse.json(await setDue(user.id, await actorOf(user), params.id, b.dueDate));
        if ("checklist" in b) return NextResponse.json(await setChecklist(user.id, params.id, b.checklist));
        return badRequest("Nothing to change");
    } catch (e) {
        return legalFailure(e);
    }
}
