import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized, validId } from "@/lib/api";
import { officeFailure } from "@/lib/office/api";
import { deleteRobot, updateRobot } from "@/lib/office/store";

export const dynamic = "force-dynamic";

// PATCH /api/office/robots/:id — имя, должность, комната, цвет, навыки, инструкция, режим («спрашивать»/«делать сам»), включён, регулярные задачи
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return badRequest("Invalid id");
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        return NextResponse.json(await updateRobot(user.id, params.id, b));
    } catch (e) {
        return officeFailure(e);
    }
}

// DELETE /api/office/robots/:id — уволить робота (его очередь отменяется, история поручений остаётся)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return badRequest("Invalid id");
    try {
        await deleteRobot(user.id, params.id);
        return NextResponse.json({ ok: true });
    } catch (e) {
        return officeFailure(e);
    }
}
