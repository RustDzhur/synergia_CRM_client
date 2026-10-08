import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { aiConfigured } from "@/lib/ai/provider";
import { officeCtx, officeFailure, platformScope } from "@/lib/office/api";
import { startOfficeTask } from "@/lib/office/runner";
import { deleteFinishedTasks } from "@/lib/office/store";

export const dynamic = "force-dynamic";

// POST /api/office/tasks — { robot: id | "iris", text, locale?, source? }: поручение роботу (или начальнику — Айрис сама раздаст роботам).
// Ответ приходит сразу; работа идёт в фоне, ход виден в GET /api/office.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!aiConfigured()) return NextResponse.json({ message: "AI is not set up on this site yet", code: "not_configured" }, { status: 503 });
    const b = await req.json().catch(() => null);
    const text = typeof b?.text === "string" ? b.text.trim() : "";
    if (!text || typeof b?.robot !== "string") return badRequest("Choose a robot and describe the task");
    try {
        const task = await startOfficeTask(officeCtx(user, b.locale, (await platformScope(user)).platform), { robot: b.robot, text, source: b.source === "drop" ? "drop" : "user", locale: typeof b.locale === "string" ? b.locale : undefined });
        return NextResponse.json(task, { status: 201 });
    } catch (e) {
        return officeFailure(e);
    }
}

// DELETE /api/office/tasks — убрать из списка всё завершённое
export async function DELETE(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        return NextResponse.json({ removed: await deleteFinishedTasks(user.id) });
    } catch (e) {
        return officeFailure(e);
    }
}
