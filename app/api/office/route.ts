import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { aiConfigured } from "@/lib/ai/provider";
import { officeFailure, platformScope } from "@/lib/office/api";
import { sweepInterrupted } from "@/lib/office/runner";
import { platformInfo } from "@/lib/office/platform";
import { hireCatalog } from "@/lib/office/catalog";
import { orgMarket } from "@/lib/finance/marketGuard";
import { MAX_ROBOTS, ensurePlatformRobots, ensureStarters, listRobots, listTasks, visibleTasks } from "@/lib/office/store";

export const dynamic = "force-dynamic";

// GET /api/office — всё для экрана «Робот-офис»: роботы, последние поручения, можно ли менять.
// При первом открытии фирмы нанимается стартовый состав (потом любого можно уволить, а офис — оставить пустым).
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        await ensureStarters(user.id);
        // администратору платформы в офисе сидят ещё три робота платформы: ловля ошибок, оптимизация сайта, блог
        const scope = await platformScope(user);
        const admin = scope.platform;
        if (admin) await ensurePlatformRobots(user.id);
        const [robots, allTasks] = await Promise.all([listRobots(user.id, scope), listTasks(user.id, 80)]);
        const tasks = await visibleTasks(user.id, allTasks, scope);
        const catalog = (await hireCatalog(await orgMarket(user.id))).map((t) => ({ id: t.id, name: t.name, zone: t.zone, accent: t.accent, skills: t.skills, texts: t.texts }));
        return NextResponse.json({ robots, catalog, tasks: await sweepInterrupted(user.id, tasks), ai: aiConfigured(), canEdit: user.role !== "viewer", maxRobots: MAX_ROBOTS, ...(admin ? { platform: await platformInfo() } : {}) });
    } catch (e) {
        return officeFailure(e);
    }
}
