import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { aiConfigured } from "@/lib/ai/provider";
import { officeFailure } from "@/lib/office/api";
import { sweepInterrupted } from "@/lib/office/runner";
import { MAX_ROBOTS, ensureStarters, listRobots, listTasks } from "@/lib/office/store";

export const dynamic = "force-dynamic";

// GET /api/office — всё для экрана «Робот-офис»: роботы, последние поручения, можно ли менять.
// При первом открытии фирмы нанимается стартовый состав (потом любого можно уволить, а офис — оставить пустым).
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        await ensureStarters(user.id);
        const [robots, tasks] = await Promise.all([listRobots(user.id), listTasks(user.id, 80)]);
        return NextResponse.json({ robots, tasks: await sweepInterrupted(user.id, tasks), ai: aiConfigured(), canEdit: user.role !== "viewer", maxRobots: MAX_ROBOTS });
    } catch (e) {
        return officeFailure(e);
    }
}
