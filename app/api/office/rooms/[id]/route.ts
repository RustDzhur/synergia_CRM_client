import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { officeFailure } from "@/lib/office/api";
import { removeRoom, renameRoom } from "@/lib/office/store";
import { isRoomId } from "@/lib/office/templates";

export const dynamic = "force-dynamic";

// PATCH /api/office/rooms/:id — переименовать; DELETE — убрать комнату (роботы переезжают в «Офис»)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!isRoomId(params.id)) return badRequest("Unknown room");
    const b = await req.json().catch(() => null);
    try { return NextResponse.json(await renameRoom(user.id, params.id, (b as { name?: unknown } | null)?.name)); } catch (e) { return officeFailure(e); }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!isRoomId(params.id)) return badRequest("Unknown room");
    try { await removeRoom(user.id, params.id); return NextResponse.json({ ok: true }); } catch (e) { return officeFailure(e); }
}
