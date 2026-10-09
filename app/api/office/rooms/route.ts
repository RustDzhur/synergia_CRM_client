import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { officeFailure } from "@/lib/office/api";
import { addRoom } from "@/lib/office/store";

export const dynamic = "force-dynamic";

// POST /api/office/rooms — добавить свою комнату в офис: { name }
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        return NextResponse.json(await addRoom(user.id, (b as { name?: unknown }).name), { status: 201 });
    } catch (e) {
        return officeFailure(e);
    }
}
