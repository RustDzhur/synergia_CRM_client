import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized, validId } from "@/lib/api";
import { officeCtx, officeFailure, platformScope } from "@/lib/office/api";
import { getTaskScoped } from "@/lib/office/store";
import { cancelTask, confirmTask, reassignTask, rejectTask } from "@/lib/office/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/office/tasks/:id — решение человека: { action: "confirm", ids? } выполнить предложенное роботом (все или выбранные),
// "reject" — отказаться, "cancel" — отменить ещё не начатое, "reassign" + { robot } — отдать другому роботу (перетаскивание).
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return badRequest("Invalid id");
    const b = await req.json().catch(() => null);
    const scope = await platformScope(user);
    const ctx = officeCtx(user, b?.locale, scope.platform);
    try {
        if (!(await getTaskScoped(user.id, params.id, scope))) return NextResponse.json({ message: "Task not found" }, { status: 404 });
        switch (b?.action) {
            case "confirm": return NextResponse.json(await confirmTask(ctx, params.id, Array.isArray(b.ids) ? b.ids.filter((x: unknown): x is string => typeof x === "string") : undefined));
            case "reject": return NextResponse.json(await rejectTask(user.id, params.id));
            case "cancel": return NextResponse.json(await cancelTask(user.id, params.id));
            case "reassign": return typeof b.robot === "string" ? NextResponse.json(await reassignTask(ctx, params.id, b.robot)) : badRequest("Choose a robot");
            default: return badRequest("Unknown action");
        }
    } catch (e) {
        return officeFailure(e);
    }
}
